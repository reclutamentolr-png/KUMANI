'use server'

import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { markHandled } from '@/app/actions/lifeCalendar'
import {
  BILL_FREQUENCIES,
  CASA_REMINDER_OFFSETS,
  DEADLINE_RECURRENCES,
  DOCUMENT_KINDS,
  HOME_KINDS,
  UTILITY_KINDS,
  type ApplianceForm,
  type DeadlineForm,
  type DocumentForm,
  type HomeForm,
  type UtilityForm,
} from '@/lib/casa'

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }
type Supabase = Awaited<ReturnType<typeof createClient>>
type Gate = { ok: true; userId: string; supabase: Supabase } | { ok: false; message: string }

const DATE = /^\d{4}-\d{2}-\d{2}$/
const BUCKET = 'casa-files'

async function session(): Promise<Gate> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'notLoggedIn' }
  return { ok: true, userId: user.id, supabase }
}

// Scrivere richiede il piano con Casa; leggere e cancellare no
async function gate(): Promise<Gate> {
  const s = await session()
  if (!s.ok) return s
  if (!(await hasActiveToolAccess(s.supabase, s.userId, 'casa'))) return { ok: false, message: 'subscriptionRequired' }
  return s
}

const text = (value: string, max: number) => value.trim().slice(0, max) || null
const date = (value: string) => (DATE.test(value) ? value : null)
const money = (value: number | null | undefined) =>
  value === null || value === undefined || !Number.isFinite(value) || value < 0 || value > 1000000 ? null : Math.round(value * 100) / 100

// File della casa: solo nella cartella dell'utente e di quella casa
const ownFile = (path: string | null | undefined, userId: string, homeId: string) =>
  !path || new RegExp(`^${userId}/${homeId}/[A-Za-z0-9-]{8,64}\\.(pdf|jpg|png|webp)$`).test(path)

async function removeFiles(supabase: Supabase, paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p)
  if (!list.length) return
  const { error } = await supabase.storage.from(BUCKET).remove(list)
  if (error) console.error('[Casa] file remove failed:', error.message)
}

async function ownsHome(supabase: Supabase, userId: string, homeId: string) {
  const { data } = await supabase.from('casa_homes').select('id, name').eq('id', homeId).eq('user_id', userId).maybeSingle()
  return data as { id: string; name: string } | null
}

const limitMessage = (error: { message?: string } | null, key: string) => (error?.message?.includes(`casa_${key}_limit`) ? `${key}Limit` : 'saveError')

// Scadenza di Life Calendar che nasce da un dato della casa (fine offerta,
// fine garanzia, documento che scade): creata, aggiornata o tolta con il dato.
// Life Calendar è un di più: se non riesce, il dato resta salvato.
async function syncLinkedDeadline(
  supabase: Supabase,
  userId: string,
  homeId: string,
  currentId: string | null,
  wanted: { title: string; category: string; dueDate: string } | null
): Promise<string | null> {
  try {
    if (!wanted) {
      if (currentId) await supabase.from('life_calendar_items').delete().eq('id', currentId).eq('user_id', userId)
      return null
    }
    const fields = { title: wanted.title.slice(0, 120), category: wanted.category, due_date: wanted.dueDate, status: 'active', casa_home_id: homeId }
    if (currentId) {
      const { data } = await supabase
        .from('life_calendar_items')
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq('id', currentId)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle()
      if (data) return currentId
    }
    const { data, error } = await supabase
      .from('life_calendar_items')
      .insert({ ...fields, user_id: userId, reminder_offsets: CASA_REMINDER_OFFSETS, recurrence: 'none' })
      .select('id')
      .single()
    if (error) console.error('[Casa] linked deadline failed:', error.message)
    return (data?.id as string | undefined) ?? null
  } catch (error) {
    console.error('[Casa] linked deadline failed:', error)
    return currentId
  }
}

// ---------- Case ----------

function homeRow(form: HomeForm) {
  return {
    name: form.name.trim().slice(0, 60),
    kind: form.kind,
    address: text(form.address, 160),
    notes: text(form.notes, 1000),
  }
}

export async function createHome(form: HomeForm): Promise<ActionResult<{ id: string }>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (!form.name.trim()) return { success: false, message: 'nameRequired' }
  if (!HOME_KINDS.includes(form.kind)) return { success: false, message: 'invalid' }
  const { data, error } = await g.supabase
    .from('casa_homes')
    .insert({ ...homeRow(form), user_id: g.userId })
    .select('id')
    .single()
  if (error || !data) {
    console.error('[Casa] createHome failed:', error)
    return { success: false, message: limitMessage(error, 'homes') }
  }
  await awardToolPoint('casa')
  return { success: true, data: { id: data.id as string } }
}

