'use server'

import { createClient } from '@/lib/supabase/server'
import { limitError } from '@/lib/appLimits'
import { awardToolPoint } from '@/lib/toolPoints'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { isSharedCategory, type SharedExpense, type SharedMember, type SharedCategory } from '@/lib/spendlyShared'

// Spendly · Spese condivise. Le regole del database decidono chi vede e
// modifica cosa (solo i membri del gruppo); qui si controllano i dati.

type Result<T = undefined> = { success: true; data?: T } | { success: false; message: string; limitText?: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f-]{36}$/i

async function me() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { supabase, userId: user.id } : null
}

const cleanAmount = (value: unknown) => {
  const n = Math.round(Number(value) * 100) / 100
  return Number.isFinite(n) && n > 0 && n <= 1000000 ? n : null
}
const cleanText = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')
const cleanMembers = (value: unknown) =>
  Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && UUID.test(v)))].slice(0, 12) : []

export async function createSharedGroup(name: string, emoji: string): Promise<Result<{ id: string }>> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  if (!cleanText(name, 60)) return { success: false, message: 'invalid' }
  const { data, error } = await g.supabase.rpc('spendly_group_create', { p_name: cleanText(name, 60), p_emoji: cleanText(emoji, 8) })
  if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  const res = data as { id?: string; error?: string }
  return res.id ? { success: true, data: { id: res.id } } : { success: false, message: res.error ?? 'saveError' }
}

export async function joinSharedGroup(code: string): Promise<Result<{ id: string }>> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const { data, error } = await g.supabase.rpc('spendly_group_join', { p_code: cleanText(code, 12) })
  if (error) return { success: false, message: 'saveError' }
  const res = data as { id?: string; error?: string }
  return res.id ? { success: true, data: { id: res.id } } : { success: false, message: res.error ?? 'saveError' }
}

export type SharedExpenseForm = {
  description: string
  amount: number
  category: SharedCategory
  spentOn: string
  paidBy: string
  splitBetween: string[]
}

export async function addSharedExpense(groupId: string, form: SharedExpenseForm): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const amount = cleanAmount(form.amount)
  const description = cleanText(form.description, 120)
  const split = cleanMembers(form.splitBetween)
  if (!UUID.test(groupId) || !amount || !description || !DATE.test(form.spentOn) || !UUID.test(form.paidBy) || !split.length || !isSharedCategory(form.category))
    return { success: false, message: 'invalid' }
  const { error } = await g.supabase.from('spendly_group_expenses').insert({
    group_id: groupId,
    paid_by: form.paidBy,
    amount,
    category: form.category,
    description,
    spent_on: form.spentOn,
    split_between: split,
    created_by: g.userId,
  })
  if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  await awardToolPoint('spendly')
  return { success: true }
}

export async function updateSharedExpense(expenseId: string, form: SharedExpenseForm): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const amount = cleanAmount(form.amount)
  const description = cleanText(form.description, 120)
  const split = cleanMembers(form.splitBetween)
  if (!UUID.test(expenseId) || !amount || !description || !DATE.test(form.spentOn) || !UUID.test(form.paidBy) || !split.length || !isSharedCategory(form.category))
    return { success: false, message: 'invalid' }
  const { data, error } = await g.supabase
    .from('spendly_group_expenses')
    .update({ paid_by: form.paidBy, amount, category: form.category, description, spent_on: form.spentOn, split_between: split })
    .eq('id', expenseId)
    .select('id')
  if (error || !data?.length) return { success: false, message: 'saveError' }
  return { success: true }
}

export async function deleteSharedExpense(expenseId: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const { error } = await g.supabase.from('spendly_group_expenses').delete().eq('id', expenseId)
  return error ? { success: false, message: 'saveError' } : { success: true }
}

export type SharedRecurringForm = Omit<SharedExpenseForm, 'spentOn'> & { dayOfMonth: number; fromMonth: string }

// Spesa fissa (affitto, bollette…): dal mese indicato, ogni mese il giorno scelto
export async function addSharedRecurring(groupId: string, form: SharedRecurringForm): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const amount = cleanAmount(form.amount)
  const description = cleanText(form.description, 120)
  const split = cleanMembers(form.splitBetween)
  const day = Math.trunc(Number(form.dayOfMonth))
  if (!UUID.test(groupId) || !amount || !description || !UUID.test(form.paidBy) || !split.length || !isSharedCategory(form.category) || !(day >= 1 && day <= 31) || !/^\d{4}-\d{2}$/.test(form.fromMonth))
    return { success: false, message: 'invalid' }
  const { error } = await g.supabase.from('spendly_group_recurring').insert({
    group_id: groupId,
    description,
    amount,
    category: form.category,
    paid_by: form.paidBy,
    split_between: split,
    day_of_month: day,
    next_period: `${form.fromMonth}-01`,
    created_by: g.userId,
  })
  if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  await g.supabase.rpc('spendly_group_run_recurring', { p_group: groupId })
  return { success: true }
}

