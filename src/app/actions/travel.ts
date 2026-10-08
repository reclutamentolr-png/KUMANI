'use server'

import { createClient } from '@/lib/supabase/server'
import { awardToolPoint } from '@/lib/toolPoints'
import { isToolOnline } from '@/lib/toolOnline'
import {
  CURRENCIES,
  DOC_TYPES,
  EXPENSE_CATEGORIES,
  type TripActivity,
  type TripChecklistItem,
  type TripDetail,
  type TripDocument,
  type TripExpense,
  type TripSettlement,
  type TripSummary,
} from '@/lib/travel'
import { limitError } from '@/lib/appLimits'

// KUMANI Travel: le regole (chi crea, chi entra, chi vede) sono nelle
// funzioni SQL trip_* e nelle RLS; qui solo validazione e passaggio dati.

type Result = { success: true; id?: string } | { success: false; error: string; limitText?: string }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const clean = (value: string | null | undefined, max: number) => {
  const text = (value ?? '').trim().slice(0, max)
  return text === '' ? null : text
}
// Data reale (niente 2026-13-45): il giorno deve esistere nel calendario.
const validDate = (value: string | null | undefined) => {
  if (!value || !DATE_RE.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null
}

// Importi scritti a mano: "12,50", "1.234,56", "1,234.56", "1 234". L'ultimo
// punto o virgola è il separatore dei decimali, gli altri sono migliaia.
const parseNumber = (value: string) => {
  const text = value.replace(/[\s']/g, '')
  if (text === '') return Number.NaN
  const decimal = Math.max(text.lastIndexOf(','), text.lastIndexOf('.'))
  if (decimal < 0) return Number(text)
  return Number(`${text.slice(0, decimal).replace(/[.,]/g, '')}.${text.slice(decimal + 1)}`)
}

export async function listTrips(): Promise<TripSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('trip_list')
  if (error) {
    console.error('[Travel] trip_list failed:', error.message)
    return []
  }
  return (data as TripSummary[] | null) ?? []
}

export async function createTrip(input: {
  title: string
  destination: string
  startsOn: string
  endsOn: string
  emoji: string
  checklist: string[]
  baseCurrency?: string
}): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  const title = clean(input.title, 80)
  if (!title) return { success: false, error: 'invalid' }
  const startsOn = validDate(input.startsOn)
  const endsOn = validDate(input.endsOn) ?? startsOn
  if (startsOn && endsOn && endsOn < startsOn) return { success: false, error: 'dates' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('trip_create', {
    p_title: title,
    p_destination: clean(input.destination, 80),
    p_starts: startsOn,
    p_ends: startsOn ? endsOn : null,
    p_emoji: clean(input.emoji, 8),
    p_checklist: input.checklist.slice(0, 40).map((item) => item.slice(0, 120)),
  })
  if (error) {
    console.error('[Travel] trip_create failed:', error.message)
    return { success: false, error: 'saveError' }
  }
  const result = data as { id?: string; error?: string }
  if (!result?.id) return { success: false, error: result?.error ?? 'saveError' }
  // Valuta del viaggio scelta nel modulo (trip_create parte sempre dall'euro)
  if (input.baseCurrency && input.baseCurrency !== 'EUR' && (CURRENCIES as readonly string[]).includes(input.baseCurrency)) {
    await supabase.from('trips').update({ base_currency: input.baseCurrency }).eq('id', result.id)
  }
  await awardToolPoint('travel')
  return { success: true, id: result.id }
}

export async function joinTrip(code: string): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  const normalized = code.trim().toUpperCase()
  if (!/^[A-Z0-9]{4,12}$/.test(normalized)) return { success: false, error: 'not_found' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'not_allowed' }
  const { data, error } = await supabase.rpc('trip_join', { p_code: normalized })
  if (error) {
    console.error('[Travel] trip_join failed:', error.message)
    return { success: false, error: 'saveError' }
  }
  const result = data as { id?: string; error?: string }
  return result?.id ? { success: true, id: result.id } : { success: false, error: result?.error ?? 'saveError' }
}

// Nuovo codice invito (solo organizzatore): il vecchio link smette di
// funzionare e chi era uscito o è stato tolto può rientrare solo con questo.
export async function rotateInviteCode(tripId: string): Promise<{ success: true; code: string } | { success: false; error: string }> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(tripId)) return { success: false, error: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('trip_rotate_code', { p_trip: tripId })
  if (error || typeof data !== 'string') return { success: false, error: error ? 'saveError' : 'not_allowed' }
  return { success: true, code: data }
}

