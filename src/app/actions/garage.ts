'use server'

import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { todayKey } from '@/lib/agenda'
import {
  DEADLINE_EXPENSE_KIND,
  DEADLINE_KINDS,
  DEADLINE_RECURRENCES,
  EXPENSE_KINDS,
  VEHICLE_KINDS,
  nextDueDate,
  rentalEnd,
  type DeadlineKind,
  type DeadlineRecurrence,
  type ExpenseKind,
  type VehicleForm,
} from '@/lib/garage'

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }
type Supabase = Awaited<ReturnType<typeof createClient>>

const DATE = /^\d{4}-\d{2}-\d{2}$/

async function gate(): Promise<{ ok: true; userId: string; supabase: Supabase } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'garage'))) return { ok: false, message: 'subscriptionRequired' }
  return { ok: true, userId: user.id, supabase }
}

const money = (value: number | null | undefined) => (value === null || value === undefined || !Number.isFinite(value) || value < 0 ? null : Math.round(value * 100) / 100)

function vehicleRow(form: VehicleForm) {
  const rental = form.kind === 'rental'
  return {
    kind: form.kind,
    name: form.name.trim().slice(0, 60),
    model: form.model.trim().slice(0, 80) || null,
    plate: form.plate.trim().toUpperCase().slice(0, 15) || null,
    initial_km: Math.max(0, Math.round(form.initialKm || 0)),
    rental_start: rental ? form.rentalStart : null,
    rental_months: rental ? form.rentalMonths : null,
    rental_km_included: rental ? form.rentalKmIncluded : null,
    rental_monthly_fee: rental ? money(form.rentalMonthlyFee) : null,
    rental_down_payment: rental ? money(form.rentalDownPayment) : null,
    rental_extra_km_cost: rental && form.rentalExtraKmCost !== null && form.rentalExtraKmCost >= 0 ? form.rentalExtraKmCost : null,
    rental_unused_km_refund: rental && form.rentalUnusedKmRefund !== null && form.rentalUnusedKmRefund >= 0 ? form.rentalUnusedKmRefund : null,
    rental_includes_tax: rental ? form.rentalIncludesTax : true,
    rental_includes_insurance: rental ? form.rentalIncludesInsurance : true,
  }
}

function invalidVehicle(form: VehicleForm): string | null {
  if (!VEHICLE_KINDS.includes(form.kind)) return 'invalid'
  if (!form.name.trim()) return 'nameRequired'
  if (form.kind === 'rental') {
    if (!DATE.test(form.rentalStart)) return 'rentalStartRequired'
    if (!form.rentalMonths || form.rentalMonths < 1 || form.rentalMonths > 120) return 'rentalMonthsInvalid'
    if (!form.rentalKmIncluded || form.rentalKmIncluded < 1) return 'rentalKmInvalid'
  }
  return null
}

// Rata del noleggio tra le spese fisse di Spendly (solo se l'utente può
// usarlo): creata, aggiornata o tolta insieme al contratto
async function syncRentalFee(
  supabase: Supabase,
  userId: string,
  vehicleId: string,
  row: ReturnType<typeof vehicleRow>,
  wanted: boolean,
  currentFixedId: string | null
) {
  const fee = row.rental_monthly_fee
  const keep = wanted && row.kind === 'rental' && fee !== null && fee > 0 && row.rental_start && row.rental_months
  try {
    if (!keep) {
      if (currentFixedId) {
        await supabase.from('spendly_fixed_expenses').delete().eq('id', currentFixedId).eq('user_id', userId)
        await supabase.from('garage_vehicles').update({ spendly_fixed_id: null }).eq('id', vehicleId)
      }
      return
    }
    if (!(await hasActiveToolAccess(supabase, userId, 'spendly'))) return
    const t = await getTranslations('garage')
    const fields = {
      description: t('rentalFeeDescription', { name: row.name }).slice(0, 120),
      amount: fee,
      frequency: 'mensile',
      category: 'altro',
      start_date: row.rental_start,
      end_date: rentalEnd(row.rental_start!, row.rental_months!),
      billing_day: Number(row.rental_start!.slice(8, 10)),
      updated_at: new Date().toISOString(),
    }
    if (currentFixedId) {
      const { data } = await supabase.from('spendly_fixed_expenses').update(fields).eq('id', currentFixedId).eq('user_id', userId).select('id').maybeSingle()
      if (data) return
    }
    const { data: created } = await supabase
      .from('spendly_fixed_expenses')
      .insert({ ...fields, user_id: userId, source_ref: `garage:${vehicleId}` })
      .select('id')
      .single()
    if (created) await supabase.from('garage_vehicles').update({ spendly_fixed_id: created.id }).eq('id', vehicleId)
  } catch (error) {
    // Spendly è un di più: il contratto resta salvato comunque
    console.error('[Garage] syncRentalFee failed:', error)
  }
}