export async function updateHome(id: string, form: HomeForm): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (!form.name.trim()) return { success: false, message: 'nameRequired' }
  if (!HOME_KINDS.includes(form.kind)) return { success: false, message: 'invalid' }
  const { error } = await g.supabase
    .from('casa_homes')
    .update({ ...homeRow(form), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', g.userId)
  if (error) {
    console.error('[Casa] updateHome failed:', error)
    return { success: false, message: 'saveError' }
  }
  return { success: true, data: null }
}

// Via la casa con scadenze, utenze, apparecchi, documenti e file. Le bollette
// in Spendly restano (sono spese vere).
export async function deleteHome(id: string): Promise<ActionResult<null>> {
  const s = await session()
  if (!s.ok) return { success: false, message: s.message }
  if (!(await ownsHome(s.supabase, s.userId, id))) return { success: false, message: 'notFound' }
  const [{ data: docs }, { data: appliances }] = await Promise.all([
    s.supabase.from('casa_documents').select('file_path').eq('home_id', id).eq('user_id', s.userId),
    s.supabase.from('casa_appliances').select('receipt_path, manual_path').eq('home_id', id).eq('user_id', s.userId),
  ])
  const { error } = await s.supabase.from('casa_homes').delete().eq('id', id).eq('user_id', s.userId)
  if (error) {
    console.error('[Casa] deleteHome failed:', error)
    return { success: false, message: 'saveError' }
  }
  await removeFiles(s.supabase, [...(docs ?? []).map((d) => d.file_path as string), ...(appliances ?? []).flatMap((a) => [a.receipt_path as string | null, a.manual_path as string | null])])
  return { success: true, data: null }
}

// ---------- Scadenze e manutenzioni (voci di Life Calendar) ----------

export async function saveDeadline(homeId: string, form: DeadlineForm, id?: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await ownsHome(g.supabase, g.userId, homeId))) return { success: false, message: 'notFound' }
  if (!form.title.trim()) return { success: false, message: 'titleRequired' }
  if (!DATE.test(form.dueDate)) return { success: false, message: 'dateInvalid' }
  if (!DEADLINE_RECURRENCES.includes(form.recurrence) || !['home', 'contracts'].includes(form.category)) return { success: false, message: 'invalid' }
  const customDays = form.recurrence === 'custom' ? Math.round(Number(form.customDays)) : null
  if (form.recurrence === 'custom' && !(customDays! >= 1 && customDays! <= 3650)) return { success: false, message: 'customDaysRequired' }

  const row = {
    title: form.title.trim().slice(0, 120),
    category: form.category,
    due_date: form.dueDate,
    notes: text(form.notes, 500),
    recurrence: form.recurrence,
    recurrence_custom_days: customDays,
    casa_home_id: homeId,
  }
  const { error } = id
    ? await g.supabase
        .from('life_calendar_items')
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', g.userId)
        .eq('casa_home_id', homeId)
    : await g.supabase.from('life_calendar_items').insert({ ...row, user_id: g.userId, reminder_offsets: CASA_REMINDER_OFFSETS })
  if (error) {
    console.error('[Casa] saveDeadline failed:', error)
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint('casa')
  return { success: true, data: null }
}

export async function deleteDeadline(id: string): Promise<ActionResult<null>> {
  const s = await session()
  if (!s.ok) return { success: false, message: s.message }
  const { error } = await s.supabase.from('life_calendar_items').delete().eq('id', id).eq('user_id', s.userId).not('casa_home_id', 'is', null)
  if (error) return { success: false, message: 'saveError' }
  return { success: true, data: null }
}

// Fatta: se si ripete passa alla prossima data, altrimenti si archivia
// (stessa regola di Life Calendar)
export async function completeDeadline(id: string): Promise<ActionResult<{ newDueDate: string | null }>> {
  const result = await markHandled(id)
  if (!result.success) return result
  await awardToolPoint('casa')
  return { success: true, data: { newDueDate: result.data.newDueDate } }
}

// ---------- Utenze ----------

