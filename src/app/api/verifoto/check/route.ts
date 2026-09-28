import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import type { DetectorResult } from '@/lib/verifoto'

// VeriFoto: secondo parere del rilevatore AI (Sightengine, quota gratuita).
// La foto arriva già ridotta e senza metadati dal browser, viene inoltrata a
// Sightengine e non viene salvata. Ogni analisi prenota le operazioni stimate
// (verifoto_reserve) e poi si registrano quelle effettive: superato il tetto
// mensile deciso in Admin il rilevatore si ferma, così non si paga mai.

const MAX_BYTES = 4 * 1024 * 1024
const SIGHTENGINE_URL = 'https://api.sightengine.com/1.0/check.json'

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

function reply(result: DetectorResult, status = 200) {
  return NextResponse.json(result, { status })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return reply({ status: 'not_allowed' }, 401)
  if (!(await hasActiveToolAccess(supabase, user.id, 'verifoto'))) return reply({ status: 'not_allowed' }, 403)

  let image: File | null = null
  try {
    const form = await request.formData()
    const value = form.get('image')
    image = value instanceof File ? value : null
  } catch {
    image = null
  }
  if (!image || image.size === 0 || image.size > MAX_BYTES || !/^image\/(jpeg|png|webp)$/.test(image.type)) {
    return reply({ status: 'error' }, 400)
  }

  const apiUser = process.env.SIGHTENGINE_API_USER
  const apiSecret = process.env.SIGHTENGINE_API_SECRET
  if (!apiUser || !apiSecret) return reply({ status: 'unavailable' })

  // Prenotazione: limite giornaliero dell'utente e tetto mensile di operazioni
  const { data: reservation } = await supabase.rpc('verifoto_reserve')
  const reserved = reservation as { result?: string; reserved?: number } | null
  if (reserved?.result === 'quota') return reply({ status: 'quota' })
  if (reserved?.result === 'user_limit') return reply({ status: 'user_limit' })
  if (reserved?.result !== 'ok') return reply({ status: 'not_allowed' }, 403)
  const reservedOps = reserved.reserved ?? 5

  const settle = async (actual: number | null, failed: boolean) => {
    const { error } = await service().rpc('verifoto_settle', { p_user: user.id, p_reserved: reservedOps, p_actual: actual, p_failed: failed })
    if (error) console.error('[VeriFoto] settle failed:', error.message)
  }

  try {
    const body = new FormData()
    body.append('media', image, 'photo.jpg')
    body.append('models', 'genai')
    body.append('api_user', apiUser)
    body.append('api_secret', apiSecret)
    const res = await fetch(SIGHTENGINE_URL, { method: 'POST', body, signal: AbortSignal.timeout(20000), cache: 'no-store' })
    const data = (await res.json()) as {
      status?: string
      request?: { operations?: number }
      type?: { ai_generated?: number; ai_generators?: Record<string, number> }
      error?: { message?: string }
    }
    if (!res.ok || data.status !== 'success' || typeof data.type?.ai_generated !== 'number') {
      console.error('[VeriFoto] Sightengine error:', data.error?.message ?? res.status)
      await settle(null, true)
      return reply({ status: 'unavailable' })
    }
    await settle(typeof data.request?.operations === 'number' ? data.request.operations : reservedOps, false)
    // Generatore più probabile (se chiaramente sopra gli altri)
    const generators = Object.entries(data.type.ai_generators ?? {}).filter(([name]) => name !== 'other')
    const top = generators.sort((a, b) => b[1] - a[1])[0]
    await awardToolPoint('verifoto')
    const generator = top && top[1] >= 0.5 ? top[0].replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : null
    return reply({ status: 'ok', aiScore: data.type.ai_generated, generator })
  } catch (err) {
    console.error('[VeriFoto] check failed:', err instanceof Error ? err.message : err)
    await settle(null, true)
    return reply({ status: 'unavailable' })
  }
}