export type TripBundle = {
  detail: TripDetail
  activities: TripActivity[]
  checklist: TripChecklistItem[]
  expenses: TripExpense[]
  settlements: TripSettlement[]
  documents: TripDocument[]
}

export async function getTripBundle(tripId: string): Promise<TripBundle | null> {
  if (!UUID_RE.test(tripId)) return null
  const supabase = await createClient()
  const [{ data: detail }, { data: activities }, { data: checklist }, { data: expenses }, { data: settlements }, { data: documents }] = await Promise.all([
    supabase.rpc('trip_detail', { p_trip: tripId }),
    supabase
      .from('trip_activities')
      .select('id, trip_id, day, time, title, place, map_link, notes, cost_amount, responsible_id, position')
      .eq('trip_id', tripId),
    supabase.from('trip_checklist').select('id, trip_id, title, assigned_to, done, position').eq('trip_id', tripId).order('position').order('created_at'),
    supabase
      .from('trip_expenses')
      .select('id, trip_id, paid_by, amount, currency, rate_to_base, category, description, spent_on, split_between, created_by')
      .eq('trip_id', tripId)
      .order('spent_on', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('trip_settlements').select('id, from_member, to_member, amount, created_by, created_at').eq('trip_id', tripId).order('created_at'),
    // Le RLS restituiscono i miei documenti (tutti, se organizzo io il viaggio)
    supabase.from('trip_documents').select('id, member_id, doc_type, label, expires_on, life_calendar_item_id').eq('trip_id', tripId),
  ])
  if (!detail) return null
  return {
    detail: detail as TripDetail,
    activities: ((activities ?? []) as TripActivity[]).map((a) => ({ ...a, cost_amount: a.cost_amount === null ? null : Number(a.cost_amount) })),
    checklist: (checklist ?? []) as TripChecklistItem[],
    expenses: ((expenses ?? []) as TripExpense[]).map((e) => ({ ...e, amount: Number(e.amount), rate_to_base: Number(e.rate_to_base) })),
    settlements: ((settlements ?? []) as TripSettlement[]).map((s) => ({ ...s, amount: Number(s.amount) })),
    documents: (documents ?? []) as TripDocument[],
  }
}

export async function updateTrip(
  tripId: string,
  input: { title: string; destination: string; startsOn: string; endsOn: string; emoji: string; membersCanEdit: boolean; baseCurrency?: string }
): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  const title = clean(input.title, 80)
  if (!UUID_RE.test(tripId) || !title) return { success: false, error: 'invalid' }
  const startsOn = validDate(input.startsOn)
  const endsOn = validDate(input.endsOn) ?? startsOn
  if (startsOn && endsOn && endsOn < startsOn) return { success: false, error: 'dates' }
  const supabase = await createClient()
  // La valuta del viaggio si cambia solo finché non ci sono spese (i tassi
  // registrati si riferiscono a quella valuta).
  let currencyPatch = {}
  if (input.baseCurrency && (CURRENCIES as readonly string[]).includes(input.baseCurrency)) {
    const { data: current } = await supabase.from('trips').select('base_currency').eq('id', tripId).maybeSingle()
    if (current && current.base_currency !== input.baseCurrency) {
      const { count } = await supabase.from('trip_expenses').select('id', { count: 'exact', head: true }).eq('trip_id', tripId)
      if ((count ?? 0) > 0) return { success: false, error: 'currency_locked' }
      currencyPatch = { base_currency: input.baseCurrency }
    }
  }
  const { data, error } = await supabase
    .from('trips')
    .update({
      ...currencyPatch,
      title,
      destination: clean(input.destination, 80),
      starts_on: startsOn,
      ends_on: startsOn ? endsOn : null,
      cover_emoji: clean(input.emoji, 8) ?? '✈️',
      members_can_edit: input.membersCanEdit,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId)
    .select('id')
  if (error || !data?.length) return { success: false, error: 'saveError' }
  return { success: true }
}

export async function deleteTrip(tripId: string): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(tripId)) return { success: false, error: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('trips').delete().eq('id', tripId).select('id')
  if (error || !data?.length) return { success: false, error: 'saveError' }
  return { success: true }
}

