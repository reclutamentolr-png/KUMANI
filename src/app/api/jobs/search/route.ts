import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { searchJobs } from '@/lib/jobs/search'
import { jobSearchCost, readJobFilters, type JobSearchEvent } from '@/lib/jobs/types'

// Trova Lavoro: la ricerca avanza per passi (fonti, doppioni, filtri,
// controllo anti-truffa, ordinamento) e ogni passo arriva subito alla
// pagina come una riga JSON, così l'utente vede l'avanzamento.

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'trova-lavoro'))) {
    return NextResponse.json({ type: 'error', code: 'forbidden' } satisfies JobSearchEvent, { status: 403 })
  }

  const filters = readJobFilters(((await request.json().catch(() => ({}))) ?? {}) as Record<string, unknown>)
  if (!filters) return NextResponse.json({ type: 'error', code: 'invalid' } satisfies JobSearchEvent, { status: 400 })

  // La fonte vuole sapere chi sta cercando: indirizzo IP e browser dell'utente
  const caller = {
    ip: (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || request.headers.get('x-real-ip') || '127.0.0.1',
    userAgent: request.headers.get('user-agent') || 'Mozilla/5.0',
  }

  // Credito settimanale in pagine: si prenota il costo massimo della ricerca,
  // alla fine si paga solo quello usato
  const cost = jobSearchCost(filters)
  const { data: claim, error: claimError } = await supabase.rpc('claim_job_search', { p_pages: cost })
  const claimed = claim as { ok: boolean; run_id?: string; limit: number | null; used?: number; next_at: string | null } | null
  if (claimError || !claimed) {
    console.error('[trova-lavoro] limite non verificabile:', claimError?.message)
    return NextResponse.json({ type: 'error', code: 'failed' } satisfies JobSearchEvent, { status: 500 })
  }
  if (!claimed.ok) {
    const quota = { used: claimed.used ?? claimed.limit ?? 0, limit: claimed.limit, nextAt: claimed.next_at }
    return NextResponse.json({ type: 'error', code: 'quota', quota } satisfies JobSearchEvent, { status: 429 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: JobSearchEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
      let gotResult = false
      const meter = { calls: 0 }
      send({ type: 'quota', quota: { used: claimed.used ?? cost, limit: claimed.limit, nextAt: claimed.next_at } })
      try {
        for await (const event of searchJobs(filters, caller, meter)) {
          if (event.type === 'result') gotResult = true
          send(event)
        }
      } catch (error) {
        console.error('[trova-lavoro] ricerca non riuscita:', error)
        send({ type: 'error', code: 'failed' })
      } finally {
        // Rimborsi solo dal server (l'utente non può azzerarsi il credito):
        // nessun risultato per un problema della fonte = la ricerca non conta;
        // altrimenti si pagano solo le pagine davvero chieste alla fonte
        if (claimed.run_id && (!gotResult || meter.calls < cost)) {
          const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
          if (!gotResult) await service.rpc('refund_job_search_for', { p_run_id: claimed.run_id, p_user: user.id })
          else {
            const { error } = await service.rpc('settle_job_search_for', { p_run_id: claimed.run_id, p_user: user.id, p_pages: meter.calls })
            if (!error && claimed.used != null) {
              send({ type: 'quota', quota: { used: Math.max(claimed.used - (cost - Math.max(meter.calls, 1)), 0), limit: claimed.limit, nextAt: claimed.next_at } })
            }
          }
        }
        controller.close()
      }
    },
  })
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' } })
}
