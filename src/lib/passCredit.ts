import { createClient as createServiceClient } from '@supabase/supabase-js'
import { TOOL_PASS_DAYS } from '@/lib/toolPasses'

// Credito dei Pass quando si passa a un piano (Base o Pro): la parte non
// ancora usata dei Pass pagati per servizi inclusi nel nuovo piano viene
// scalata dal primo pagamento, e quei Pass terminano (il piano li sostituisce).

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const PLAN_RANK: Record<string, number> = { free: 0, base: 1, pro: 2 }
const DAY_MS = 86_400_000

export type PassCredit = { cents: number; passIds: string[]; tools: string[] }

export async function computePassCredit(userId: string, plan: 'base' | 'pro'): Promise<PassCredit> {
  const db = service()
  const now = Date.now()
  const { data: passes } = await db
    .from('tool_passes')
    .select('id, tool, expires_at, amount_cents')
    .eq('user_id', userId)
    .eq('source', 'stripe')
    .is('revoked_at', null)
    .is('converted_at', null)
    .gt('amount_cents', 0)
    .gt('expires_at', new Date(now).toISOString())
  if (!passes?.length) return { cents: 0, passIds: [], tools: [] }

  const { data: settings } = await db.from('marketplace_settings').select('tool_name, required_plan').in('tool_name', [...new Set(passes.map((p) => p.tool as string))])
  const required = new Map((settings ?? []).map((s) => [s.tool_name as string, (s.required_plan as string) ?? 'base']))

  let cents = 0
  const passIds: string[] = []
  const tools = new Set<string>()
  for (const p of passes) {
    // Solo i servizi che il nuovo piano include
    if ((PLAN_RANK[required.get(p.tool as string) ?? 'pro'] ?? 2) > PLAN_RANK[plan]) continue
    // Ogni acquisto copre un anno che finisce a expires_at: si rimborsa la parte futura
    const end = new Date(p.expires_at as string).getTime()
    const start = end - TOOL_PASS_DAYS * DAY_MS
    const unused = Math.min(Math.max((end - Math.max(now, start)) / (TOOL_PASS_DAYS * DAY_MS), 0), 1)
    const value = Math.floor((p.amount_cents as number) * unused)
    if (value <= 0) continue
    cents += value
    passIds.push(p.id as string)
    tools.add(p.tool as string)
  }
  return { cents, passIds, tools: [...tools] }
}

// Piano attivato con il credito: i Pass usati per lo sconto terminano ora
export async function convertCreditedPasses(userId: string, passIds: string[]): Promise<void> {
  if (!passIds.length) return
  const now = new Date().toISOString()
  const { error } = await service()
    .from('tool_passes')
    .update({ converted_at: now, expires_at: now })
    .eq('user_id', userId)
    .in('id', passIds)
    .is('converted_at', null)
  if (error) console.error('⚠️ Pass non chiusi dopo il passaggio al piano:', error.message)
}

// Primo pagamento del piano andato a buon fine (webhook invoice.paid): i Pass
// scalati con il credito terminano (dati salvati sull'abbonamento al checkout)
export async function convertPassesFromInvoice(invoice: { billing_reason?: string | null; subscription_details?: { metadata?: Record<string, string> | null } | null }): Promise<void> {
  if (invoice.billing_reason !== 'subscription_create') return
  const meta = invoice.subscription_details?.metadata ?? {}
  if (!meta.userId || !meta.pass_ids) return
  await convertCreditedPasses(meta.userId, meta.pass_ids.split(',').filter(Boolean))
}
