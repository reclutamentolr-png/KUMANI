// KUMANI TEMPUS: regole comuni a pagina pubblica, agenda e server.
// Gli orari dell'attività sono nel suo fuso (di solito Europe/Rome): ogni
// conversione passa da zonedToUtc / utcToZoned, mai dall'ora del server
// (Vercel è in UTC) né da quella del browser del cliente.

import { utcToZoned, zonedToUtc, EVENT_TIMEZONES } from '@/lib/events'
import { slugProblem as landingSlugProblem } from '@/lib/landing'

export const TEMPUS_TIMEZONES = EVENT_TIMEZONES
export const SLOT_STEPS = [10, 15, 20, 30, 45, 60] as const
export const TEMPUS_DAYS_PER_PAGE = 14
// Lunedì per primo, come sul calendario italiano (0 = domenica)
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export type TimeRange = [string, string]
export type WeekHours = Record<string, TimeRange[]>

export type TempusSettings = {
  slug: string
  is_published: boolean
  title: string
  intro: string
  show_prices: boolean
  timezone: string
  slot_step: number
  buffer_min: number
  min_notice_min: number
  max_days_ahead: number
  cancel_limit_hours: number
  hours: WeekHours
  suspended: boolean
  suspended_reason: string | null
}

export type TempusService = {
  id: string
  name: string
  description: string
  duration_min: number
  price_cents: number | null
  active: boolean
  sort: number
}

export type TempusClosure = { id: string; starts_on: string; ends_on: string; note: string }

export type TempusBookingStatus = 'confirmed' | 'cancelled' | 'no_show'

export type TempusBooking = {
  id: string
  service_id: string | null
  service_name: string
  duration_min: number
  price_cents: number | null
  starts_at: string
  ends_at: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  customer_note: string | null
  owner_note: string | null
  status: TempusBookingStatus
  cancelled_by: 'customer' | 'owner' | null
  source: 'online' | 'manual'
  created_at: string
}

// Orario occupato (prenotazione non annullata, con la pausa dopo)
export type BusyRange = { starts_at: string; blocked_until: string }

