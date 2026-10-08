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
function invalidCustomRecurrence(form: LifeCalendarItemFormData): boolean {
  return form.recurrence === 'custom' && !(Number(form.recurrenceCustomDays) >= 1)
}

export async function createItem(form: LifeCalendarItemFormData): Promise<ActionResult<{ id: string }>> {
  const gate = await requireActiveLifeCalendarAccess()
  if (!gate.ok) return { success: false, message: gate.message }
  if (invalidCustomRecurrence(form)) return { success: false, message: 'customDaysRequired' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('life_calendar_items')
    .insert({
      user_id: gate.userId,
      profile_id: form.profileId,
      title: form.title,
      category: form.category,
      due_date: form.dueDate,
      notes: form.notes || null,
      reminder_offsets: form.reminderOffsets,
      recurrence: form.recurrence,
      recurrence_custom_days: form.recurrenceCustomDays,
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

  const supabase = await createClient()
  const { error } = await supabase
    .from('life_calendar_items')
    .update({
      profile_id: form.profileId,
      title: form.title,
      category: form.category,
      due_date: form.dueDate,
      notes: form.notes || null,
      reminder_offsets: form.reminderOffsets,
      recurrence: form.recurrence,
      recurrence_custom_days: form.recurrenceCustomDays,
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

export async function markHandled(
  id: string
): Promise<ActionResult<{ archived: boolean; newDueDate: string | null }>> {
  const gate = await requireActiveLifeCalendarAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { data: item, error: fetchError } = await supabase
    .from('life_calendar_items')
    .select('id, due_date, recurrence, recurrence_custom_days')
    .eq('id', id)
    .eq('user_id', gate.userId)
    .single()

  if (fetchError || !item) {
    return { success: false, message: 'saveError' }
  }

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
    .insert({ user_id: gate.userId, name, icon })
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