export async function createVehicle(form: VehicleForm): Promise<ActionResult<{ id: string }>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const problem = invalidVehicle(form)
  if (problem) return { success: false, message: problem }

  const row = vehicleRow(form)
  const { data, error } = await g.supabase
    .from('garage_vehicles')
    .insert({ ...row, user_id: g.userId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[Garage] createVehicle failed:', error)
    return { success: false, message: error?.message?.includes('garage_vehicles_limit') ? 'vehiclesLimit' : 'saveError' }
  }
  await syncRentalFee(g.supabase, g.userId, data.id, row, form.addFeeToSpendly, null)
  await awardToolPoint('garage')
  return { success: true, data: { id: data.id } }
}

export async function updateVehicle(id: string, form: VehicleForm): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const problem = invalidVehicle(form)
  if (problem) return { success: false, message: problem }

  const row = vehicleRow(form)
  const { data, error } = await g.supabase
    .from('garage_vehicles')
    .update({ ...row, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', g.userId)
    .select('id, spendly_fixed_id')
    .maybeSingle()
  if (error || !data) {
    console.error('[Garage] updateVehicle failed:', error)
    return { success: false, message: 'saveError' }
  }
  await syncRentalFee(g.supabase, g.userId, id, row, form.addFeeToSpendly, data.spendly_fixed_id as string | null)
  return { success: true, data: null }
}

// Elimina l'auto con km, scadenze e spese di Garage. La rata del noleggio
// sparisce da Spendly; le spese già copiate in Spendly restano (sono spese vere).
export async function deleteVehicle(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }
  const { data: vehicle } = await supabase.from('garage_vehicles').select('spendly_fixed_id').eq('id', id).eq('user_id', user.id).maybeSingle()
  if (vehicle?.spendly_fixed_id) await supabase.from('spendly_fixed_expenses').delete().eq('id', vehicle.spendly_fixed_id).eq('user_id', user.id)
  const { error } = await supabase.from('garage_vehicles').delete().eq('id', id).eq('user_id', user.id)
  if (error) {
    console.error('[Garage] deleteVehicle failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

export async function addReading(vehicleId: string, input: { km: number; readOn: string; note: string }): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const km = Math.round(input.km)
  if (!Number.isFinite(km) || km < 0 || km > 2000000) return { success: false, message: 'kmInvalid' }
  if (!DATE.test(input.readOn) || input.readOn > todayKey()) return { success: false, message: 'dateInvalid' }

  const { data: vehicle } = await g.supabase.from('garage_vehicles').select('initial_km').eq('id', vehicleId).eq('user_id', g.userId).maybeSingle()
  if (!vehicle) return { success: false, message: 'notFound' }
  if (km < (vehicle.initial_km as number)) return { success: false, message: 'kmBelowInitial' }

  const { error } = await g.supabase
    .from('garage_readings')
    .insert({ vehicle_id: vehicleId, user_id: g.userId, km, read_on: input.readOn, note: input.note.trim().slice(0, 120) || null })
  if (error) {
    console.error('[Garage] addReading failed:', error)
    return { success: false, message: error.message.includes('garage_readings_limit') ? 'readingsLimit' : 'saveError' }
  }
  await awardToolPoint('garage')
  return { success: true, data: null }
}

export async function deleteReading(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }
  const { error } = await supabase.from('garage_readings').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { success: false, message: 'saveError' }
  return { success: true, data: null }
}

export type DeadlineInput = { kind: DeadlineKind; title: string; dueDate: string; amount: number | null; recurrence: DeadlineRecurrence }

export async function saveDeadline(vehicleId: string, input: DeadlineInput, id?: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (!DEADLINE_KINDS.includes(input.kind) || !DEADLINE_RECURRENCES.includes(input.recurrence)) return { success: false, message: 'invalid' }
  if (!DATE.test(input.dueDate)) return { success: false, message: 'dateInvalid' }
  const row = {
    kind: input.kind,
    title: input.title.trim().slice(0, 80) || null,
    due_date: input.dueDate,
    amount: money(input.amount),
    recurrence: input.recurrence,
    updated_at: new Date().toISOString(),
  }
  const { error } = id
    ? await g.supabase.from('garage_deadlines').update(row).eq('id', id).eq('user_id', g.userId)
    : await g.supabase.from('garage_deadlines').insert({ ...row, vehicle_id: vehicleId, user_id: g.userId })
  if (error) {
    console.error('[Garage] saveDeadline failed:', error)
    return { success: false, message: error.message.includes('garage_deadlines_limit') ? 'deadlinesLimit' : 'saveError' }
  }
  await awardToolPoint('garage')
  return { success: true, data: null }
}

export async function deleteDeadline(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }
  const { error } = await supabase.from('garage_deadlines').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { success: false, message: 'saveError' }
  return { success: true, data: null }
}

