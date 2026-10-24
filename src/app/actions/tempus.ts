'use server'

import { createHash } from 'crypto'
import { headers } from 'next/headers'
import { getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { localizedPath, notifyUser } from '@/lib/push'
import { utcToZoned, zonedToUtc } from '@/lib/events'
import { locales } from '../../../i18n'
import {
  addDays,
  cleanHours,
  daySlots,
  DEFAULT_HOURS,
  formatWhen,
  isDay,
  isTime,
  SLOT_STEPS,
  TEMPUS_DAYS_PER_PAGE,
  TEMPUS_TIMEZONES,
  tempusSlugProblem,
  todayIn,
  type Slot,
  type TempusBooking,
  type TempusClosure,
  type TempusService,
  type TempusSettings,
} from '@/lib/tempus'
import {
  BOOKING_COLUMNS,
  emailCustomerCancelled,
  emailCustomerConfirmed,
  emailOwner,
  loadBusiness,
  loadBusy,
  loadClosures,
  loadPublicTempus,
  loadTempusForViewer,
  SERVICE_COLUMNS,
  SETTINGS_COLUMNS,
  settingsFromRow,
  tempusDb,
} from '@/lib/tempus-server'

// KUMANI TEMPUS (piano Pro): azioni del titolare (pagina, servizi, chiusure,
// agenda) e della pagina pubblica (orari liberi, prenotazione, disdetta).

type Fail = { success: false; message: string }
type Supabase = Awaited<ReturnType<typeof createClient>>

async function gate(): Promise<{ ok: true; supabase: Supabase; userId: string } | { ok: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'notLoggedIn' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'tempus'))) return { ok: false, message: 'proRequired' }
  return { ok: true, supabase, userId: user.id }
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '')
const cleanEmail = (v: unknown) => {
  const email = clean(v, 160).toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : ''
}
const cleanPhone = (v: unknown) => clean(v, 40).replace(/[^\d+\s().-]/g, '')
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
const pickLocale = (v: unknown) => (typeof v === 'string' && locales.includes(v) ? v : 'it')

// --- Pagina e impostazioni ----------------------------------------------------

export async function checkTempusSlug(slugInput: string): Promise<{ ok: boolean; message?: string }> {
  const g = await gate()
  if (!g.ok) return { ok: false, message: g.message }
  const slug = clean(slugInput, 40).toLowerCase()
  const problem = tempusSlugProblem(slug)
  if (problem) return { ok: false, message: problem }
  const { data } = await tempusDb().from('tempus_pages').select('owner_id').eq('slug', slug).maybeSingle()
  if (data && data.owner_id !== g.userId) return { ok: false, message: 'slugTaken' }
  return { ok: true }
}

export type TempusPageInput = Omit<TempusSettings, 'suspended' | 'suspended_reason'>

export async function saveTempusPage(input: TempusPageInput): Promise<{ success: true; settings: TempusSettings } | Fail> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const slug = clean(input.slug, 40).toLowerCase()
  const problem = tempusSlugProblem(slug)
  if (problem) return { success: false, message: problem }
  const { data: taken } = await tempusDb().from('tempus_pages').select('owner_id').eq('slug', slug).maybeSingle()
  if (taken && taken.owner_id !== g.userId) return { success: false, message: 'slugTaken' }

  const row = {
    slug,
    is_published: input.is_published === true,
    title: clean(input.title, 80),
    intro: clean(input.intro, 600),
    show_prices: input.show_prices !== false,
    timezone: (TEMPUS_TIMEZONES as readonly string[]).includes(input.timezone) ? input.timezone : 'Europe/Rome',
    slot_step: (SLOT_STEPS as readonly number[]).includes(Number(input.slot_step)) ? Number(input.slot_step) : 30,
    buffer_min: int(input.buffer_min, 0, 120, 0),
    min_notice_min: int(input.min_notice_min, 0, 10080, 120),
    max_days_ahead: int(input.max_days_ahead, 1, 365, 60),
    cancel_limit_hours: int(input.cancel_limit_hours, 0, 168, 24),
    hours: cleanHours(input.hours),
    owner_locale: pickLocale(await getLocale()),
  }
  const { data: existing } = await g.supabase.from('tempus_pages').select('owner_id').maybeSingle()
  const query = existing ? g.supabase.from('tempus_pages').update(row).eq('owner_id', g.userId) : g.supabase.from('tempus_pages').insert(row)
  const { data, error } = await query.select(SETTINGS_COLUMNS).single()
  if (error) {
    if (error.code === '23505') return { success: false, message: 'slugTaken' }
    console.error('[TEMPUS] pagina non salvata:', error.message)
    return { success: false, message: 'saveError' }
  }
  await awardToolPoint('tempus')
  return { success: true, settings: settingsFromRow(data as Record<string, unknown>) }
}