export async function removeTripMember(memberId: string): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(memberId)) return { success: false, error: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('trip_remove_member', { p_member: memberId })
  if (error) return { success: false, error: 'saveError' }
  return data === 'ok' ? { success: true } : { success: false, error: String(data) }
}

export async function saveActivity(
  tripId: string,
  input: {
    id?: string
    day: string
    time: string
    title: string
    place: string
    mapLink: string
    notes: string
    cost: string
    responsibleId: string
  }
): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  const title = clean(input.title, 120)
  const day = validDate(input.day)
  if (!UUID_RE.test(tripId) || !title || !day) return { success: false, error: 'invalid' }
  const time = input.time && TIME_RE.test(input.time) ? input.time : null
  const mapLink = clean(input.mapLink, 500)
  if (mapLink && !/^https?:\/\//i.test(mapLink)) return { success: false, error: 'invalidLink' }
  const cost = input.cost.trim() === '' ? null : parseNumber(input.cost)
  if (cost !== null && (!Number.isFinite(cost) || cost < 0)) return { success: false, error: 'invalid' }
  const responsibleId = input.responsibleId && UUID_RE.test(input.responsibleId) ? input.responsibleId : null

  const row = {
    day,
    time,
    title,
    place: clean(input.place, 160),
    map_link: mapLink,
    notes: clean(input.notes, 1000),
    cost_amount: cost,
    responsible_id: responsibleId,
  }
  const supabase = await createClient()
  if (input.id) {
    if (!UUID_RE.test(input.id)) return { success: false, error: 'invalid' }
    const { data, error } = await supabase.from('trip_activities').update(row).eq('id', input.id).eq('trip_id', tripId).select('id')
    if (error || !data?.length) return { success: false, error: 'saveError' }
    return { success: true, id: input.id }
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'not_allowed' }
  const { data, error } = await supabase
    .from('trip_activities')
    .insert({ ...row, trip_id: tripId, created_by: user.id })
    .select('id')
    .single()
  if (error || !data) return { success: false, error: 'saveError' }
  await awardToolPoint('travel')
  return { success: true, id: data.id }
}

export async function deleteActivity(activityId: string): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(activityId)) return { success: false, error: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('trip_activities').delete().eq('id', activityId).select('id')
  if (error || !data?.length) return { success: false, error: 'saveError' }
  return { success: true }
}

export async function addChecklistItem(tripId: string, title: string, assignedTo: string): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  const text = clean(title, 120)
  if (!UUID_RE.test(tripId) || !text) return { success: false, error: 'invalid' }
  const supabase = await createClient()
  const { count } = await supabase.from('trip_checklist').select('id', { count: 'exact', head: true }).eq('trip_id', tripId)
  const { error } = await supabase.from('trip_checklist').insert({
    trip_id: tripId,
    title: text,
    assigned_to: assignedTo && UUID_RE.test(assignedTo) ? assignedTo : null,
    position: count ?? 0,
  })
  if (error) {
    const limit = await limitError(error)
    return limit ? { success: false, error: 'limitReached', limitText: limit.limitText } : { success: false, error: 'saveError' }
  }
  return { success: true }
}

export async function updateChecklistItem(itemId: string, patch: { done?: boolean; assignedTo?: string | null }): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(itemId)) return { success: false, error: 'invalid' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'not_allowed' }
  const row: Record<string, unknown> = {}
  if (patch.done !== undefined) {
    row.done = patch.done
    row.done_by = patch.done ? user.id : null
  }
  if (patch.assignedTo !== undefined) row.assigned_to = patch.assignedTo && UUID_RE.test(patch.assignedTo) ? patch.assignedTo : null
  const { data, error } = await supabase.from('trip_checklist').update(row).eq('id', itemId).select('id')
  if (error || !data?.length) return { success: false, error: 'saveError' }
  return { success: true }
}

export async function deleteChecklistItem(itemId: string): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(itemId)) return { success: false, error: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('trip_checklist').delete().eq('id', itemId).select('id')
  if (error || !data?.length) return { success: false, error: 'saveError' }
  return { success: true }
}

