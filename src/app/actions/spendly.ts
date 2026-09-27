'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveSpendlyAccess } from '@/lib/spendly-server'
import { awardToolPoint } from '@/lib/toolPoints'
import type {
  FixedExpenseCategory,
  FixedExpenseFrequency,
  IncomeCategory,
  IncomeType,
  VariableExpenseCategory,
} from '@/lib/spendly'

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

async function requireActiveSpendlyAccess(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'notLoggedIn' }
  }

  const hasAccess = await hasActiveSpendlyAccess(supabase, user.id)
  if (!hasAccess) {
    return { ok: false, message: 'subscriptionRequired' }
  }

  return { ok: true, userId: user.id }
}

// ---------- Entrate ----------

export interface IncomeFormData {
  description: string
  amount: number
  incomeType: IncomeType
  category: IncomeCategory
  incomeDate: string
  notes: string
}

export async function createIncome(form: IncomeFormData): Promise<ActionResult<{ id: string }>> {
  const gate = await requireActiveSpendlyAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('spendly_income')
    .insert({
      user_id: gate.userId,
      description: form.description,
      amount: form.amount,
      income_type: form.incomeType,
      category: form.category,
      income_date: form.incomeDate,
      notes: form.notes || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[Spendly] createIncome failed:', error)
    return { success: false, message: 'saveError' }
  }

  await awardToolPoint('spendly')
  return { success: true, data: { id: data.id } }
}

export async function updateIncome(id: string, form: IncomeFormData): Promise<ActionResult<null>> {
  const gate = await requireActiveSpendlyAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spendly_income')
    .update({
      description: form.description,
      amount: form.amount,
      income_type: form.incomeType,
      category: form.category,
      income_date: form.incomeDate,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[Spendly] updateIncome failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: null }
}

export async function deleteIncome(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveSpendlyAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase.from('spendly_income').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Spendly] deleteIncome failed:', error)
    return { success: false, message: 'deleteError' }
  }

  return { success: true, data: null }
}

// ---------- Spese fisse ----------

export interface FixedExpenseFormData {
  description: string
  amount: number
  frequency: FixedExpenseFrequency
  category: FixedExpenseCategory
  startDate: string
  endDate: string | null
  billingDay: number | null
  notes: string
}

export async function createFixedExpense(form: FixedExpenseFormData): Promise<ActionResult<{ id: string }>> {
  const gate = await requireActiveSpendlyAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('spendly_fixed_expenses')
    .insert({
      user_id: gate.userId,
      description: form.description,
      amount: form.amount,
      frequency: form.frequency,
      category: form.category,
      start_date: form.startDate,
      end_date: form.endDate,
      billing_day: form.billingDay,
      notes: form.notes || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[Spendly] createFixedExpense failed:', error)
    return { success: false, message: 'saveError' }
  }

  await awardToolPoint('spendly')
  return { success: true, data: { id: data.id } }
}

export async function updateFixedExpense(id: string, form: FixedExpenseFormData): Promise<ActionResult<null>> {
  const gate = await requireActiveSpendlyAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spendly_fixed_expenses')
    .update({
      description: form.description,
      amount: form.amount,
      frequency: form.frequency,
      category: form.category,
      start_date: form.startDate,
      end_date: form.endDate,
      billing_day: form.billingDay,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[Spendly] updateFixedExpense failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: null }
}

export async function deleteFixedExpense(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveSpendlyAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase.from('spendly_fixed_expenses').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Spendly] deleteFixedExpense failed:', error)
    return { success: false, message: 'deleteError' }
  }

  return { success: true, data: null }
}

// ---------- Spese variabili ----------

export interface VariableExpenseFormData {
  description: string
  amount: number
  expenseDate: string
  category: VariableExpenseCategory
  notes: string
}

export async function createVariableExpense(form: VariableExpenseFormData): Promise<ActionResult<{ id: string }>> {
  const gate = await requireActiveSpendlyAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('spendly_variable_expenses')
    .insert({
      user_id: gate.userId,
      description: form.description,
      amount: form.amount,
      expense_date: form.expenseDate,
      category: form.category,
      notes: form.notes || null,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[Spendly] createVariableExpense failed:', error)
    return { success: false, message: 'saveError' }
  }

  await awardToolPoint('spendly')
  return { success: true, data: { id: data.id } }
}

export async function updateVariableExpense(id: string, form: VariableExpenseFormData): Promise<ActionResult<null>> {
  const gate = await requireActiveSpendlyAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('spendly_variable_expenses')
    .update({
      description: form.description,
      amount: form.amount,
      expense_date: form.expenseDate,
      category: form.category,
      notes: form.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[Spendly] updateVariableExpense failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: null }
}

export async function deleteVariableExpense(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveSpendlyAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase.from('spendly_variable_expenses').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[Spendly] deleteVariableExpense failed:', error)
    return { success: false, message: 'deleteError' }
  }

  return { success: true, data: null }
}

// ---------- Bollette ----------

// Disattiva una bolletta (contratto chiuso: dal mese prossimo non si ripete
// più, lo storico resta) o la riattiva.
export async function setBillActive(id: string, active: boolean): Promise<ActionResult<null>> {
  const gate = await requireActiveSpendlyAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
  const { data: bill } = await supabase.from('spendly_fixed_expenses').select('start_date').eq('id', id).eq('user_id', gate.userId).maybeSingle()
  if (!bill) return { success: false, message: 'saveError' }
  const { error } = await supabase
    .from('spendly_fixed_expenses')
    .update({ end_date: active ? null : today < bill.start_date ? bill.start_date : today, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', gate.userId)
  if (error) return { success: false, message: 'saveError' }
  return { success: true, data: null }
}
