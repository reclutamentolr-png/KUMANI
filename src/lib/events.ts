// KUMANI Events: tipi e utilità condivise tra pagine, azioni e componenti.
// Gli orari sono salvati in UTC e mostrati nel fuso dell'evento (ora locale
// dell'evento sempre visibile) e, se diverso, anche in quello di chi guarda.

export const EVENT_TYPES = ['meetup', 'workshop', 'wellness', 'business', 'food', 'sport', 'travel', 'online', 'social'] as const
export type EventType = (typeof EVENT_TYPES)[number]

export const EVENT_TYPE_EMOJI: Record<EventType, string> = {
  meetup: '🤝',
  workshop: '🎓',
  wellness: '🧘',
  business: '💼',
  food: '🍽️',
  sport: '🏃',
  travel: '✈️',
  online: '💻',
  social: '💞',
}

export const EVENT_MODES = ['in_person', 'online', 'hybrid'] as const
export type EventMode = (typeof EVENT_MODES)[number]

export const EVENT_LANGUAGES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'] as const

// Paesi proposti nel modulo (nomi mostrati nella lingua di chi guarda con
// Intl.DisplayNames). L'elenco si può allargare senza toccare il database.
export const EVENT_COUNTRIES = [
  'IT', 'SM', 'VA', 'CH', 'FR', 'DE', 'AT', 'ES', 'PT', 'GB', 'IE', 'BE', 'NL', 'LU', 'DK', 'SE', 'NO', 'FI', 'PL', 'CZ',
  'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'MT', 'CY', 'EE', 'LV', 'LT', 'AL', 'RS', 'UA', 'RU', 'TR', 'US', 'CA', 'MX',
  'BR', 'AR', 'MA', 'EG', 'AE', 'AU',
] as const

export const EVENT_TIMEZONES = [
  'Europe/Rome', 'Europe/London', 'Europe/Lisbon', 'Europe/Madrid', 'Europe/Paris', 'Europe/Berlin', 'Europe/Zurich',
  'Europe/Athens', 'Europe/Bucharest', 'Europe/Kyiv', 'Europe/Istanbul', 'Europe/Moscow', 'America/New_York',
  'America/Chicago', 'America/Los_Angeles', 'America/Mexico_City', 'America/Sao_Paulo', 'America/Buenos_Aires',
  'Africa/Casablanca', 'Africa/Cairo', 'Asia/Dubai', 'Australia/Sydney',
] as const

export type EventCard = {
  id: string
  title: string
  description: string
  type: EventType
  mode: EventMode
  starts_at: string
  ends_at: string | null
  timezone: string
  venue_name: string | null
  city: string | null
  country_code: string | null
  languages: string[]
  capacity: number
  people: number
  price: number
  currency: string
  is_18plus: boolean
  kids_friendly: boolean
  status: 'pending' | 'published' | 'rejected' | 'cancelled' | 'banned'
  ended: boolean
  organizer_name: string
  organizer_referral: string | null
  organizer_trusted: boolean
  // Fase 2: lista d'attesa e reputazione dell'organizzatore
  waitlist?: number
  organizer_level?: OrganizerLevel
  organizer_rating?: number | null
  organizer_reviews?: number
  // Fase 3: serie di date e timbro Kumi Card
  series_id?: string | null
  fidelity_stamp?: boolean
  fidelity_business?: string | null
}

export const EVENT_REPEATS = ['none', 'weekly', 'biweekly', 'monthly'] as const
export type EventRepeat = (typeof EVENT_REPEATS)[number]
export const EVENT_MAX_SERIES_DATES = 12

// Esito del timbro Kumi Card al check-in (fidelity_apply)
export type EventStampStatus = 'ok' | 'too_soon' | 'full' | 'inactive' | 'not_found' | 'error'

// Esito del timbro Kumi Card → chiave di testo (events.stamp_*)
export function stampKey(stamp: string): string {
  return ['ok', 'too_soon', 'full', 'inactive'].includes(stamp) ? `stamp_${stamp}` : 'stamp_error'
}

export type EventSeriesDate = { id: string; starts_at: string; status: EventCard['status']; people: number; capacity: number }

export type OrganizerLevel = 'new' | 'trusted' | 'super'

export type EventReview = { rating: number; comment: string | null; name: string; event_title: string; created_at: string }