// Primo avvio: pagina non pubblicata con gli orari di esempio e l'indirizzo scelto
export async function startTempus(slugInput: string): Promise<{ success: true; settings: TempusSettings } | Fail> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const biz = await loadBusiness(g.userId)
  return saveTempusPage({
    slug: slugInput,
    is_published: false,
    title: biz.name,
    intro: '',
    show_prices: true,
    timezone: 'Europe/Rome',
    slot_step: 30,
    buffer_min: 0,
    min_notice_min: 120,
    max_days_ahead: 60,
    cancel_limit_hours: 24,
    hours: DEFAULT_HOURS,
  })
}

// --- Servizi -----------------------------------------------------------------

export async function saveTempusService(input: Partial<TempusService> & { name: string; duration_min: number }): Promise<{ success: true; service: TempusService } | Fail> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const name = clean(input.name, 80)
  if (!name) return { success: false, message: 'serviceNameRequired' }
  const price = input.price_cents == null || (input.price_cents as unknown) === '' ? null : int(input.price_cents, 0, 10_000_000, 0)
  const row = {
    name,
    description: clean(input.description, 300),
    duration_min: int(input.duration_min, 5, 600, 30),
    price_cents: price,
    active: input.active !== false,
    sort: int(input.sort, 0, 999, 0),
  }
  const query = input.id ? g.supabase.from('tempus_services').update(row).eq('id', input.id) : g.supabase.from('tempus_services').insert(row)
  const { data, error } = await query.select(SERVICE_COLUMNS).single()
  if (error) {
    if (/tempus_limit/.test(error.message)) return { success: false, message: 'tooManyServices' }
    console.error('[TEMPUS] servizio non salvato:', error.message)
    return { success: false, message: 'saveError' }
  }
  return { success: true, service: data as TempusService }
}

export async function deleteTempusService(id: string): Promise<{ success: boolean }> {
  const g = await gate()
  if (!g.ok) return { success: false }
  const { error } = await g.supabase.from('tempus_services').delete().eq('id', id)
  return { success: !error }
}

// --- Chiusure ----------------------------------------------------------------

export async function addTempusClosure(input: { starts_on: string; ends_on: string; note: string }): Promise<{ success: true; closure: TempusClosure } | Fail> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (!isDay(input.starts_on) || !isDay(input.ends_on) || input.ends_on < input.starts_on) return { success: false, message: 'invalidDates' }
  const { data, error } = await g.supabase
    .from('tempus_closures')
    .insert({ starts_on: input.starts_on, ends_on: input.ends_on, note: clean(input.note, 120) })
    .select('id, starts_on, ends_on, note')
    .single()
  if (error) return { success: false, message: /tempus_limit/.test(error.message) ? 'tooManyClosures' : 'invalidDates' }
  return { success: true, closure: data as TempusClosure }
}

export async function deleteTempusClosure(id: string): Promise<{ success: boolean }> {
  const g = await gate()
  if (!g.ok) return { success: false }
  const { error } = await g.supabase.from('tempus_closures').delete().eq('id', id)
  return { success: !error }
}

// --- Agenda ------------------------------------------------------------------

// Prenotazioni di 7 giorni a partire da `from` (giorni nel fuso dell'attività)
export async function tempusAgenda(from: string): Promise<{ success: true; bookings: TempusBooking[] } | Fail> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  if (!isDay(from)) return { success: false, message: 'invalidDates' }
  const { data: page } = await g.supabase.from('tempus_pages').select('timezone').maybeSingle()
  const tz = page?.timezone ?? 'Europe/Rome'
  const { data, error } = await g.supabase
    .from('tempus_bookings')
    .select(BOOKING_COLUMNS)
    .gte('starts_at', zonedToUtc(from, '00:00', tz))
    .lt('starts_at', zonedToUtc(addDays(from, 7), '00:00', tz))
    .order('starts_at')
  if (error) return { success: false, message: 'loadError' }
  return { success: true, bookings: (data ?? []) as TempusBooking[] }
}

type BookingRow = TempusBooking & { cancel_token: string; locale: string }