export const DEFAULT_HOURS: WeekHours = {
  '1': [['09:00', '13:00'], ['15:00', '19:00']],
  '2': [['09:00', '13:00'], ['15:00', '19:00']],
  '3': [['09:00', '13:00'], ['15:00', '19:00']],
  '4': [['09:00', '13:00'], ['15:00', '19:00']],
  '5': [['09:00', '13:00'], ['15:00', '19:00']],
  '6': [['09:00', '13:00']],
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
export const isTime = (v: unknown): v is string => typeof v === 'string' && TIME_RE.test(v)
export const isDay = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`))
export const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5))
export const fromMinutes = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

// Orari ricevuti dal browser o dal database: al massimo 3 fasce per giorno,
// in ordine, senza sovrapposizioni; quelle non valide si scartano.
export function cleanHours(input: unknown): WeekHours {
  const out: WeekHours = {}
  if (!input || typeof input !== 'object') return out
  for (const day of WEEK_ORDER) {
    const raw = (input as Record<string, unknown>)[String(day)]
    if (!Array.isArray(raw)) continue
    const ranges = raw
      .filter((r): r is TimeRange => Array.isArray(r) && isTime(r[0]) && isTime(r[1]) && toMinutes(r[1]) > toMinutes(r[0]))
      .map((r) => [r[0], r[1]] as TimeRange)
      .sort((a, b) => toMinutes(a[0]) - toMinutes(b[0]))
    const kept: TimeRange[] = []
    for (const r of ranges) {
      const last = kept[kept.length - 1]
      if (last && toMinutes(r[0]) < toMinutes(last[1])) continue
      kept.push(r)
      if (kept.length === 3) break
    }
    if (kept.length) out[String(day)] = kept
  }
  return out
}

export function tempusSlugProblem(slug: string): 'slugInvalid' | 'slugReserved' | null {
  // «disdici» è la pagina per annullare una prenotazione
  if (slug === 'disdici') return 'slugReserved'
  return landingSlugProblem(slug)
}

// Giorno della settimana (0 = domenica) di una data 'YYYY-MM-DD'
export const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()
export const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
// Lunedì della settimana di una data
export const mondayOf = (date: string) => addDays(date, -((weekday(date) + 6) % 7))
export const todayIn = (timeZone: string, now = Date.now()) => utcToZoned(new Date(now).toISOString(), timeZone).date

export const isClosed = (date: string, closures: Pick<TempusClosure, 'starts_on' | 'ends_on'>[]) =>
  closures.some((c) => c.starts_on <= date && date <= c.ends_on)

export type Slot = { time: string; startsAt: string }

// Orari liberi di un giorno per un servizio di durata data. Un orario è
// libero se il servizio (più la pausa dopo) sta dentro una fascia di apertura,
// rispetta il preavviso minimo e non tocca nessuna prenotazione esistente.
export function daySlots(input: {
  date: string
  settings: Pick<TempusSettings, 'hours' | 'timezone' | 'slot_step' | 'buffer_min' | 'min_notice_min' | 'max_days_ahead'>
  durationMin: number
  closures: Pick<TempusClosure, 'starts_on' | 'ends_on'>[]
  busy: BusyRange[]
  now?: number
}): Slot[] {
  const { date, settings, durationMin, closures, busy } = input
  const now = input.now ?? Date.now()
  const today = todayIn(settings.timezone, now)
  if (date < today || date > addDays(today, settings.max_days_ahead) || isClosed(date, closures)) return []
  const ranges = settings.hours[String(weekday(date))] ?? []
  const earliest = now + settings.min_notice_min * 60_000
  const busyMs = busy.map((b) => [Date.parse(b.starts_at), Date.parse(b.blocked_until)] as const)
  const slots: Slot[] = []
  for (const [from, to] of ranges) {
    const end = toMinutes(to)
    for (let m = toMinutes(from); m + durationMin <= end; m += settings.slot_step) {
      const time = fromMinutes(m)
      const startsAt = zonedToUtc(date, time, settings.timezone)
      const start = Date.parse(startsAt)
      // Giorno del cambio d'ora: un orario che non esiste torna diverso
      if (utcToZoned(startsAt, settings.timezone).time !== time) continue
      if (start < earliest) continue
      const blocked = start + (durationMin + settings.buffer_min) * 60_000
      if (busyMs.some(([s, e]) => s < blocked && e > start)) continue
      slots.push({ time, startsAt })
    }
  }
  return slots
}

// Prezzo per la pagina e l'agenda (null = non indicato)
export function formatPrice(cents: number | null, locale: string) {
  if (cents == null) return ''
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100)
}

export function formatDuration(min: number) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`
}

// Data e ora di una prenotazione nel fuso dell'attività
export function formatWhen(iso: string, timeZone: string, locale: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) {
  try {
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone }).format(new Date(iso))
  } catch {
    return new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'Europe/Rome' }).format(new Date(iso))
  }
}

// Evento .ics per il calendario del telefono (UTC, un solo evento)
export function bookingIcs(input: { uid: string; startsAt: string; endsAt: string; title: string; location?: string; description?: string }) {
  const stamp = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`)
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KUMANI//TEMPUS//IT',
    'BEGIN:VEVENT',
    `UID:${input.uid}@kumani.io`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(input.startsAt)}`,
    `DTEND:${stamp(input.endsAt)}`,
    `SUMMARY:${esc(input.title)}`,
    ...(input.location ? [`LOCATION:${esc(input.location)}`] : []),
    ...(input.description ? [`DESCRIPTION:${esc(input.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n')
}

// Appuntamento già iniziato; disdetta online ancora possibile (entro il limite)
export const isPast = (iso: string, now = Date.now()) => Date.parse(iso) < now
export const canCancelOnline = (iso: string, limitHours: number, now = Date.now()) => Date.parse(iso) - limitHours * 3_600_000 > now

// Telefono per i link «chiama» e WhatsApp: solo cifre e + iniziale
export const phoneDigits = (phone: string) => phone.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '')