export type EventDetail = EventCard & {
  is_organizer: boolean
  review_note: string | null
  address: string | null
  map_link: string | null
  online_link: string | null
  my_status: 'registered' | 'waitlist' | 'cancelled' | 'checked_in' | 'no_show' | null
  my_pass: string | null
  fee_percent: number | null
  my_waitlist_position?: number | null
  can_review?: boolean
  my_review?: { rating: number; comment: string | null } | null
  reviews?: EventReview[]
  series?: EventSeriesDate[] | null
  my_stamp_status?: EventStampStatus | null
  my_card_token?: string | null
}

export type EventFeeInfo = { id: string; amount: number; status: 'due' | 'paid' | 'waived'; participants: number; percent: number }

export type OrganizedEvent = EventCard & { review_note: string | null; checked_in: number; fee: EventFeeInfo | null }

export type EventPassItem = EventCard & { pass: string | null; my_status: 'registered' | 'checked_in' | 'waitlist' }

export type EventAttendee = {
  id: string
  name: string
  status: 'registered' | 'waitlist' | 'checked_in' | 'no_show'
  checked_in_at: string | null
  code: string
  // Assenze e presenze ad altri eventi (affidabilità)
  no_shows?: number
  attended?: number
}

export type OrganizerStatus = {
  account_age: boolean
  subscription: boolean
  profile: boolean
  tax_code: boolean
  terms: boolean
  blocked: boolean
  days_left: number
  // Identità: tax_code = verificata (codice fiscale o documento approvato)
  has_tax_code?: boolean
  identity_pending?: boolean
  identity_last_status?: 'pending' | 'approved' | 'rejected' | null
  identity_rejected_note?: string | null
  verified: boolean
  plan: boolean
  trusted: boolean
  fees_due: number
  fee_percent: number
  // Fase 2: livello e reputazione
  level?: OrganizerLevel
  avg_rating?: number | null
  reviews?: number
  concluded?: number
  banned_recent?: number
  max_capacity?: number
  // Fase 3: Kumi Card attiva dell'organizzatore (per il timbro al check-in)
  fidelity_card?: { business_name: string; prize: string; stamps_needed: number } | null
}

export type EventFee = {
  id: string
  event_id: string
  title: string
  amount: number
  status: 'due' | 'paid' | 'waived'
  participants: number
  percent: number
  price: number
  created_at: string
}

// Minimo addebitabile con carta (Stripe): sotto si accumula.
export const MIN_FEE_PAYMENT = 0.5

// Offset (in minuti) di un fuso orario in un certo istante.
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - instant.getTime()) / 60000)
}

// "2027-04-02" + "09:30" nel fuso dell'evento → istante UTC (ISO). Due
// passaggi per i giorni di cambio ora.
export function zonedToUtc(date: string, time: string, timeZone: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const first = guess - tzOffsetMinutes(new Date(guess), timeZone) * 60000
  const second = guess - tzOffsetMinutes(new Date(first), timeZone) * 60000
  return new Date(second).toISOString()
}

// Fuso che il browser/Node conosce; altrimenti Europe/Rome (un fuso strano
// salvato nel database non deve far fallire le pagine).
function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en', { timeZone })
    return timeZone
  } catch {
    return 'Europe/Rome'
  }
}

// Istante UTC → data e ora locali nel fuso indicato ('2027-04-02', '09:30').
export function utcToZoned(iso: string, timeZone: string): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timeZone),
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` }
}

export function formatEventDate(iso: string, timeZone: string, locale: string, withWeekday = true): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: safeTimeZone(timeZone),
    ...(withWeekday ? { weekday: 'long' } : {}),
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function countryName(code: string | null, locale: string): string {
  if (!code) return ''
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

export function eventPassUrl(siteUrl: string, token: string): string {
  return `${siteUrl}/events/pass/${token}`
}

// File .ics per aggiungere l'evento al calendario del telefono.
export function buildIcs(event: { id: string; title: string; description: string; starts_at: string; ends_at: string | null; venue_name: string | null; city: string | null; address?: string | null }, url: string): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const end = event.ends_at ?? new Date(new Date(event.starts_at).getTime() + 3 * 3600000).toISOString()
  const escape = (text: string) => text.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`)
  const location = [event.venue_name, event.address, event.city].filter(Boolean).join(', ')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KUMANI//Events//IT',
    'BEGIN:VEVENT',
    `UID:${event.id}@kumani`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(event.starts_at)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(event.title)}`,
    `DESCRIPTION:${escape(`${event.description}\n\n${url}`)}`,
    location ? `LOCATION:${escape(location)}` : '',
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')
}
