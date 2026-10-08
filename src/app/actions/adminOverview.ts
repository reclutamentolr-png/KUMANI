'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getStripe } from '@/lib/stripe'

// Admin → Panoramica: utenti per piano, servizi più usati per fascia
// (Gratis / Base / Pro), abbonamenti pagati oggi / in settimana / nel mese
// e attivazioni con voucher. Solo lettura.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export type OverviewTool = { tool: string; title: string; users: number; useDays: number }
export type PaidPeriod = { count: number; cents: number; newCount: number; renewalCount: number }
export type AdminOverview = {
  users: { free: number; base: number; pro: number; blocked: number; total: number; proTrial: number }
  tools: { free: OverviewTool[]; base: OverviewTool[]; pro: OverviewTool[]; days: number }
  paid: { today: PaidPeriod; week: PaidPeriod; month: PaidPeriod; error: boolean }
  vouchers: {
    plans: { redeemed: number; available: number }
    passes: { redeemed: number; available: number }
  }
}

const USAGE_DAYS = 30
// Servizi che non stanno nell'elenco del marketplace (nomi per l'Admin)
const EXTRA_TITLES: Record<string, string> = {
  events: 'Kuman Events',
  chat: 'Chat',
  convivio: 'Convivio',
  listings: 'Bacheca annunci',
  spotlight: 'Spotlight',
  timebank: 'Banca del tempo',
}

// Mezzanotte di Roma (in secondi) per oggi, lunedì di questa settimana e il
// primo del mese
function romeStarts() {
  const now = new Date()
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  )
  const rome = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Rome' }))
  const utc = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }))
  const offset = rome.getTime() - utc.getTime()
  const y = Number(parts.year)
  const m = Number(parts.month) - 1
  const d = Number(parts.day)
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday)
  const at = (yy: number, mm: number, dd: number) => Math.floor((Date.UTC(yy, mm, dd) - offset) / 1000)
  return { today: at(y, m, d), week: at(y, m, d - Math.max(weekday, 0)), month: at(y, m, 1) }
}

const emptyPeriod = (): PaidPeriod => ({ count: 0, cents: 0, newCount: 0, renewalCount: 0 })