// Al browser del titolare solo i campi dell'agenda (niente codice di disdetta)
function toBooking(row: BookingRow): TempusBooking {
  const booking: Partial<BookingRow> = { ...row }
  delete booking.cancel_token
  delete booking.locale
  return booking as TempusBooking
}

async function businessForEmail(ownerId: string, settings: Pick<TempusSettings, 'title' | 'timezone' | 'show_prices' | 'cancel_limit_hours' | 'slug'>) {
  const biz = await loadBusiness(ownerId)
  return {
    displayName: settings.title || biz.name || settings.slug,
    timezone: settings.timezone,
    address: biz.address,
    phone: biz.phone || biz.whatsapp,
    showPrices: settings.show_prices,
    cancelLimitHours: settings.cancel_limit_hours,
  }
}

// Appuntamento preso dal titolare (al telefono, in negozio). Gli orari di
// apertura non contano (decide lui); un orario già occupato invece sì.
export async function addManualBooking(input: {
  serviceId: string
  date: string
  time: string
  name: string
  phone: string
  email: string
  note: string
  sendEmail: boolean
}): Promise<{ success: true; booking: TempusBooking } | Fail> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const name = clean(input.name, 80)
  if (!name) return { success: false, message: 'nameRequired' }
  if (!isDay(input.date) || !isTime(input.time)) return { success: false, message: 'invalidDates' }
  const { data: page } = await g.supabase.from('tempus_pages').select('timezone, title, show_prices, cancel_limit_hours, slug').maybeSingle()
  if (!page) return { success: false, message: 'noPage' }
  const email = cleanEmail(input.email)
  const db = tempusDb()
  const { data, error } = await db.rpc('tempus_book', {
    p_owner: g.userId,
    p_service: input.serviceId,
    p_starts: zonedToUtc(input.date, input.time, page.timezone),
    p_name: name,
    p_phone: cleanPhone(input.phone),
    p_email: email,
    p_note: clean(input.note, 500),
    p_source: 'manual',
    p_locale: pickLocale(await getLocale()),
    p_user: null,
    p_sender_hash: null,
  })
  if (error) return { success: false, message: /tempus_taken/.test(error.message) ? 'slotTaken' : /tempus_service/.test(error.message) ? 'serviceMissing' : 'saveError' }
  const id = (data as { booking_id: string }[])?.[0]?.booking_id
  const { data: row } = await db.from('tempus_bookings').select(`${BOOKING_COLUMNS}, cancel_token, locale`).eq('id', id).single<BookingRow>()
  if (!row) return { success: false, message: 'saveError' }
  if (input.sendEmail && email) await emailCustomerConfirmed(row, await businessForEmail(g.userId, page))
  return { success: true, booking: toBooking(row) }
}

// Annullata dal titolare (con un messaggio facoltativo per il cliente),
// segnata come «non si è presentato» o di nuovo confermata
export async function setTempusBookingStatus(id: string, status: 'cancelled' | 'no_show' | 'confirmed', message = ''): Promise<{ success: boolean; message?: string }> {
  const g = await gate()
  if (!g.ok) return { success: false, message: g.message }
  const patch =
    status === 'cancelled'
      ? { status, cancelled_by: 'owner', cancelled_at: new Date().toISOString() }
      : { status, cancelled_by: null, cancelled_at: null }
  const { data: row, error } = await g.supabase.from('tempus_bookings').update(patch).eq('id', id).select(`${BOOKING_COLUMNS}`).single<TempusBooking>()
  if (error || !row) return { success: false, message: /tempus_cancelled/.test(error?.message ?? '') ? 'cannotRestore' : 'saveError' }
  if (status === 'cancelled' && row.customer_email && new Date(row.starts_at).getTime() > Date.now()) {
    const db = tempusDb()
    const [{ data: full }, { data: page }] = await Promise.all([
      db.from('tempus_bookings').select('id, service_name, price_cents, starts_at, customer_name, customer_phone, customer_email, customer_note, cancel_token, locale').eq('id', id).single<BookingRow>(),
      g.supabase.from('tempus_pages').select('timezone, title, show_prices, cancel_limit_hours, slug').maybeSingle(),
    ])
    if (full && page) await emailCustomerCancelled(full, await businessForEmail(g.userId, page), clean(message, 300))
  }
  return { success: true }
}

export async function saveTempusOwnerNote(id: string, note: string): Promise<{ success: boolean }> {
  const g = await gate()
  if (!g.ok) return { success: false }
  const { error } = await g.supabase.from('tempus_bookings').update({ owner_note: clean(note, 500) || null }).eq('id', id)
  return { success: !error }
}