// ---------------------------------------------------------------------------
// Fase 2: spese, rimborsi, documenti
// ---------------------------------------------------------------------------

export async function saveExpense(
  tripId: string,
  input: {
    id?: string
    description: string
    amount: string
    currency: string
    rate: string
    category: string
    spentOn: string
    paidBy: string
    splitBetween: string[]
  }
): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  const description = clean(input.description, 120)
  const spentOn = validDate(input.spentOn)
  const amount = parseNumber(input.amount)
  const currency = input.currency.toUpperCase()
  const split = [...new Set(input.splitBetween.filter((id) => UUID_RE.test(id)))]
  if (!UUID_RE.test(tripId) || !description || !spentOn || !UUID_RE.test(input.paidBy) || split.length === 0) return { success: false, error: 'invalid' }
  // Almeno 1 centesimo dopo l'arrotondamento (il database rifiuta 0)
  if (!Number.isFinite(amount) || Math.round(amount * 100) <= 0 || amount > 10_000_000) return { success: false, error: 'amount' }
  if (!/^[A-Z]{3}$/.test(currency)) return { success: false, error: 'invalid' }
  const category = (EXPENSE_CATEGORIES as readonly string[]).includes(input.category) ? input.category : 'other'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'not_allowed' }
  const { data: trip } = await supabase.from('trips').select('base_currency').eq('id', tripId).maybeSingle()
  if (!trip) return { success: false, error: 'not_allowed' }
  let rate = 1
  if (currency !== trip.base_currency) {
    rate = parseNumber(input.rate)
    if (!Number.isFinite(rate) || rate <= 0) return { success: false, error: 'rate' }
  }

  const row = {
    description,
    amount: Math.round(amount * 100) / 100,
    currency,
    rate_to_base: rate,
    category,
    spent_on: spentOn,
    paid_by: input.paidBy,
    split_between: split,
  }
  if (input.id) {
    if (!UUID_RE.test(input.id)) return { success: false, error: 'invalid' }
    const { data, error } = await supabase.from('trip_expenses').update(row).eq('id', input.id).eq('trip_id', tripId).select('id')
    if (error || !data?.length) return { success: false, error: 'saveError' }
    return { success: true, id: input.id }
  }
  const { data, error } = await supabase.from('trip_expenses').insert({ ...row, trip_id: tripId, created_by: user.id }).select('id').single()
  if (error || !data) return { success: false, error: 'saveError' }
  await awardToolPoint('travel')
  return { success: true, id: data.id }
}

export async function deleteExpense(expenseId: string): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(expenseId)) return { success: false, error: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('trip_expenses').delete().eq('id', expenseId).select('id')
  if (error || !data?.length) return { success: false, error: 'saveError' }
  return { success: true }
}

// Registra un rimborso (importo in centesimi, nella valuta del viaggio).
export async function addSettlement(tripId: string, fromMember: string, toMember: string, amountCents: number): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (![tripId, fromMember, toMember].every((id) => UUID_RE.test(id)) || fromMember === toMember) return { success: false, error: 'invalid' }
  if (!Number.isInteger(amountCents) || amountCents <= 0) return { success: false, error: 'amount' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'not_allowed' }
  const { error } = await supabase
    .from('trip_settlements')
    .insert({ trip_id: tripId, from_member: fromMember, to_member: toMember, amount: amountCents / 100, created_by: user.id })
  if (error) return { success: false, error: 'not_allowed' }
  return { success: true }
}

export async function deleteSettlement(settlementId: string): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(settlementId)) return { success: false, error: 'invalid' }
  const supabase = await createClient()
  const { data, error } = await supabase.from('trip_settlements').delete().eq('id', settlementId).select('id')
  if (error || !data?.length) return { success: false, error: 'saveError' }
  return { success: true }
}

// Documenti richiesti per il viaggio (lo decide l'organizzatore).
export async function setRequiredDocs(tripId: string, docs: string[]): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(tripId)) return { success: false, error: 'invalid' }
  const list = [...new Set(docs.filter((d) => (DOC_TYPES as readonly string[]).includes(d)))]
  const supabase = await createClient()
  const { data, error } = await supabase.from('trips').update({ required_docs: list }).eq('id', tripId).select('id')
  if (error || !data?.length) return { success: false, error: 'saveError' }
  return { success: true }
}