export async function adminOverview(): Promise<AdminOverview | null> {
  const admin = await verifyAdmin('stats.read')
  if (!admin) return null
  const service = db()
  const nowIso = new Date().toISOString()
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0
  const activeNow = `subscription_expires_at.is.null,subscription_expires_at.gt.${nowIso}`
  // Gli ospiti in prova (codici di prova) non sono utenti registrati
  const profiles = () => service.from('profiles').select('id', { count: 'exact', head: true }).is('guest_until', null)

  // ---- Utenti
  const [total, blocked, base, pro, proTrial] = await Promise.all([
    count(profiles()),
    count(profiles().eq('is_blocked', true)),
    count(profiles().eq('is_blocked', false).eq('subscription_status', 'active').neq('subscription_plan', 'pro').or(activeNow)),
    count(profiles().eq('is_blocked', false).eq('subscription_status', 'active').eq('subscription_plan', 'pro').or(activeNow)),
    count(profiles().eq('is_blocked', false).gt('pro_trial_ends_at', nowIso).or(`subscription_status.neq.active,subscription_plan.neq.pro`)),
  ])
  const free = Math.max(total - blocked - base - pro, 0)

  // ---- Servizi più usati per fascia (persone diverse negli ultimi 30 giorni)
  const t = await getTranslations({ locale: 'it', namespace: 'marketplace' })
  const titles = new Map(getMarketplaceTools(t).map((tool) => [tool.toolName, tool.title]))
  const [{ data: usage }, { data: settings }] = await Promise.all([
    service.rpc('admin_tool_usage', { p_days: USAGE_DAYS }),
    service.from('marketplace_settings').select('tool_name, required_plan, is_enabled'),
  ])
  const usageMap = new Map(((usage ?? []) as { tool_name: string; users: number; use_days: number }[]).map((u) => [u.tool_name, u]))
  const band = (plan: 'free' | 'base' | 'pro'): OverviewTool[] =>
    (settings ?? [])
      .filter((s) => s.required_plan === plan && s.is_enabled !== false)
      .map((s) => {
        const u = usageMap.get(s.tool_name)
        return {
          tool: s.tool_name,
          title: titles.get(s.tool_name) ?? EXTRA_TITLES[s.tool_name] ?? s.tool_name,
          users: Number(u?.users ?? 0),
          useDays: Number(u?.use_days ?? 0),
        }
      })
      .filter((t) => t.users > 0)
      .sort((a, b) => b.users - a.users || b.useDays - a.useDays || a.title.localeCompare(b.title))
      .slice(0, 5)

  // ---- Abbonamenti pagati (fatture Stripe pagate: nuovi, passaggi a Pro, rinnovi)
  const starts = romeStarts()
  const paid = { today: emptyPeriod(), week: emptyPeriod(), month: emptyPeriod(), error: false }
  try {
    const { data: sinceRow } = await service.from('system_settings').select('value').eq('key', 'finance_stats_since').maybeSingle()
    const sinceIso = String(sinceRow?.value ?? '').replace(/"/g, '')
    const statsSince = sinceIso && !Number.isNaN(Date.parse(sinceIso)) ? Math.floor(Date.parse(sinceIso) / 1000) : 0
    const from = Math.min(starts.week, starts.month)
    const stripe = getStripe()
    let startingAfter: string | undefined
    for (let page = 0; page < 20; page++) {
      const list = await stripe.invoices.list({ status: 'paid', limit: 100, created: { gte: Math.max(from, statsSince) }, ...(startingAfter ? { starting_after: startingAfter } : {}) })
      for (const invoice of list.data) {
        if (!invoice.amount_paid || !invoice.billing_reason?.startsWith('subscription')) continue
        const paidAt = invoice.status_transitions?.paid_at ?? invoice.created
        const renewal = invoice.billing_reason === 'subscription_cycle'
        for (const [key, start] of [['today', starts.today], ['week', starts.week], ['month', starts.month]] as const) {
          if (paidAt < start || paidAt < statsSince) continue
          const p = paid[key]
          p.count += 1
          p.cents += invoice.amount_paid
          if (renewal) p.renewalCount += 1
          else p.newCount += 1
        }
      }
      if (!list.has_more || list.data.length === 0) break
      startingAfter = list.data[list.data.length - 1].id
    }
  } catch (err) {
    console.error('[admin overview] Stripe:', err instanceof Error ? err.message : err)
    paid.error = true
  }

  // ---- Voucher: abbonamenti (voucher + regali di Base/Pro) e servizi singoli (codici Pass + regali di Pass)
  const [vRedeemed, vActive, giftPlanRedeemed, giftPlanOpen, passFromCodes, passCodesOpen, giftPassOpen] = await Promise.all([
    count(service.from('subscription_vouchers').select('id', { count: 'exact', head: true }).eq('status', 'redeemed')),
    count(service.from('subscription_vouchers').select('id', { count: 'exact', head: true }).eq('status', 'active')),
    count(service.from('gift_codes').select('code, gift_orders!inner(kind)', { count: 'exact', head: true }).eq('gift_orders.kind', 'plan').not('redeemed_at', 'is', null)),
    count(service.from('gift_codes').select('code, gift_orders!inner(kind)', { count: 'exact', head: true }).eq('gift_orders.kind', 'plan').is('redeemed_at', null).is('revoked_at', null).gt('valid_until', nowIso)),
    count(service.from('tool_passes').select('id', { count: 'exact', head: true }).in('source', ['code', 'gift'])),
    count(service.from('tool_pass_codes').select('code', { count: 'exact', head: true }).is('redeemed_at', null)),
    count(service.from('gift_codes').select('code, gift_orders!inner(kind)', { count: 'exact', head: true }).eq('gift_orders.kind', 'pass').is('redeemed_at', null).is('revoked_at', null).gt('valid_until', nowIso)),
  ])

  return {
    users: { free, base, pro, blocked, total, proTrial },
    tools: { free: band('free'), base: band('base'), pro: band('pro'), days: USAGE_DAYS },
    paid,
    vouchers: {
      plans: { redeemed: vRedeemed + giftPlanRedeemed, available: vActive + giftPlanOpen },
      passes: { redeemed: passFromCodes, available: passCodesOpen + giftPassOpen },
    },
  }
}