export async function deleteTempusBooking(id: string): Promise<{ success: boolean }> {
  const g = await gate()
  if (!g.ok) return { success: false }
  const { error } = await g.supabase.from('tempus_bookings').delete().eq('id', id)
  return { success: !error }
}

// --- Pagina pubblica ---------------------------------------------------------

export type TempusDay = { date: string; slots: Slot[] }

// Orari liberi per 14 giorni da `from` (oggi se manca o è nel passato)
export async function tempusAvailability(slug: string, serviceId: string, from?: string): Promise<{ success: true; days: TempusDay[]; more: boolean } | { success: false }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const page = (await loadTempusForViewer(slug, user?.id ?? null))?.page
  const service = page?.services.find((s) => s.id === serviceId)
  if (!page || !service) return { success: false }
  const { settings } = page
  const today = todayIn(settings.timezone)
  const last = addDays(today, settings.max_days_ahead)
  const start = from && isDay(from) && from > today ? (from > last ? last : from) : today
  const dates = Array.from({ length: TEMPUS_DAYS_PER_PAGE }, (_, i) => addDays(start, i)).filter((d) => d <= last)
  const [busy, closures] = await Promise.all([
    loadBusy(page.ownerId, zonedToUtc(dates[0], '00:00', settings.timezone), zonedToUtc(addDays(dates[dates.length - 1], 1), '00:00', settings.timezone)),
    loadClosures(page.ownerId, dates[0]),
  ])
  const days = dates.map((date) => ({ date, slots: daySlots({ date, settings, durationMin: service.duration_min, closures, busy }) }))
  return { success: true, days, more: addDays(start, TEMPUS_DAYS_PER_PAGE) <= last }
}

export type TempusBookResult =
  | { success: true; token: string; startsAt: string; endsAt: string; serviceName: string }
  | { success: false; reason: 'invalid' | 'slotTaken' | 'tooMany' | 'unavailable' | 'error' }

