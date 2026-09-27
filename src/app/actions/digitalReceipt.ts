'use server'

import { createClient } from '@/lib/supabase/server'
import { hasActiveDigitalReceiptAccess } from '@/lib/digitalReceipt-server'
import { generateShortCode } from '@/lib/shortLink'
import type { DigitalReceiptFormData } from '@/lib/digitalReceipt'
import { createItem as createLifeCalendarItem } from '@/app/actions/lifeCalendar'
import { awardToolPoint } from '@/lib/toolPoints'

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; message: string }

async function requireActiveDigitalReceiptAccess(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, message: 'notLoggedIn' }
  }

  const hasAccess = await hasActiveDigitalReceiptAccess(supabase, user.id)
  if (!hasAccess) {
    return { ok: false, message: 'subscriptionRequired' }
  }

  return { ok: true, userId: user.id }
}

// Promemoria Life Calendar collegato a una ricevuta: archiviato quando
// l'oggetto è restituito, eliminato quando la ricevuta non esiste più.
// Non bloccante: un errore qui non deve far fallire l'azione principale.
async function closeLinkedLifeCalendarItem(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  itemId: string | null | undefined,
  mode: 'archive' | 'delete'
): Promise<void> {
  if (!itemId) return
  const query =
    mode === 'archive'
      ? supabase
          .from('life_calendar_items')
          .update({ status: 'archived', updated_at: new Date().toISOString() })
          .eq('id', itemId)
          .eq('user_id', userId)
      : supabase.from('life_calendar_items').delete().eq('id', itemId).eq('user_id', userId)
  const { error } = await query
  if (error) {
    console.error(`[DigitalReceipt] Life Calendar reminder ${mode} failed (non-blocking):`, error)
  }
}

export async function createReceipt(
  form: DigitalReceiptFormData,
  photoPath: string | null
): Promise<ActionResult<{ id: string; code: string }>> {
  const gate = await requireActiveDigitalReceiptAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()

  // Loan + expected return date + opted-in: create a non-blocking Life
  // Calendar reminder. Failure here (e.g. the admin disabled that tool)
  // must not prevent the receipt itself from being saved.
  let lifeCalendarItemId: string | null = null
  if (form.template === 'loan' && form.expectedReturnDate && form.addLifeCalendarReminder) {
    try {
      const reminderResult = await createLifeCalendarItem({
        title: `Restituzione: ${form.objectName}`,
        category: 'other',
        profileId: null,
        dueDate: form.expectedReturnDate,
        notes: `Prestato a ${form.recipientName}`,
        reminderOffsets: [7, 1],
        recurrence: 'none',
        recurrenceCustomDays: null,
      })
      if (reminderResult.success) {
        lifeCalendarItemId = reminderResult.data.id
      }
    } catch (err) {
      console.error('[DigitalReceipt] Life Calendar reminder creation failed (non-blocking):', err)
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateShortCode()
    const { data, error } = await supabase
      .from('digital_receipts')
      .insert({
        user_id: gate.userId,
        code,
        template: form.template,
        object_name: form.objectName,
        serial_number: form.serialNumber || null,
        recipient_name: form.recipientName,
        delivery_date: form.deliveryDate,
        reason: form.reason || null,
        notes: form.notes || null,
        quantity: form.quantity,
        declared_value: form.declaredValue,
        expected_return_date: form.expectedReturnDate || null,
        photo_path: photoPath,
        life_calendar_item_id: lifeCalendarItemId,
      })
      .select('id, code')
      .single()

    if (!error && data) {
      await awardToolPoint('digital-receipt')
      return { success: true, data: { id: data.id, code: data.code } }
    }

    if (error && error.code !== '23505') {
      console.error('[DigitalReceipt] createReceipt failed:', error)
      // La ricevuta non è stata salvata: niente promemoria orfano.
      await closeLinkedLifeCalendarItem(supabase, gate.userId, lifeCalendarItemId, 'delete')
      return { success: false, message: 'saveError' }
    }
  }

  await closeLinkedLifeCalendarItem(supabase, gate.userId, lifeCalendarItemId, 'delete')
  return { success: false, message: 'saveError' }
}

export async function updateReceipt(id: string, form: DigitalReceiptFormData): Promise<ActionResult<null>> {
  const gate = await requireActiveDigitalReceiptAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('digital_receipts')
    .select('confirmed_at')
    .eq('id', id)
    .eq('user_id', gate.userId)
    .single()

  if (!existing) {
    return { success: false, message: 'saveError' }
  }
  if (existing.confirmed_at) {
    return { success: false, message: 'alreadyConfirmedError' }
  }

  const { error } = await supabase
    .from('digital_receipts')
    .update({
      template: form.template,
      object_name: form.objectName,
      serial_number: form.serialNumber || null,
      recipient_name: form.recipientName,
      delivery_date: form.deliveryDate,
      reason: form.reason || null,
      notes: form.notes || null,
      quantity: form.quantity,
      declared_value: form.declaredValue,
      expected_return_date: form.expectedReturnDate || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', gate.userId)

  if (error) {
    console.error('[DigitalReceipt] updateReceipt failed:', error)
    return { success: false, message: 'saveError' }
  }

  return { success: true, data: null }
}

export async function deleteReceipt(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveDigitalReceiptAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()

  const { data: receipt } = await supabase
    .from('digital_receipts')
    .select('photo_path, life_calendar_item_id')
    .eq('id', id)
    .eq('user_id', gate.userId)
    .single()

  const { error } = await supabase.from('digital_receipts').delete().eq('id', id).eq('user_id', gate.userId)

  if (error) {
    console.error('[DigitalReceipt] deleteReceipt failed:', error)
    return { success: false, message: 'deleteError' }
  }

  if (receipt?.photo_path) {
    await supabase.storage.from('receipt-photos-v2').remove([receipt.photo_path])
  }

  await closeLinkedLifeCalendarItem(supabase, gate.userId, receipt?.life_calendar_item_id, 'delete')

  return { success: true, data: null }
}

export async function confirmReturn(id: string): Promise<ActionResult<null>> {
  const gate = await requireActiveDigitalReceiptAccess()
  if (!gate.ok) return { success: false, message: gate.message }

  const supabase = await createClient()
  const { data: updated, error } = await supabase
    .from('digital_receipts')
    .update({ returned_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', gate.userId)
    .eq('template', 'loan')
    .select('life_calendar_item_id')
    .maybeSingle()

  if (error) {
    console.error('[DigitalReceipt] confirmReturn failed:', error)
    return { success: false, message: 'saveError' }
  }

  // Oggetto restituito: il promemoria di restituzione non serve più.
  await closeLinkedLifeCalendarItem(supabase, gate.userId, updated?.life_calendar_item_id, 'archive')

  return { success: true, data: null }
}