// KUMANI Casa: una mia bolletta (spesa fissa di Spendly) diventa una spesa
// fissa del gruppo, con la sua frequenza, pagata da me e divisa tra tutti
export async function linkBillToGroup(groupId: string, billId: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  if (!UUID.test(groupId) || !UUID.test(billId)) return { success: false, message: 'invalid' }
  const { data, error } = await g.supabase.rpc('spendly_group_link_bill', { p_group: groupId, p_fixed: billId })
  if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  const res = data as { id?: string; error?: string }
  return res.id ? { success: true } : { success: false, message: res.error ?? 'saveError' }
}

// Si ferma: le spese già registrate restano
export async function deleteSharedRecurring(recurringId: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const { error } = await g.supabase.from('spendly_group_recurring').delete().eq('id', recurringId)
  return error ? { success: false, message: 'saveError' } : { success: true }
}

export async function addSharedSettlement(groupId: string, fromMember: string, toMember: string, amount: number): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const value = cleanAmount(amount)
  if (!UUID.test(groupId) || !UUID.test(fromMember) || !UUID.test(toMember) || fromMember === toMember || !value) return { success: false, message: 'invalid' }
  const { error } = await g.supabase
    .from('spendly_group_settlements')
    .insert({ group_id: groupId, from_member: fromMember, to_member: toMember, amount: value, created_by: g.userId })
  return error ? { success: false, message: 'saveError' } : { success: true }
}

export async function deleteSharedSettlement(settlementId: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const { error } = await g.supabase.from('spendly_group_settlements').delete().eq('id', settlementId)
  return error ? { success: false, message: 'saveError' } : { success: true }
}

export async function removeSharedMember(memberId: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const { data, error } = await g.supabase.rpc('spendly_group_remove_member', { p_member: memberId })
  if (error) return { success: false, message: 'saveError' }
  return data === 'ok' ? { success: true } : { success: false, message: String(data) }
}

export async function deleteSharedGroup(groupId: string): Promise<Result> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const { data, error } = await g.supabase.from('spendly_groups').delete().eq('id', groupId).eq('creator_id', g.userId).select('id')
  return error || !data?.length ? { success: false, message: 'saveError' } : { success: true }
}

// Le mie quote nel mio Spendly (si può ripetere: riallinea importi e spese tolte)
export async function syncSharedToSpendly(groupId: string): Promise<Result<{ status: string; imported: number }>> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  const { data, error } = await g.supabase.rpc('spendly_group_to_spendly', { p_group: groupId })
  if (error) return (await limitError(error)) ?? { success: false, message: 'saveError' }
  const res = data as { status: string; imported?: number }
  return res.status === 'ok' ? { success: true, data: { status: res.status, imported: res.imported ?? 0 } } : { success: false, message: res.status }
}

// Dati dell'anno per «Il resoconto dell'anno» (PDF fatto nel browser)
export async function getSharedYear(groupId: string, year: number): Promise<Result<{ expenses: SharedExpense[]; members: SharedMember[]; name: string }>> {
  const g = await me()
  if (!g) return { success: false, message: 'notLoggedIn' }
  if (!UUID.test(groupId) || !Number.isInteger(year) || year < 2000 || year > 2100) return { success: false, message: 'invalid' }
  const [{ data: detail }, { data: expenses, error }] = await Promise.all([
    g.supabase.rpc('spendly_group_detail', { p_group: groupId }),
    fetchAllRows((from, to) =>
      g.supabase
        .from('spendly_group_expenses')
        .select('id, paid_by, amount, category, description, spent_on, split_between, recurring_id')
        .eq('group_id', groupId)
        .gte('spent_on', `${year}-01-01`)
        .lte('spent_on', `${year}-12-31`)
        .order('spent_on')
        .order('id')
        .range(from, to)
        .returns<SharedExpense[]>()
    ),
  ])
  const group = detail as { name: string; members: SharedMember[] } | null
  if (error || !group) return { success: false, message: 'saveError' }
  return { success: true, data: { expenses, members: group.members, name: group.name } }
}