export async function saveUtility(homeId: string, form: UtilityForm, id?: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const home = await ownsHome(g.supabase, g.userId, homeId)
  if (!home) return { success: false, message: 'notFound' }
  if (!UTILITY_KINDS.includes(form.kind)) return { success: false, message: 'invalid' }
  if (form.offerEndsOn && !DATE.test(form.offerEndsOn)) return { success: false, message: 'dateInvalid' }

  const t = await getTranslations('casa')
  const kindLabel = t(`utility_${form.kind}`)
  const provider = text(form.provider, 80)

  // Bolletta in Spendly: una già presente (solo tra le proprie bollette) o nuova
  let spendlyId: string | null = null
  if (form.billMode === 'existing' && form.billId) {
    const { data } = await g.supabase.from('spendly_fixed_expenses').select('id').eq('id', form.billId).eq('user_id', g.userId).maybeSingle()
    if (!data) return { success: false, message: 'billNotFound' }
    // Una bolletta si collega a una sola utenza
    let others = g.supabase.from('casa_utilities').select('id', { count: 'exact', head: true }).eq('user_id', g.userId).eq('spendly_fixed_id', form.billId)
    if (id) others = others.neq('id', id)
    const { count } = await others
    if (count) return { success: false, message: 'billAlreadyLinked' }
    spendlyId = data.id as string
  } else if (form.billMode === 'new') {
    const amount = money(form.billAmount)
    if (amount === null || amount <= 0) return { success: false, message: 'billAmountInvalid' }
    if (!BILL_FREQUENCIES.includes(form.billFrequency) || !DATE.test(form.billStart)) return { success: false, message: 'invalid' }
    if (!(await hasActiveToolAccess(g.supabase, g.userId, 'spendly'))) return { success: false, message: 'spendlyUnavailable' }
    const day = form.billDay && form.billDay >= 1 && form.billDay <= 31 ? Math.round(form.billDay) : Number(form.billStart.slice(8, 10))
    const { data, error } = await g.supabase
      .from('spendly_fixed_expenses')
      .insert({
        user_id: g.userId,
        description: `${kindLabel} · ${home.name}${provider ? ` (${provider})` : ''}`.slice(0, 120),
        amount,
        frequency: form.billFrequency,
        category: 'bollette',
        start_date: form.billStart,
        billing_day: day,
        source_ref: `casa:${homeId}`,
      })
      .select('id')
      .single()
    if (error || !data) {
      console.error('[Casa] Spendly bill failed:', error)
      return { success: false, message: 'saveError' }
    }
    spendlyId = data.id as string
  }

  const row = {
    kind: form.kind,
    provider,
    customer_code: text(form.customerCode, 60),
    supply_code: text(form.supplyCode, 60),
    support_phone: text(form.supportPhone, 40),
    offer_ends_on: date(form.offerEndsOn),
    notes: text(form.notes, 500),
    spendly_fixed_id: spendlyId,
    updated_at: new Date().toISOString(),
  }
  const saved = id
    ? await g.supabase.from('casa_utilities').update(row).eq('id', id).eq('user_id', g.userId).eq('home_id', homeId).select('id, life_calendar_item_id').maybeSingle()
    : await g.supabase
        .from('casa_utilities')
        .insert({ ...row, home_id: homeId, user_id: g.userId })
        .select('id, life_calendar_item_id')
        .single()
  if (saved.error || !saved.data) {
    console.error('[Casa] saveUtility failed:', saved.error)
    // La bolletta appena creata non resta orfana
    if (form.billMode === 'new' && spendlyId) await g.supabase.from('spendly_fixed_expenses').delete().eq('id', spendlyId).eq('user_id', g.userId)
    return { success: false, message: limitMessage(saved.error, 'utilities') }
  }

  const linked = await syncLinkedDeadline(
    g.supabase,
    g.userId,
    homeId,
    (saved.data.life_calendar_item_id as string | null) ?? null,
    row.offer_ends_on ? { title: provider ? t('linkedOfferProvider', { kind: kindLabel, provider }) : t('linkedOffer', { kind: kindLabel }), category: 'contracts', dueDate: row.offer_ends_on } : null
  )
  if (linked !== saved.data.life_calendar_item_id) await g.supabase.from('casa_utilities').update({ life_calendar_item_id: linked }).eq('id', saved.data.id)
  await awardToolPoint('casa')
  return { success: true, data: null }
}

