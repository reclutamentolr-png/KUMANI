'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { agentRankingData, type AgentRanking } from '@/lib/agentRanking'
export type { AgentRanking }

// Statistiche e classifiche dell'area Admin (Amministrazione → Dettaglio):
// Pass dei singoli servizi, negozi con i lotti di voucher, agenti, voucher
// della community, donatori, KU Points e KU Karma. Solo lettura.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export type ReportPerson = { id: string; name: string; code: string | null; email: string | null }

type ProfileRow = { id: string; first_name: string | null; last_name: string | null; referral_code: string | null; email: string | null }

async function people(ids: string[]): Promise<Map<string, ReportPerson>> {
  const unique = [...new Set(ids.filter(Boolean))]
  const map = new Map<string, ReportPerson>()
  for (let i = 0; i < unique.length; i += 200) {
    const { data } = await db()
      .from('profiles')
      .select('id, first_name, last_name, referral_code, email')
      .in('id', unique.slice(i, i + 200))
    for (const p of (data ?? []) as ProfileRow[]) {
      map.set(p.id, { id: p.id, name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—', code: p.referral_code, email: p.email })
    }
  }
  return map
}

const unknownPerson = (id: string): ReportPerson => ({ id, name: '—', code: null, email: null })

// ---------- 1. Pass dei singoli servizi
export type PassReport = {
  byTool: { tool: string; title: string; sold: number; soldCents: number; codes: number; active: number }[]
  recent: { id: string; person: ReportPerson; title: string; source: string; amountCents: number; createdAt: string; expiresAt: string; revoked: boolean }[]
}

export async function adminReportPasses(): Promise<PassReport | { error: string }> {
  if (!(await verifyAdmin('stats.read'))) return { error: 'Non autorizzato' }
  const { data, error } = await db()
    .from('tool_passes')
    .select('id, user_id, tool, source, amount_cents, created_at, expires_at, revoked_at')
    .order('created_at', { ascending: false })
    .limit(2000)
  if (error) return { error: error.message }
  const t = await getTranslations({ locale: 'it', namespace: 'marketplace' })
  const titles = new Map(getMarketplaceTools((key) => t(key)).map((tool) => [tool.toolName, tool.title]))
  const now = Date.now()
  const byTool = new Map<string, PassReport['byTool'][number]>()
  for (const row of data ?? []) {
    const entry = byTool.get(row.tool) ?? { tool: row.tool, title: titles.get(row.tool) ?? row.tool, sold: 0, soldCents: 0, codes: 0, active: 0 }
    if (!row.revoked_at) {
      if (row.source === 'stripe') {
        entry.sold += 1
        entry.soldCents += row.amount_cents ?? 0
      } else entry.codes += 1
      if (new Date(row.expires_at).getTime() > now) entry.active += 1
    }
    byTool.set(row.tool, entry)
  }
  const persons = await people((data ?? []).slice(0, 200).map((row) => row.user_id))
  return {
    byTool: [...byTool.values()].sort((a, b) => b.sold + b.codes - (a.sold + a.codes) || b.soldCents - a.soldCents),
    recent: (data ?? []).slice(0, 200).map((row) => ({
      id: row.id,
      person: persons.get(row.user_id) ?? unknownPerson(row.user_id),
      title: titles.get(row.tool) ?? row.tool,
      source: row.source,
      amountCents: row.amount_cents ?? 0,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revoked: !!row.revoked_at,
    })),
  }
}

// ---------- 2. Negozi con i lotti di voucher
export type ShopReport = { business: string; batches: number; vouchers: number; redeemed: number; revenueCents: number; lastBatchAt: string }[]

export async function adminReportShops(): Promise<{ shops: ShopReport } | { error: string }> {
  if (!(await verifyAdmin('stats.read'))) return { error: 'Non autorizzato' }
  const [{ data: batches, error }, { data: vouchers }] = await Promise.all([
    db().from('voucher_batches').select('id, business_name, quantity, price_eur, created_at'),
    db().from('subscription_vouchers').select('batch_id, status').not('batch_id', 'is', null),
  ])
  if (error) return { error: error.message }
  const redeemedByBatch = new Map<string, number>()
  for (const v of vouchers ?? []) if (v.status === 'redeemed' && v.batch_id) redeemedByBatch.set(v.batch_id, (redeemedByBatch.get(v.batch_id) ?? 0) + 1)
  const shops = new Map<string, ShopReport[number]>()
  for (const b of batches ?? []) {
    const key = (b.business_name ?? '—').trim() || '—'
    const shop = shops.get(key.toLowerCase()) ?? { business: key, batches: 0, vouchers: 0, redeemed: 0, revenueCents: 0, lastBatchAt: b.created_at }
    shop.batches += 1
    shop.vouchers += b.quantity ?? 0
    shop.redeemed += redeemedByBatch.get(b.id) ?? 0
    shop.revenueCents += Math.round(Number(b.price_eur ?? 0) * 100)
    if (b.created_at > shop.lastBatchAt) shop.lastBatchAt = b.created_at
    shops.set(key.toLowerCase(), shop)
  }
  return { shops: [...shops.values()].sort((a, b) => b.redeemed - a.redeemed || b.vouchers - a.vouchers) }
}

// ---------- 3. Agenti per attivazioni
export async function adminReportAgents(): Promise<{ agents: AgentRanking } | { error: string }> {
  if (!(await verifyAdmin('stats.read'))) return { error: 'Non autorizzato' }
  return { agents: await agentRankingData() }
}

// ---------- 4. Voucher della community: i primi 20 per voucher attivati
export type VoucherRanking = { person: ReportPerson; created: number; redeemed: number; gifted: number; sold: number }[]

export async function adminReportCommunityVouchers(): Promise<{ top: VoucherRanking } | { error: string }> {
  if (!(await verifyAdmin('stats.read'))) return { error: 'Non autorizzato' }
  const { data, error } = await db()
    .from('subscription_vouchers')
    .select('created_by, status, purpose, code')
    .is('batch_id', null)
    .neq('status', 'revoked')
  if (error) return { error: error.message }
  const byUser = new Map<string, Omit<VoucherRanking[number], 'person'>>()
  for (const v of data ?? []) {
    if (!v.created_by || v.code?.startsWith('KVA-')) continue
    const entry = byUser.get(v.created_by) ?? { created: 0, redeemed: 0, gifted: 0, sold: 0 }
    entry.created += 1
    if (v.status === 'redeemed') entry.redeemed += 1
    if (v.purpose === 'sale') entry.sold += 1
    else entry.gifted += 1
    byUser.set(v.created_by, entry)
  }
  const ranked = [...byUser.entries()].sort((a, b) => b[1].redeemed - a[1].redeemed || b[1].created - a[1].created).slice(0, 20)
  const persons = await people(ranked.map(([id]) => id))
  return { top: ranked.map(([id, v]) => ({ person: persons.get(id) ?? unknownPerson(id), ...v })) }
}

// ---------- 5. Donatori: i primi 50 per donazioni
export type DonorRanking = { person: ReportPerson; points: number; donatedCents: number; donations: number; subscriptionCents: number }[]

export async function adminReportDonors(): Promise<{ top: DonorRanking } | { error: string }> {
  if (!(await verifyAdmin('stats.read'))) return { error: 'Non autorizzato' }
  const { data, error } = await db().from('donation_entries').select('user_id, source, points, amount_cents').is('reversed_at', null)
  if (error) return { error: error.message }
  const byUser = new Map<string, Omit<DonorRanking[number], 'person'>>()
  for (const d of data ?? []) {
    if (!d.user_id) continue
    const entry = byUser.get(d.user_id) ?? { points: 0, donatedCents: 0, donations: 0, subscriptionCents: 0 }
    if (d.source === 'points') {
      entry.points += d.points ?? 0
      entry.donatedCents += d.amount_cents ?? 0
      entry.donations += 1
    } else entry.subscriptionCents += d.amount_cents ?? 0
    byUser.set(d.user_id, entry)
  }
  const ranked = [...byUser.entries()]
    .filter(([, v]) => v.donations > 0)
    .sort((a, b) => b[1].donatedCents - a[1].donatedCents)
    .slice(0, 50)
  const persons = await people(ranked.map(([id]) => id))
  return { top: ranked.map(([id, v]) => ({ person: persons.get(id) ?? unknownPerson(id), ...v })) }
}

// ---------- 6. KU Points e KU Karma: i primi 100
export type PointsRanking = {
  person: ReportPerson
  joinedAt: string
  kuPointsEarned: number
  kuPointsBalance: number
  karmaEarned: number
  karmaBalance: number
  karmaUsed: number
}[]

export async function adminReportPoints(): Promise<{ top: PointsRanking } | { error: string }> {
  if (!(await verifyAdmin('stats.read'))) return { error: 'Non autorizzato' }
  const { data, error } = await db()
    .from('profiles')
    .select('id, first_name, last_name, referral_code, email, created_at, network_points, network_points_earned_total, daily_points, ku_earned_total')
    .order('network_points_earned_total', { ascending: false, nullsFirst: false })
    .order('ku_earned_total', { ascending: false, nullsFirst: false })
    .limit(100)
  if (error) return { error: error.message }
  return {
    top: (data ?? []).map((p) => {
      const karmaEarned = p.ku_earned_total ?? 0
      const karmaBalance = p.daily_points ?? 0
      return {
        person: { id: p.id, name: `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—', code: p.referral_code, email: p.email },
        joinedAt: p.created_at,
        kuPointsEarned: p.network_points_earned_total ?? 0,
        kuPointsBalance: p.network_points ?? 0,
        karmaEarned,
        karmaBalance,
        karmaUsed: Math.max(0, karmaEarned - karmaBalance),
      }
    }),
  }
}
