// Spendly · Spese condivise: tipi e calcoli comuni a pagine, azioni e PDF.
// Il saldo «chi deve quanto a chi» usa lo stesso motore di KUMANI Travel
// (centesimi, quote uguali, resto ai primi della lista, rimborsi minimi).
import { memberBalances, settleUp } from '@/lib/travel'

export const SHARED_CATEGORIES = ['casa', 'bollette', 'spesa_alimentari', 'svago_ristoranti', 'trasporti', 'salute', 'figli', 'altro'] as const
export type SharedCategory = (typeof SHARED_CATEGORIES)[number]
export const isSharedCategory = (value: unknown): value is SharedCategory => SHARED_CATEGORIES.includes(value as SharedCategory)

export const SHARED_CATEGORY_EMOJI: Record<SharedCategory, string> = {
  casa: '🏠',
  bollette: '💡',
  spesa_alimentari: '🛒',
  svago_ristoranti: '🍕',
  trasporti: '🚗',
  salute: '💊',
  figli: '🧸',
  altro: '💶',
}

export const GROUP_EMOJIS = ['🏠', '👨‍👩‍👧', '❤️', '🛋️', '🏡', '🧑‍🤝‍🧑', '🐶', '🎓']

export type SharedMember = { id: string; name: string; role: 'owner' | 'member'; is_me: boolean }

export type SharedGroup = {
  id: string
  name: string
  emoji: string
  invite_code: string
  is_owner: boolean
  my_member_id: string
  members: SharedMember[]
}

export type SharedGroupSummary = { id: string; name: string; emoji: string; is_owner: boolean; members: number }

export type SharedExpense = {
  id: string
  paid_by: string
  amount: number
  category: SharedCategory
  description: string
  spent_on: string
  split_between: string[]
  recurring_id: string | null
}

export type SharedRecurring = {
  id: string
  description: string
  amount: number
  category: SharedCategory
  paid_by: string
  split_between: string[]
  day_of_month: number
  next_period: string
  ends_on: string | null
  // Bolletta di KUMANI Casa / Spendly da cui nasce (null = creata nel gruppo) e ogni quanti mesi
  spendly_fixed_id: string | null
  every_months: number
}

export type SharedSettlement = { id: string; from_member: string; to_member: string; amount: number; settled_on: string }

// Saldo di ogni membro in centesimi (positivo = deve ricevere) e rimborsi minimi
export function sharedBalances(expenses: Pick<SharedExpense, 'amount' | 'paid_by' | 'split_between'>[], settlements: SharedSettlement[]) {
  const balances = memberBalances(
    expenses.map((e) => ({ amount: Number(e.amount), rate_to_base: 1, paid_by: e.paid_by, split_between: e.split_between })),
    settlements.map((s) => ({ ...s, amount: Number(s.amount) }))
  )
  return { balances, transfers: settleUp(balances) }
}

// Quota di una persona in una spesa (quote uguali; i centesimi che avanzano ai primi)
export function shareOf(expense: Pick<SharedExpense, 'amount' | 'split_between'>, memberId: string): number {
  const people = [...new Set(expense.split_between)]
  const index = people.indexOf(memberId)
  if (index < 0) return 0
  const total = Math.round(Number(expense.amount) * 100)
  const share = Math.floor(total / people.length)
  const rest = total - share * people.length
  return (share + (index < rest ? 1 : 0)) / 100
}

export type MonthSummary = {
  total: number
  byCategory: { category: SharedCategory; amount: number }[]
  byMember: { id: string; paid: number; share: number }[]
}

export function summarize(expenses: SharedExpense[], members: SharedMember[]): MonthSummary {
  const byCategory = new Map<SharedCategory, number>()
  const paid = new Map<string, number>()
  const share = new Map<string, number>()
  let total = 0
  for (const e of expenses) {
    const amount = Number(e.amount)
    total += amount
    byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + amount)
    paid.set(e.paid_by, (paid.get(e.paid_by) ?? 0) + amount)
    for (const id of new Set(e.split_between)) share.set(id, (share.get(id) ?? 0) + shareOf(e, id))
  }
  return {
    total: Math.round(total * 100) / 100,
    byCategory: [...byCategory].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    byMember: members.map((m) => ({ id: m.id, paid: paid.get(m.id) ?? 0, share: share.get(m.id) ?? 0 })),
  }
}

// 'YYYY-MM' → primo e ultimo giorno del mese
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` }
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export const isMonthKey = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