// La bolletta collegata resta in Spendly
export async function deleteUtility(id: string): Promise<ActionResult<null>> {
  const s = await session()
  if (!s.ok) return { success: false, message: s.message }
  const { data } = await s.supabase.from('casa_utilities').select('life_calendar_item_id').eq('id', id).eq('user_id', s.userId).maybeSingle()
  if (!data) return { success: false, message: 'notFound' }
  const { error } = await s.supabase.from('casa_utilities').delete().eq('id', id).eq('user_id', s.userId)
  if (error) return { success: false, message: 'saveError' }
  if (data.life_calendar_item_id) await s.supabase.from('life_calendar_items').delete().eq('id', data.life_calendar_item_id).eq('user_id', s.userId)
  return { success: true, data: null }
}

// ---------- Apparecchi e garanzie ----------

export async function saveAppliance(homeId: string, form: ApplianceForm, id?: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await ownsHome(g.supabase, g.userId, homeId))) return { success: false, message: 'notFound' }
  if (!form.name.trim()) return { success: false, message: 'nameRequired' }
  if ((form.purchasedOn && !DATE.test(form.purchasedOn)) || (form.warrantyUntil && !DATE.test(form.warrantyUntil))) return { success: false, message: 'dateInvalid' }
  if (!ownFile(form.receiptPath, g.userId, homeId) || !ownFile(form.manualPath, g.userId, homeId)) return { success: false, message: 'invalid' }
  // Posizione di Findo: solo tra le proprie
  if (form.findoLocationId) {
    const { data: place } = await g.supabase.from('findo_locations').select('id').eq('id', form.findoLocationId).eq('user_id', g.userId).maybeSingle()
    if (!place) return { success: false, message: 'invalid' }
  }

  type Before = { receipt_path: string | null; manual_path: string | null; life_calendar_item_id: string | null }
  let before: Before | null = null
  if (id) {
    const { data } = await g.supabase.from('casa_appliances').select('receipt_path, manual_path, life_calendar_item_id').eq('id', id).eq('user_id', g.userId).eq('home_id', homeId).maybeSingle()
    if (!data) return { success: false, message: 'notFound' }
    before = data as Before
  }

  const row = {
    name: form.name.trim().slice(0, 80),
    brand: text(form.brand, 60),
    model: text(form.model, 80),
    serial_number: text(form.serialNumber, 80),
    room: text(form.room, 60),
    purchased_on: date(form.purchasedOn),
    price: money(form.price),
    store: text(form.store, 80),
    warranty_until: date(form.warrantyUntil),
    support_phone: text(form.supportPhone, 40),
    notes: text(form.notes, 500),
    receipt_path: form.receiptPath || null,
    manual_path: form.manualPath || null,
    findo_location_id: form.findoLocationId || null,
    updated_at: new Date().toISOString(),
  }
  const saved = id
    ? await g.supabase.from('casa_appliances').update(row).eq('id', id).eq('user_id', g.userId).select('id').maybeSingle()
    : await g.supabase
        .from('casa_appliances')
        .insert({ ...row, home_id: homeId, user_id: g.userId })
        .select('id')
        .single()
  if (saved.error || !saved.data) {
    console.error('[Casa] saveAppliance failed:', saved.error)
    return { success: false, message: limitMessage(saved.error, 'appliances') }
  }
  // File sostituiti o tolti: via anche dallo spazio
  if (before) await removeFiles(g.supabase, [before.receipt_path !== row.receipt_path ? before.receipt_path : null, before.manual_path !== row.manual_path ? before.manual_path : null])

  const t = await getTranslations('casa')
  const linked = await syncLinkedDeadline(
    g.supabase,
    g.userId,
    homeId,
    before?.life_calendar_item_id ?? null,
    row.warranty_until ? { title: t('linkedWarranty', { name: row.name }), category: 'warranties', dueDate: row.warranty_until } : null
  )
  if (linked !== (before?.life_calendar_item_id ?? null)) await g.supabase.from('casa_appliances').update({ life_calendar_item_id: linked }).eq('id', saved.data.id)
  await awardToolPoint('casa')
  return { success: true, data: null }
}

export async function deleteAppliance(id: string): Promise<ActionResult<null>> {
  const s = await session()
  if (!s.ok) return { success: false, message: s.message }
  const { data } = await s.supabase.from('casa_appliances').select('receipt_path, manual_path, life_calendar_item_id').eq('id', id).eq('user_id', s.userId).maybeSingle()
  if (!data) return { success: false, message: 'notFound' }
  const { error } = await s.supabase.from('casa_appliances').delete().eq('id', id).eq('user_id', s.userId)
  if (error) return { success: false, message: 'saveError' }
  if (data.life_calendar_item_id) await s.supabase.from('life_calendar_items').delete().eq('id', data.life_calendar_item_id).eq('user_id', s.userId)
  await removeFiles(s.supabase, [data.receipt_path as string | null, data.manual_path as string | null])
  return { success: true, data: null }
}