// Spesa di Garage, copiata anche tra le spese variabili di Spendly
// (categoria Trasporti) se l'utente può usarlo
async function insertExpense(
  g: { userId: string; supabase: Supabase },
  vehicleId: string,
  input: { kind: ExpenseKind; amount: number; spentOn: string; note: string }
): Promise<ActionResult<null>> {
  const amount = money(input.amount)
  if (amount === null) return { success: false, message: 'amountInvalid' }
  if (!EXPENSE_KINDS.includes(input.kind)) return { success: false, message: 'invalid' }
  if (!DATE.test(input.spentOn)) return { success: false, message: 'dateInvalid' }

  const { data: vehicle } = await g.supabase.from('garage_vehicles').select('name').eq('id', vehicleId).eq('user_id', g.userId).maybeSingle()
  if (!vehicle) return { success: false, message: 'notFound' }
  const note = input.note.trim().slice(0, 120) || null

  let spendlyId: string | null = null
  try {
    if (await hasActiveToolAccess(g.supabase, g.userId, 'spendly')) {
      const t = await getTranslations('garage')
      const { data } = await g.supabase
        .from('spendly_variable_expenses')
        .insert({
          user_id: g.userId,
          description: `${vehicle.name} · ${t(`expense_${input.kind}`)}`.slice(0, 120),
          amount,
          expense_date: input.spentOn,
          category: 'trasporti',
          notes: note,
        })
        .select('id')
        .single()
      spendlyId = (data?.id as string | undefined) ?? null
    }
  } catch (error) {
    console.error('[Garage] Spendly copy failed:', error)
  }

  const { error } = await g.supabase.from('garage_expenses').insert({
    vehicle_id: vehicleId,
    user_id: g.userId,
    kind: input.kind,
    amount,
    spent_on: input.spentOn,
    note,
    spendly_expense_id: spendlyId,
  })
  if (error) {
    console.error('[Garage] addExpense failed:', error)
    if (spendlyId) await g.supabase.from('spendly_variable_expenses').delete().eq('id', spendlyId)
    return { success: false, message: error.message.includes('garage_expenses_limit') ? 'expensesLimit' : 'saveError' }
  }
  return { success: true, data: null }
}

export async function addExpense(vehicleId: string, input: { kind: ExpenseKind; amount: number; spentOn: string; note: string }): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const result = await insertExpense(g, vehicleId, input)
  if (result.success) await awardToolPoint('garage')
  return result
}

// Elimina la spesa anche da Spendly
export async function deleteExpense(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }
  const { data: expense } = await supabase.from('garage_expenses').select('spendly_expense_id').eq('id', id).eq('user_id', user.id).maybeSingle()
  const { error } = await supabase.from('garage_expenses').delete().eq('id', id).eq('user_id', user.id)
  if (error) return { success: false, message: 'saveError' }
  if (expense?.spendly_expense_id) await supabase.from('spendly_variable_expenses').delete().eq('id', expense.spendly_expense_id).eq('user_id', user.id)
  return { success: true, data: null }
}

// Scadenza pagata: diventa una spesa (anche in Spendly) e, se si ripete,
// passa alla prossima data; altrimenti sparisce.
export async function payDeadline(id: string, input: { amount: number; paidOn: string }): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const { data: deadline } = await g.supabase
    .from('garage_deadlines')
    .select('vehicle_id, kind, title, due_date, recurrence')
    .eq('id', id)
    .eq('user_id', g.userId)
    .maybeSingle()
  if (!deadline) return { success: false, message: 'notFound' }

  if (input.amount > 0) {
    const result = await insertExpense(g, deadline.vehicle_id as string, {
      kind: DEADLINE_EXPENSE_KIND[deadline.kind as DeadlineKind],
      amount: input.amount,
      spentOn: input.paidOn,
      note: (deadline.title as string | null) ?? '',
    })
    if (!result.success) return result
  }

  const next = nextDueDate(deadline.due_date as string, deadline.recurrence as DeadlineRecurrence)
  const { error } = next
    ? await g.supabase
        .from('garage_deadlines')
        .update({ due_date: next, amount: money(input.amount) ?? undefined, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', g.userId)
    : await g.supabase.from('garage_deadlines').delete().eq('id', id).eq('user_id', g.userId)
  if (error) {
    console.error('[Garage] payDeadline failed:', error)
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint('garage')
  return { success: true, data: null }
}
