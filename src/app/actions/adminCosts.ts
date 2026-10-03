'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { getAdminFinancialSummary } from '@/app/actions/admin'
import { COST_CATEGORIES, type CostCategory, type CostFrequency } from '@/lib/platformCosts'

// Admin → Costi e margini: costi fissi (mensili, annuali, una tantum), spese
// variabili registrate a mano e i costi calcolati in automatico (commissioni
// Stripe, provvigioni, donazioni, voucher usati), con il margine.

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })


export type PlatformCost = {
  id: string
  name: string
  provider: string | null
  category: CostCategory
  amount_cents: number
  frequency: CostFrequency
  start_date: string
  end_date: string | null
  notes: string | null
}

export type PlatformExpense = {
  id: string
  description: string
  category: CostCategory
  amount_cents: number
  spent_on: string
  notes: string | null
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const today = () => new Date().toISOString().slice(0, 10)

// Mesi (o anni) iniziati tra la data di inizio e oggi (o la fine)
function accrued(cost: PlatformCost, until: string) {
  if (cost.start_date > until) return 0
  const end = cost.end_date && cost.end_date < until ? cost.end_date : until
  const [y1, m1] = cost.start_date.split('-').map(Number)
  const [y2, m2] = end.split('-').map(Number)
  const months = (y2 - y1) * 12 + (m2 - m1) + 1
  if (cost.frequency === 'one_off') return cost.amount_cents
  if (cost.frequency === 'yearly') return cost.amount_cents * Math.ceil(months / 12)
  return cost.amount_cents * months
}

const isActiveOn = (cost: PlatformCost, day: string) => cost.start_date <= day && (!cost.end_date || cost.end_date >= day)

export async function adminListCosts() {
  if (!(await verifyAdmin('stats.read'))) return null
  const [{ data: costs }, { data: expenses }] = await Promise.all([
    db().from('platform_costs').select('id, name, provider, category, amount_cents, frequency, start_date, end_date, notes').order('created_at'),
    db().from('platform_expenses').select('id, description, category, amount_cents, spent_on, notes').order('spent_on', { ascending: false }).limit(300),
  ])
  return { costs: (costs ?? []) as PlatformCost[], expenses: (expenses ?? []) as PlatformExpense[] }
}

export async function adminSaveCost(input: Partial<PlatformCost> & { name: string }) {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato.' }
  const name = String(input.name ?? '').trim().slice(0, 80)
  if (!name) return { success: false, error: 'Scrivi il nome del costo.' }
  const row = {
    name,
    provider: input.provider?.trim().slice(0, 80) || null,
    category: COST_CATEGORIES.includes(input.category as CostCategory) ? input.category : 'altro',
    amount_cents: Math.max(0, Math.round(Number(input.amount_cents) || 0)),
    frequency: ['monthly', 'yearly', 'one_off'].includes(String(input.frequency)) ? input.frequency : 'monthly',
    start_date: input.start_date && DATE_RE.test(input.start_date) ? input.start_date : today(),
    end_date: input.end_date && DATE_RE.test(input.end_date) ? input.end_date : null,
    notes: input.notes?.trim().slice(0, 300) || null,
    updated_at: new Date().toISOString(),
  }
  if (row.end_date && row.end_date < row.start_date) return { success: false, error: 'La data di fine è prima di quella di inizio.' }
  const query = input.id ? db().from('platform_costs').update(row).eq('id', input.id) : db().from('platform_costs').insert(row)
  const { error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function adminDeleteCost(id: string) {
  if (!(await verifyAdmin('settings.write'))) return { success: false }
  const { error } = await db().from('platform_costs').delete().eq('id', id)
  return { success: !error }
}

export async function adminSaveExpense(input: Partial<PlatformExpense> & { description: string }) {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato.' }
  const description = String(input.description ?? '').trim().slice(0, 120)
  const amount = Math.round(Number(input.amount_cents) || 0)
  if (!description) return { success: false, error: 'Scrivi la descrizione della spesa.' }
  if (amount <= 0) return { success: false, error: 'Inserisci un importo maggiore di zero.' }
  const row = {
    description,
    category: COST_CATEGORIES.includes(input.category as CostCategory) ? input.category : 'altro',
    amount_cents: amount,
    spent_on: input.spent_on && DATE_RE.test(input.spent_on) ? input.spent_on : today(),
    notes: input.notes?.trim().slice(0, 300) || null,
  }
  const query = input.id ? db().from('platform_expenses').update(row).eq('id', input.id) : db().from('platform_expenses').insert(row)
  const { error } = await query
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function adminDeleteExpense(id: string) {
  if (!(await verifyAdmin('settings.write'))) return { success: false }
  const { error } = await db().from('platform_expenses').delete().eq('id', id)
  return { success: !error }
}

// Riepilogo: costi fissi e variabili, costi automatici, margine e impegni
export async function adminCostsSummary() {
  if (!(await verifyAdmin('stats.read'))) return null
  const list = await adminListCosts()
  if (!list) return null
  const day = today()
  const thisMonth = day.slice(0, 7)

  const fixedAccrued = list.costs.reduce((sum, c) => sum + accrued(c, day), 0)
  const active = list.costs.filter((c) => isActiveOn(c, day))
  const monthlyRun = active.reduce((sum, c) => sum + (c.frequency === 'monthly' ? c.amount_cents : c.frequency === 'yearly' ? Math.round(c.amount_cents / 12) : 0), 0)
  const yearlyRun = active.reduce((sum, c) => sum + (c.frequency === 'monthly' ? c.amount_cents * 12 : c.frequency === 'yearly' ? c.amount_cents : 0), 0)
  const variableTotal = list.expenses.reduce((sum, e) => sum + e.amount_cents, 0)
  const variableThisMonth = list.expenses.filter((e) => e.spent_on.startsWith(thisMonth)).reduce((sum, e) => sum + e.amount_cents, 0)
  const toComplete = list.costs.filter((c) => c.amount_cents === 0).length

  // Incassi e costi automatici dall'Amministrazione (Stripe, voucher, punti…)
  const f = await getAdminFinancialSummary().catch(() => null)
  const fin = f && 'success' in f && f.success ? f : null

  const revenueNet = fin ? fin.taxable : 0
  const agents = fin ? fin.agentCommissions.pending + fin.agentCommissions.matured + fin.agentCommissions.paid : 0
  const donations = fin ? fin.donations.subscriptionCents + fin.donations.pointsCents : 0
  const operating = revenueNet - fixedAccrued - variableTotal - agents - donations
  const structure = fin ? fin.giftedServicesCents : 0

  return {
    available: Boolean(fin),
    testMode: fin?.testMode ?? false,
    vatRate: fin?.vatRate ?? 22,
    cashIn: fin?.cashIn ?? 0,
    revenueNet,
    stripeFees: fin?.stripe.fees ?? 0,
    fixedAccrued,
    monthlyRun,
    yearlyRun,
    variableTotal,
    variableThisMonth,
    agents,
    donations,
    operating,
    structure,
    afterStructure: operating - structure,
    commitments: {
      vouchersUnused: fin?.kumanoVouchers.activeCents ?? 0,
      voucherCredit: fin?.voucherCreditCents ?? 0,
      pointsMax: fin?.networkPointsMaxCents ?? 0,
      points: fin?.networkPointsOutstanding ?? 0,
      agentsDue: fin?.agentDue ?? 0,
      donationsDue: fin ? Math.max(fin.donations.subscriptionCents + fin.donations.pointsCents - fin.donations.paidCents, 0) : 0,
    },
    toComplete,
  }
}