// ---------- Documenti ----------

export async function saveDocument(homeId: string, form: DocumentForm, id?: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (!(await ownsHome(g.supabase, g.userId, homeId))) return { success: false, message: 'notFound' }
  if (!DOCUMENT_KINDS.includes(form.kind)) return { success: false, message: 'invalid' }
  if (!form.title.trim()) return { success: false, message: 'titleRequired' }
  if (form.expiresOn && !DATE.test(form.expiresOn)) return { success: false, message: 'dateInvalid' }

  const fields = { kind: form.kind, title: form.title.trim().slice(0, 100), expires_on: date(form.expiresOn) }
  type Saved = { id: string; life_calendar_item_id: string | null }
  let saved: Saved | null = null
  if (id) {
    const { data, error } = await g.supabase.from('casa_documents').update(fields).eq('id', id).eq('user_id', g.userId).eq('home_id', homeId).select('id, life_calendar_item_id').maybeSingle()
    if (error || !data) return { success: false, message: 'saveError' }
    saved = data as Saved
  } else {
    if (!form.filePath || !ownFile(form.filePath, g.userId, homeId)) return { success: false, message: 'fileRequired' }
    const { data, error } = await g.supabase
      .from('casa_documents')
      .insert({
        ...fields,
        home_id: homeId,
        user_id: g.userId,
        file_path: form.filePath,
        file_name: text(form.fileName, 160),
        mime_type: text(form.mimeType, 80),
        size_bytes: Number.isFinite(form.sizeBytes) ? Math.max(0, Math.round(form.sizeBytes)) : null,
      })
      .select('id, life_calendar_item_id')
      .single()
    if (error || !data) {
      console.error('[Casa] saveDocument failed:', error)
      await removeFiles(g.supabase, [form.filePath])
      return { success: false, message: limitMessage(error, 'documents') }
    }
    saved = data as Saved
  }

  const t = await getTranslations('casa')
  const linked = await syncLinkedDeadline(
    g.supabase,
    g.userId,
    homeId,
    saved!.life_calendar_item_id,
    fields.expires_on ? { title: t('linkedDocument', { title: fields.title }), category: form.kind === 'insurance' || form.kind === 'lease' ? 'contracts' : 'home', dueDate: fields.expires_on } : null
  )
  if (linked !== saved!.life_calendar_item_id) await g.supabase.from('casa_documents').update({ life_calendar_item_id: linked }).eq('id', saved!.id)
  await awardToolPoint('casa')
  return { success: true, data: null }
}

export async function deleteDocument(id: string): Promise<ActionResult<null>> {
  const s = await session()
  if (!s.ok) return { success: false, message: s.message }
  const { data } = await s.supabase.from('casa_documents').select('file_path, life_calendar_item_id').eq('id', id).eq('user_id', s.userId).maybeSingle()
  if (!data) return { success: false, message: 'notFound' }
  const { error } = await s.supabase.from('casa_documents').delete().eq('id', id).eq('user_id', s.userId)
  if (error) return { success: false, message: 'saveError' }
  if (data.life_calendar_item_id) await s.supabase.from('life_calendar_items').delete().eq('id', data.life_calendar_item_id).eq('user_id', s.userId)
  await removeFiles(s.supabase, [data.file_path as string])
  return { success: true, data: null }
}

// File caricato ma poi non salvato (modulo annullato): via dallo spazio
export async function discardUpload(homeId: string, path: string): Promise<ActionResult<null>> {
  const s = await session()
  if (!s.ok) return { success: false, message: s.message }
  if (!path || !ownFile(path, s.userId, homeId)) return { success: false, message: 'invalid' }
  // Solo se non è già usato da un apparecchio o un documento
  const [{ count: a }, { count: d }] = await Promise.all([
    s.supabase.from('casa_appliances').select('id', { count: 'exact', head: true }).eq('user_id', s.userId).or(`receipt_path.eq.${path},manual_path.eq.${path}`),
    s.supabase.from('casa_documents').select('id', { count: 'exact', head: true }).eq('user_id', s.userId).eq('file_path', path),
  ])
  if ((a ?? 0) + (d ?? 0) === 0) await removeFiles(s.supabase, [path])
  return { success: true, data: null }
}
