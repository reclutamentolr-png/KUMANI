// KUMANI Convivium: «il tavolo si apre con un link». Tipi e utilità comuni a
// pagine, azioni e promemoria (vedi la migrazione 20270330100000_convivium).

export const CONVIVIUM_OCCASIONS = ['aperitivo', 'pizza', 'cena', 'pranzo', 'colazione', 'festa', 'sport', 'altro'] as const
export type ConviviumOccasion = (typeof CONVIVIUM_OCCASIONS)[number]
export type ConviviumAnswer = 'yes' | 'maybe' | 'no'

export const OCCASION_EMOJI: Record<ConviviumOccasion, string> = {
  aperitivo: '🥂',
  pizza: '🍕',
  cena: '🍽️',
  pranzo: '🥗',
  colazione: '☕',
  festa: '🎉',
  sport: '⚽',
  altro: '✨',
}

export const CONVIVIUM_LIMITS = { title: 80, note: 500, place: 120, name: 40, maxGuests: 200, costEuro: 1000, costNote: 80 }

// Serata vista da chi organizza (tabella convivium_events)
export type ConviviumEvent = {
  id: string
  occasion: ConviviumOccasion
  title: string
  note: string | null
  starts_at: string
  place: string | null
  maps_url: string | null
  max_guests: number | null
  // null = non indicato, 0 = offre chi organizza, > 0 = a testa (centesimi)
  cost_cents: number | null
  cost_note: string | null
  // Chi organizza partecipa anche lui: primo nome al tavolo, conta nei posti
  host_joins: boolean
  invite_code: string
  cancelled_at: string | null
  created_at: string
}

export type ConviviumRsvp = { id: string; name: string; answer: ConviviumAnswer; user_id: string | null; created_at: string; updated_at: string }

// Risposta di convivium_public (pagina dell'invito)
export type ConviviumPublic = {
  code: string
  occasion: ConviviumOccasion
  title: string
  note: string | null
  starts_at: string
  place: string | null
  maps_url: string | null
  max_guests: number | null
  // null = non indicato, 0 = offre chi organizza, > 0 = a testa (centesimi)
  cost_cents: number | null
  cost_note: string | null
  // Chi organizza partecipa anche lui: primo nome al tavolo, conta nei posti
  host_joins: boolean
  cancelled: boolean
  closed: boolean
  host_name: string | null
  host_referral: string | null
  is_owner: boolean
  yes: number
  maybe: number
  no: number
  yes_names: string[]
  mine: { name: string; answer: ConviviumAnswer } | null
}

export const isOccasion = (value: unknown): value is ConviviumOccasion => typeof value === 'string' && (CONVIVIUM_OCCASIONS as readonly string[]).includes(value)

export const inviteCodeOk = (code: string) => /^[A-Z0-9]{8}$/.test(code)

// Cookie con il token di chi risponde senza account (per cambiare risposta)
export const rsvpCookie = (code: string) => `cvm_${code}`

// «sabato 25 ottobre, 20:00» nell'ora italiana, come il resto di KUMANI
export function formatWhen(iso: string, locale: string, withWeekday = true): string {
  return new Intl.DateTimeFormat(locale, {
    ...(withWeekday ? { weekday: 'long' as const } : {}),
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome',
  }).format(new Date(iso))
}

// Il posto è cliccabile solo con il link scritto da chi organizza (senza
// link è solo testo: una ricerca del nome può portare al posto sbagliato)
export function mapsHref(mapsUrl: string | null): string | null {
  return mapsUrl || null
}

export const invitePath = (code: string) => `/convivium/invito/${code}`

// «12 €» o «12,50 €» (senza decimali se è una cifra tonda)
export function formatCost(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(cents / 100)
}

// Persone al tavolo: chi ha detto «Ci sto» più chi organizza, se partecipa
export const seated = (yes: number, hostJoins: boolean) => yes + (hostJoins ? 1 : 0)