// Un mio documento: tipo e scadenza. Se chiesto (e se ho Life Calendar), la
// scadenza finisce anche nel mio scadenziario personale.
export async function saveDocument(
  tripId: string,
  input: { id?: string; docType: string; label: string; expiresOn: string; addToLifeCalendar: boolean; reminderTitle: string }
): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(tripId) || !(DOC_TYPES as readonly string[]).includes(input.docType)) return { success: false, error: 'invalid' }
  const expiresOn = validDate(input.expiresOn)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'not_allowed' }
  const { data: member } = await supabase.from('trip_members').select('id').eq('trip_id', tripId).eq('user_id', user.id).maybeSingle()
  if (!member) return { success: false, error: 'not_allowed' }

  let lifeCalendarId: string | null = null
  if (input.id) {
    if (!UUID_RE.test(input.id)) return { success: false, error: 'invalid' }
    const { data } = await supabase.from('trip_documents').select('life_calendar_item_id').eq('id', input.id).eq('member_id', member.id).maybeSingle()
    if (!data) return { success: false, error: 'not_allowed' }
    lifeCalendarId = data.life_calendar_item_id
  }

  // Scadenza tolta: via anche il promemoria collegato nello scadenziario
  if (!expiresOn && lifeCalendarId) {
    const { error } = await supabase.from('life_calendar_items').delete().eq('id', lifeCalendarId).eq('user_id', user.id)
    if (error) return { success: false, error: 'saveError' }
    lifeCalendarId = null
  }

  // Scadenziario personale (Life Calendar): crea o aggiorna il promemoria.
  if (expiresOn && (input.addToLifeCalendar || lifeCalendarId)) {
    const { data: access } = await supabase.rpc('can_use_tool', { p_tool: 'life-calendar' }).maybeSingle<{ allowed: boolean }>()
    if (access?.allowed) {
      const title = clean(input.reminderTitle, 120) ?? input.docType
      if (lifeCalendarId) {
        const { error } = await supabase
          .from('life_calendar_items')
          .update({ title, due_date: expiresOn, updated_at: new Date().toISOString() })
          .eq('id', lifeCalendarId)
          .eq('user_id', user.id)
        if (error) return { success: false, error: 'saveError' }
      } else {
        const { data: item, error } = await supabase
          .from('life_calendar_items')
          .insert({ user_id: user.id, title, category: 'travel', due_date: expiresOn, reminder_offsets: [90, 30, 7], recurrence: 'none' })
          .select('id')
          .single()
        if (error) return { success: false, error: 'saveError' }
        lifeCalendarId = item?.id ?? null
      }
    }
  }

  const row = {
    doc_type: input.docType,
    label: clean(input.label, 60),
    expires_on: expiresOn,
    life_calendar_item_id: lifeCalendarId,
    updated_at: new Date().toISOString(),
  }
  if (input.id) {
    const { data, error } = await supabase.from('trip_documents').update(row).eq('id', input.id).select('id')
    if (error || !data?.length) return { success: false, error: 'saveError' }
    return { success: true, id: input.id }
  }
  const { data, error } = await supabase.from('trip_documents').insert({ ...row, trip_id: tripId, member_id: member.id }).select('id').single()
  if (error || !data) {
    const limit = await limitError(error)
    return limit ? { success: false, error: 'limitReached', limitText: limit.limitText } : { success: false, error: 'saveError' }
  }
  return { success: true, id: data.id }
}

export async function deleteDocument(documentId: string): Promise<Result> {
  if (!(await isToolOnline('travel'))) return { success: false, error: 'suspended' }
  if (!UUID_RE.test(documentId)) return { success: false, error: 'invalid' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'not_allowed' }
  const { data, error } = await supabase.from('trip_documents').delete().eq('id', documentId).select('id, life_calendar_item_id')
  if (error || !data?.length) return { success: false, error: 'saveError' }
  // Promemoria collegato nello scadenziario: non serve più
  const linked = data[0].life_calendar_item_id as string | null
  if (linked) await supabase.from('life_calendar_items').delete().eq('id', linked).eq('user_id', user.id)
  return { success: true }
}
