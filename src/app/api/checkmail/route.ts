import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { analyzeEmail, networkFindings, withFindings } from '@/lib/checkmail/engine'
import { msgToEml } from '@/lib/checkmail/msg'
import { applyAiAssessment, assessWithAi, type AiAssessment } from '@/lib/checkmail/ai'
import { MissingApiKeyError } from '@/lib/anthropic'
import type { CheckMailResponse } from '@/lib/checkmail/types'

// KUMANI CheckMail: analisi di un'email sospetta (file .eml/.msg, sorgente
// incollato, oppure mittente + testo dal telefono). L'email è analizzata in
// memoria e NON viene salvata; nel database si conta solo quante analisi fa
// ciascuno al giorno. Se è configurata la chiave di Claude, il testo viene
// letto anche dall'IA (Anthropic) per le truffe senza segnali tecnici.

export const runtime = 'nodejs'
export const maxDuration = 45

// Vercel accetta richieste fino a circa 4,5 MB
const MAX_FILE_BYTES = 4 * 1024 * 1024
const MAX_TEXT_CHARS = 400_000
const LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

function reply(result: CheckMailResponse, status = 200) {
  return NextResponse.json(result, { status })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return reply({ status: 'not_allowed' }, 401)
  if (!(await hasActiveToolAccess(supabase, user.id, 'checkmail'))) return reply({ status: 'not_allowed' }, 403)

  // Lettura dell'input: file, sorgente incollato o mittente + testo
  let raw: string | ArrayBuffer = ''
  let sender = ''
  let subject = ''
  let text = ''
  let locale = 'it'
  try {
    const form = await request.formData()
    locale = LOCALES.includes(String(form.get('locale'))) ? String(form.get('locale')) : 'it'
    const file = form.get('file')
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) return reply({ status: 'too_large' })
      const bytes = await file.arrayBuffer()
      // .eml passato come byte: il parser rispetta la codifica dichiarata
      raw = file.name.toLowerCase().endsWith('.msg') ? msgToEml(bytes) : bytes
    } else {
      raw = String(form.get('raw') ?? '')
      sender = String(form.get('sender') ?? '').slice(0, 300)
      subject = String(form.get('subject') ?? '').slice(0, 500)
      text = String(form.get('text') ?? '')
    }
  } catch {
    return reply({ status: 'unreadable' })
  }
  // Il tetto in caratteri vale per il testo incollato; i file hanno quello in MB
  if ((typeof raw === 'string' && raw.length > MAX_TEXT_CHARS) || text.length > MAX_TEXT_CHARS) return reply({ status: 'too_large' })
  const hasRaw = typeof raw === 'string' ? raw.trim().length > 0 : raw.byteLength > 0
  if (!hasRaw && !text.trim()) return reply({ status: 'empty' })

  // Limite giornaliero
  const { data: reservation } = await supabase.rpc('checkmail_reserve')
  const reserved = reservation as { result?: string; left_today?: number } | null
  if (reserved?.result === 'not_allowed') return reply({ status: 'not_allowed' }, 403)
  if (reserved?.result === 'user_limit') return reply({ status: 'user_limit', leftToday: 0 })
  if (reserved?.result !== 'ok') return reply({ status: 'error' })
  const leftToday = reserved.left_today ?? 0

  try {
    // Controlli locali (veloci), poi rete e IA in parallelo
    let verdict = await analyzeEmail(hasRaw ? { raw } : { text, sender, subject }, { network: false })

    let aiAvailable = true
    const wantsAi = verdict.textSample.length > 20 || !!verdict.summary.subject
    const [netFindings, ai] = await Promise.all([
      networkFindings(verdict.summary).catch(() => []),
      wantsAi
        ? assessWithAi(verdict, locale).catch((error: unknown) => {
            // Un errore dell'IA non blocca il risultato dei controlli tecnici
            aiAvailable = false
            if (!(error instanceof MissingApiKeyError)) console.error('[checkmail] AI error:', error instanceof Error ? error.message : 'unknown')
            return null
          })
        : Promise.resolve<AiAssessment | null>(null),
    ])
    verdict = withFindings(verdict, netFindings)
    if (ai) verdict = applyAiAssessment(verdict, ai)

    await awardToolPoint('checkmail')
    return reply({
      status: 'ok',
      score: verdict.score,
      level: verdict.level,
      findings: verdict.findings,
      ai,
      aiAvailable,
      hasHeaders: verdict.summary.hasHeaders,
      leftToday,
    })
  } catch (error) {
    console.error('[checkmail] analysis failed:', error instanceof Error ? error.message : 'unknown')
    // Analisi non riuscita per un errore tecnico: si restituisce il controllo
    await service().rpc('checkmail_refund', { p_user: user.id })
    return reply({ status: 'unreadable', leftToday: leftToday + 1 })
  }
}