export async function bookTempus(input: {
  slug: string
  serviceId: string
  startsAt: string
  name: string
  phone: string
  email: string
  note: string
  consent: boolean
  website: string
  locale: string
}): Promise<TempusBookResult> {
  // Campo trappola compilato: è un robot
  if (input.website) return { success: false, reason: 'invalid' }
  const name = clean(input.name, 80)
  const phone = cleanPhone(input.phone)
  const email = cleanEmail(input.email)
  const note = clean(input.note, 500)
  if (!input.consent || !name || phone.replace(/\D/g, '').length < 6 || (clean(input.email, 160) && !email)) return { success: false, reason: 'invalid' }

  const page = await loadPublicTempus(input.slug)
  const service = page?.services.find((s) => s.id === input.serviceId)
  if (!page || !service) return { success: false, reason: 'unavailable' }
  const { settings, ownerId } = page

  // L'orario dev'essere ancora tra quelli liberi (apertura, preavviso, chiusure)
  const startMs = Date.parse(input.startsAt)
  if (!Number.isFinite(startMs)) return { success: false, reason: 'invalid' }
  const date = utcToZoned(new Date(startMs).toISOString(), settings.timezone).date
  const [busy, closures] = await Promise.all([
    loadBusy(ownerId, zonedToUtc(date, '00:00', settings.timezone), zonedToUtc(addDays(date, 1), '00:00', settings.timezone)),
    loadClosures(ownerId, date),
  ])
  const free = daySlots({ date, settings, durationMin: service.duration_min, closures, busy }).some((s) => Date.parse(s.startsAt) === startMs)
  if (!free) return { success: false, reason: 'slotTaken' }

  // Contro lo spam: 3 prenotazioni l'ora dallo stesso dispositivo, 3 future
  // con lo stesso telefono o email, 60 al giorno per attività
  const db = tempusDb()
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  const senderHash = createHash('sha256').update(`${ip}|${ownerId}`).digest('hex').slice(0, 32)
  const nowIso = new Date().toISOString()
  const future = db.from('tempus_bookings').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('status', 'confirmed').gt('starts_at', nowIso)
  const [{ count: recent }, { count: byPhone }, { count: byEmail }, { count: today }] = await Promise.all([
    db.from('tempus_bookings').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('sender_hash', senderHash).gte('created_at', new Date(Date.now() - 3_600_000).toISOString()),
    future.eq('customer_phone', phone),
    email
      ? db.from('tempus_bookings').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('status', 'confirmed').gt('starts_at', nowIso).eq('customer_email', email)
      : Promise.resolve({ count: 0 }),
    db.from('tempus_bookings').select('id', { count: 'exact', head: true }).eq('owner_id', ownerId).eq('source', 'online').gte('created_at', new Date(Date.now() - 86_400_000).toISOString()),
  ])
  if ((recent ?? 0) >= 3 || (byPhone ?? 0) >= 3 || (byEmail ?? 0) >= 3 || (today ?? 0) >= 60) return { success: false, reason: 'tooMany' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const locale = pickLocale(input.locale)
  const { data, error } = await db.rpc('tempus_book', {
    p_owner: ownerId,
    p_service: service.id,
    p_starts: new Date(startMs).toISOString(),
    p_name: name,
    p_phone: phone,
    p_email: email,
    p_note: note,
    p_source: 'online',
    p_locale: locale,
    p_user: user?.id ?? null,
    p_sender_hash: senderHash,
  })
  if (error) {
    if (/tempus_taken/.test(error.message)) return { success: false, reason: 'slotTaken' }
    if (/tempus_service/.test(error.message)) return { success: false, reason: 'unavailable' }
    console.error('[TEMPUS] prenotazione non salvata:', error.message)
    return { success: false, reason: 'error' }
  }
  const created = (data as { booking_id: string; cancel_token: string }[])?.[0]
  if (!created) return { success: false, reason: 'error' }
  const { data: row } = await db.from('tempus_bookings').select(`${BOOKING_COLUMNS}, cancel_token, locale`).eq('id', created.booking_id).single<BookingRow>()
  if (row) {
    const { data: ownerPage } = await db.from('tempus_pages').select('owner_locale').eq('owner_id', ownerId).maybeSingle()
    const when = (loc: string) => formatWhen(row.starts_at, settings.timezone, loc, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    await Promise.all([
      emailCustomerConfirmed(row, { displayName: page.displayName, timezone: settings.timezone, address: page.business.address, phone: page.business.phone || page.business.whatsapp, showPrices: settings.show_prices, cancelLimitHours: settings.cancel_limit_hours }),
      emailOwner(ownerId, ownerPage?.owner_locale ?? 'it', 'new', row, settings.timezone),
      notifyUser(ownerId, 'messages', (t, loc) => ({
        title: t('tempusNewTitle'),
        body: t('tempusNewBody', { name, service: service.name, when: when(loc) }),
        url: localizedPath(loc, '/app/tempus'),
        tag: `tempus-${row.id}`,
      })),
    ])
  }
  return { success: true, token: created.cancel_token, startsAt: row?.starts_at ?? input.startsAt, endsAt: row?.ends_at ?? input.startsAt, serviceName: service.name }
}

// Disdetta dal link dell'email o della pagina di conferma
export async function cancelTempusByToken(token: string): Promise<{ success: true } | { success: false; reason: 'notFound' | 'tooLate' | 'error' }> {
  if (typeof token !== 'string' || !/^[a-f0-9]{36,64}$/.test(token)) return { success: false, reason: 'notFound' }
  const db = tempusDb()
  const { data: row } = await db.from('tempus_bookings').select(`${BOOKING_COLUMNS}, owner_id, cancel_token, locale`).eq('cancel_token', token).maybeSingle<BookingRow & { owner_id: string }>()
  if (!row || row.status !== 'confirmed') return { success: false, reason: 'notFound' }
  const { data: page } = await db.from('tempus_pages').select('timezone, cancel_limit_hours, owner_locale').eq('owner_id', row.owner_id).maybeSingle()
  const limit = (page?.cancel_limit_hours ?? 0) * 3_600_000
  if (Date.parse(row.starts_at) - limit < Date.now()) return { success: false, reason: 'tooLate' }
  const { error } = await db.from('tempus_bookings').update({ status: 'cancelled', cancelled_by: 'customer', cancelled_at: new Date().toISOString() }).eq('id', row.id).eq('status', 'confirmed')
  if (error) return { success: false, reason: 'error' }
  const tz = page?.timezone ?? 'Europe/Rome'
  await Promise.all([
    emailOwner(row.owner_id, page?.owner_locale ?? 'it', 'cancelled', row, tz),
    notifyUser(row.owner_id, 'messages', (t, loc) => ({
      title: t('tempusCancelledTitle'),
      body: t('tempusCancelledBody', { name: row.customer_name, when: formatWhen(row.starts_at, tz, loc, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }),
      url: localizedPath(loc, '/app/tempus'),
      tag: `tempus-cancel-${row.id}`,
    })),
  ])
  return { success: true }
}
