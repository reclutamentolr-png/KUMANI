import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { searchJobs } from '@/lib/jobs/search'
import { DEFAULT_FILTERS, isJobCountry, type JobFilters, type JobSearchEvent } from '@/lib/jobs/types'

// Trova Lavoro: la ricerca avanza per passi (fonti, doppioni, filtri,
// controllo anti-truffa, ordinamento) e ogni passo arriva subito alla
// pagina come una riga JSON, così l'utente vede l'avanzamento.

export const runtime = 'nodejs'
export const maxDuration = 120

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback
const text = (value: unknown, max: number) => String(value ?? '').slice(0, max).trim()
const num = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

function readFilters(body: Record<string, unknown>): JobFilters | null {
  if (!isJobCountry(body.country)) return null
  const keywords = text(body.keywords, 80)
  if (keywords.length < 2) return null
  return {
    country: body.country,
    keywords,
    synonyms: text(body.synonyms, 200),
    location: text(body.location, 80),
    radiusKm: num(body.radiusKm, 0, 200, DEFAULT_FILTERS.radiusKm),
    contract: pick(body.contract, ['any', 'permanent', 'contract', 'temporary', 'internship'] as const, 'any'),
    hours: pick(body.hours, ['any', 'full', 'part'] as const, 'any'),
    minSalary: num(body.minSalary, 0, 10_000_000, 0),
    includeNoSalary: body.includeNoSalary !== false,
    postedDays: num(body.postedDays, 0, 60, 0),
    remoteOnly: body.remoteOnly === true,
    exclude: text(body.exclude, 200),
    hideSuspicious: body.hideSuspicious === true,
    depth: pick(body.depth, ['quick', 'deep', 'max'] as const, 'deep'),
    sort: pick(body.sort, ['relevance', 'date', 'salary'] as const, 'relevance'),
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'trova-lavoro'))) {
    return NextResponse.json({ type: 'error', code: 'forbidden' } satisfies JobSearchEvent, { status: 403 })
  }

  const filters = readFilters(((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>)
  if (!filters) return NextResponse.json({ type: 'error', code: 'invalid' } satisfies JobSearchEvent, { status: 400 })

  // La fonte vuole sapere chi sta cercando: indirizzo IP e browser dell'utente
  const caller = {
    ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || request.headers.get('x-real-ip') || '127.0.0.1',
    userAgent: request.headers.get('user-agent') || 'Mozilla/5.0',
  }

  // Limite di ricerche a settimana: la ricerca si registra prima di partire
  const { data: claim, error: claimError } = await supabase.rpc('claim_job_search')
  const claimed = claim as { ok: boolean; run_id?: string; limit: number | null; used?: number; next_at: string | null } | null
  if (claimError || !claimed) {
    console.error('[trova-lavoro] limite non verificabile:', claimError?.message)
    return NextResponse.json({ type: 'error', code: 'failed' } satisfies JobSearchEvent, { status: 500 })
  }
  if (!claimed.ok) {
    const quota = { used: claimed.limit ?? 0, limit: claimed.limit, nextAt: claimed.next_at }
    return NextResponse.json({ type: 'error', code: 'quota', quota } satisfies JobSearchEvent, { status: 429 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: JobSearchEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      let gotResult = false
      send({ type: 'quota', quota: { used: claimed.used ?? 1, limit: claimed.limit, nextAt: claimed.next_at } })
      try {
        for await (const event of searchJobs(filters, caller)) {
          if (event.type === 'result') gotResult = true
          send(event)
        }
      } catch (error) {
        console.error('[trova-lavoro] ricerca non riuscita:', error)
        send({ type: 'error', code: 'failed' })
      } finally {
        // Nessun risultato per un problema della fonte: la ricerca non conta
        if (!gotResult && claimed.run_id) {
          // Rimborso solo dal server (l'utente non può azzerarsi il limite)
          const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
          await service.rpc('refund_job_search_for', { p_run_id: claimed.run_id, p_user: user.id })
        }
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } })
}
