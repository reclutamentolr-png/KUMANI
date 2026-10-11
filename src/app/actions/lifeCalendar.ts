'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveLifeCalendarAccess } from '@/lib/lifeCalendar-server'
import { computeNextDueDate, type LifeCalendarItemFormData } from '@/lib/lifeCalendar'
import { awardToolPoint } from '@/lib/toolPoints'
import { todayKey } from '@/lib/agenda'
import { limitError } from '@/lib/appLimits'

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

async function requireActiveLifeCalendarAccess(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'notLoggedIn' }
  }

  const hasAccess = await hasActiveLifeCalendarAccess(supabase, user.id)
  if (!hasAccess) {
    return { ok: false, message: 'subscriptionRequired' }
  }

  return { ok: true, userId: user.id }
}

// "Personalizzato" richiede un numero di giorni valido: senza, al rinnovo la
// scadenza veniva archiviata invece di spostarsi avanti.
// Dati puliti prima di salvarli (anche il database ha gli stessi limiti)
function cleanForm(form: LifeCalendarItemFormData) {
  const offsets = Array.from(new Set((Array.isArray(form.reminderOffsets) ? form.reminderOffsets : []).map(Number)))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 730)
    .slice(0, 10)
  const custom = Number(form.recurrenceCustomDays)
  return {
    title: String(form.title ?? '').trim().slice(0, 160),
    notes: String(form.notes ?? '').trim().slice(0, 2000) || null,
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(String(form.dueDate)) ? form.dueDate : null,
    offsets,
    customDays: form.recurrence === 'custom' && Number.isInteger(custom) ? Math.min(Math.max(custom, 1), 3650) : form.recurrenceCustomDays,
  }
}

function invalidCustomRecurrence(form: LifeCalendarItemFormData): boolean {
  return form.recurrence === 'custom' && !(Number(form.recurrenceCustomDays) >= 1)
}

export async function createItem(form: LifeCalendarItemFormData): Promise<ActionResult<{ id: string }>> {
  const gate = await requireActiveLifeCalendarAccess()
  if (!gate.ok) return { success: false, message: gate.message }
  if (invalidCustomRecurrence(form)) return { success: false, message: 'customDaysRequired' }

  const clean = cleanForm(form)
  if (!clean.title || !clean.dueDate) return { success: false, message: 'saveError' }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('life_calendar_items')
    .insert({
      user_id: gate.userId,
      profile_id: form.profileId,
      title: clean.title,
      category: form.category,
      due_date: clean.dueDate,
      notes: clean.notes,
      reminder_offsets: clean.offsets,
      recurrence: form.recurrence,
      recurrence_custom_days: clean.customDays,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('[LifeCalendar] createItem failed:', error)
    const limit = await limitError(error)
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }

  await awardToolPoint('life-calendar')
  return { success: true, data: { id: data.id } }
}

export async function updateItem(id: string, form: LifeCalendarItemFormData): Promise<ActionResult<null>> {
  const gate = await requireActiveLifeCalendarAccess()
  if (!gate.ok) return { success: false, message: gate.message }
  if (invalidCustomRecurrence(form)) return { success: false, message: 'customDaysRequired' }

  const clean = cleanForm(form)
  if (!clean.title || !clean.dueDate) return { success: false, message: 'saveError' }
  const supabase = await createClient()
  const { error } = await supabase
    .from('life_calendar_items')
    .update({
      profile_id: form.profileId,
      title: clean.title,
      category: form.category,
      due_date: clean.dueDate,
      notes: clean.notes,
      reminder_offsets: clean.offsets,
      recurrence: form.recurrence,
      recurrence_custom_days: clean.customDays,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[LifeCalendar] updateItem failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: null }
}

export async function deleteItem(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveLifeCalendarAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase.from('life_calendar_items').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[LifeCalendar] deleteItem failed:', error)
    return { success: false, message: 'deleteError' }
  }

  return { success: true, data: null }
}

// expectedDueDate: la scadenza che la persona vedeva quando ha toccato
// «Rinnovata». Se nel frattempo è già cambiata (doppio tocco, due schede)
// non si sposta di nuovo.
export async function markHandled(
  id: string,
  expectedDueDate?: string
): Promise<ActionResult<{ archived: boolean; newDueDate: string | null }>> {
  const gate = await requireActiveLifeCalendarAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { data: item, error: fetchError } = await supabase
    .from('life_calendar_items')
    .select('id, due_date, recurrence, recurrence_custom_days, status')
    .eq('id', id)
    .eq('user_id', gate.userId)
    .single()

  if (fetchError || !item) {
    return { success: false, message: 'saveError' }
  }
  if (item.status === 'archived') return { success: true, data: { archived: true, newDueDate: null } }
  if (expectedDueDate && item.due_date !== expectedDueDate) return { success: true, data: { archived: false, newDueDate: item.due_date } }

  // La nuova scadenza deve cadere da oggi in poi (fuso di Roma): se la voce era
  // scaduta da più periodi si avanza più volte, con un tetto di sicurezza.
  const today = todayKey()
  let nextDueDate = computeNextDueDate(item.due_date, item.recurrence, item.recurrence_custom_days)
  for (let steps = 2; nextDueDate && nextDueDate < today && steps <= 1000; steps++) {
    nextDueDate = computeNextDueDate(item.due_date, item.recurrence, item.recurrence_custom_days, steps)
  }

  const { error: renewalError } = await supabase.from('life_calendar_renewals').insert({
    item_id: item.id,
    previous_due_date: item.due_date,
    new_due_date: nextDueDate,
  })

  if (renewalError) {
    console.error('[LifeCalendar] markHandled renewal log failed:', renewalError)
    return { success: false, message: 'saveError' }
  }

  const { error: updateError } = await supabase
    .from('life_calendar_items')
    .update(
      nextDueDate
        ? { due_date: nextDueDate, updated_at: new Date().toISOString() }
        : { status: 'archived', updated_at: new Date().toISOString() }
    )
    .eq('id', id)
    .eq('user_id', gate.userId)
    .eq('due_date', item.due_date)

  if (updateError) {
    console.error('[LifeCalendar] markHandled update failed:', updateError)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: { archived: !nextDueDate, newDueDate: nextDueDate } }
}

export async function createProfile(name: string, icon: string): Promise<ActionResult<{ id: string; name: string; icon: string }>> {
  const gate = await requireActiveLifeCalendarAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('life_calendar_profiles')
    .insert({ user_id: gate.userId, name: String(name ?? '').trim().slice(0, 60), icon: String(icon ?? '').slice(0, 40) })
    .select('id, name, icon')
    .single()

  if (error || !data) {
    console.error('[LifeCalendar] createProfile failed:', error)
    const limit = await limitError(error)
    if (limit) return limit
    return { success: false, message: 'saveError' }
  }

  return { success: true, data }
}

export async function deleteProfile(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveLifeCalendarAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { error } = await supabase.from('life_calendar_profiles').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[LifeCalendar] deleteProfile failed:', error)
    return { success: false, message: 'deleteError' }
  }

  return { success: true, data: null }
}
