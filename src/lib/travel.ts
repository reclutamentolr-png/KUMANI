// KUMANI Travel: tipi e utilità condivise tra pagine, azioni e componenti.
// Le date del viaggio sono giorni di calendario ('YYYY-MM-DD'), come
// nell'agenda: mai toISOString() su una data locale.
import { addDays, daysBetween } from '@/lib/agenda'

export type TripSummary = {
  id: string
  title: string
  destination: string | null
  starts_on: string | null
  ends_on: string | null
  emoji: string
  is_owner: boolean
  organizer_name: string
  members: number
  checklist_total: number
  checklist_done: number
}

export type TripMember = { id: string; name: string; role: 'owner' | 'member'; is_me: boolean }

export type TripDetail = {
  id: string
  title: string
  destination: string | null
  starts_on: string | null
  ends_on: string | null
  emoji: string
  invite_code: string
  members_can_edit: boolean
  base_currency: string
  required_docs: string[]
  is_owner: boolean
  can_edit: boolean
  my_member_id: string
  members: TripMember[]
}

export type TripActivity = {
  id: string
  trip_id: string
  day: string
  time: string | null
  title: string
  place: string | null
  map_link: string | null
  notes: string | null
  cost_amount: number | null
  responsible_id: string | null
  position: number
}

export type TripChecklistItem = {
  id: string
  trip_id: string
  title: string
  assigned_to: string | null
  done: boolean
  position: number
}

export type TripPublic = {
  code: string
  title: string
  destination: string | null
  starts_on: string | null
  ends_on: string | null
  emoji: string
  creator_name: string | null
  creator_referral: string | null
  members: number
  is_member: boolean
}

// Voci della checklist base (tradotte in messages → travel.template_*)
export const CHECKLIST_TEMPLATE = [
  'flights', 'accommodation', 'documents', 'insurance', 'docCopies', 'medicines',
  'adapter', 'chargers', 'currency', 'bank', 'localTransport', 'luggage',
] as const

export const TRIP_EMOJIS = ['✈️', '🏖️', '🏔️', '🏙️', '🚗', '🚆', '⛺', '🛳️', '🎿', '🗺️', '🎉', '❤️']

export type TripPhase =
  | { phase: 'undated' }
  | { phase: 'upcoming'; days: number }
  | { phase: 'ongoing'; day: number; total: number }
  | { phase: 'ended' }

// Dove siamo rispetto al viaggio: "tra N giorni", "giorno 3 di 8", finito.
export function tripPhase(trip: { starts_on: string | null; ends_on: string | null }, today: string): TripPhase {
  if (!trip.starts_on) return { phase: 'undated' }
  const end = trip.ends_on ?? trip.starts_on
  if (today < trip.starts_on) return { phase: 'upcoming', days: daysBetween(today, trip.starts_on) }
  if (today > end) return { phase: 'ended' }
  return { phase: 'ongoing', day: daysBetween(trip.starts_on, today) + 1, total: daysBetween(trip.starts_on, end) + 1 }
}

// Giorni dell'itinerario: quelli del viaggio (se ha le date) più eventuali
// giorni fuori intervallo che hanno già attività.
export function itineraryDays(trip: { starts_on: string | null; ends_on: string | null }, activities: TripActivity[]): string[] {
  const days = new Set(activities.map((a) => a.day))
  if (trip.starts_on) {
    const end = trip.ends_on ?? trip.starts_on
    const total = Math.min(daysBetween(trip.starts_on, end), 60)
    for (let i = 0; i <= total; i++) days.add(addDays(trip.starts_on, i))
  }
  return [...days].sort()
}

export function sortActivities(activities: TripActivity[]): TripActivity[] {
  return [...activities].sort(
    (a, b) => a.day.localeCompare(b.day) || (a.time ?? '99:99').localeCompare(b.time ?? '99:99') || a.position - b.position
  )
}

// Link mappa: quello inserito, oppure una ricerca del luogo su Google Maps.
export function mapUrl(activity: { place: string | null; map_link: string | null }): string | null {
  if (activity.map_link) return activity.map_link
  if (activity.place) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.place)}`
  return null
}

export function formatTripDates(trip: { starts_on: string | null; ends_on: string | null }, locale: string): string | null {
  if (!trip.starts_on) return null
  const fmt = (key: string, withYear: boolean) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
  if (!trip.ends_on || trip.ends_on === trip.starts_on) return fmt(trip.starts_on, true)
  const sameYear = trip.starts_on.slice(0, 4) === trip.ends_on.slice(0, 4)
  return `${fmt(trip.starts_on, !sameYear)} – ${fmt(trip.ends_on, true)}`
}

// ---------------------------------------------------------------------------
// Fase 2: spese divise e documenti
// ---------------------------------------------------------------------------

export const EXPENSE_CATEGORIES = ['transport', 'accommodation', 'food', 'activities', 'shopping', 'other'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]
export const EXPENSE_EMOJI: Record<ExpenseCategory, string> = {
  transport: '🚆',
  accommodation: '🏨',
  food: '🍽️',
  activities: '🎟️',
  shopping: '🛍️',
  other: '💶',
}

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'JPY', 'CNY', 'AUD', 'CAD', 'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'AED', 'THB', 'BRL', 'MXN', 'RUB', 'INR', 'EGP', 'MAD'] as const

export const DOC_TYPES = ['passport', 'id_card', 'visa', 'insurance', 'vaccination', 'license', 'other'] as const
export type DocType = (typeof DOC_TYPES)[number]

export type TripExpense = {
  id: string
  trip_id: string
  paid_by: string
  amount: number
  currency: string
  rate_to_base: number
  category: ExpenseCategory
  description: string
  spent_on: string
  split_between: string[]
  created_by: string
}

export type TripSettlement = { id: string; from_member: string; to_member: string; amount: number; created_by: string; created_at: string }

export type TripDocument = {
  id: string
  member_id: string
  doc_type: DocType
  label: string | null
  expires_on: string | null
  life_calendar_item_id: string | null
}

const cents = (value: number) => Math.round(value * 100)

// Saldo di ogni membro nella valuta del viaggio, in centesimi: positivo =
// deve ricevere, negativo = deve dare. La quota di una spesa è divisa in parti
// uguali; i centesimi che avanzano vanno ai primi della lista, così la somma
// dei saldi è sempre esattamente zero.
export function memberBalances(expenses: TripExpense[], settlements: TripSettlement[]): Map<string, number> {
  const balance = new Map<string, number>()
  const add = (id: string, value: number) => balance.set(id, (balance.get(id) ?? 0) + value)
  for (const expense of expenses) {
    const total = cents(expense.amount * expense.rate_to_base)
    const people = [...new Set(expense.split_between)]
    if (people.length === 0 || total <= 0) continue
    add(expense.paid_by, total)
    const share = Math.floor(total / people.length)
    let rest = total - share * people.length
    for (const id of people) {
      add(id, -(share + (rest > 0 ? 1 : 0)))
      if (rest > 0) rest--
    }
  }
  for (const s of settlements) {
    add(s.from_member, cents(s.amount))
    add(s.to_member, -cents(s.amount))
  }
  return balance
}

// Trasferimenti minimi per chiudere i conti (greedy: chi deve di più paga
// chi deve ricevere di più). Importi in centesimi.
export function settleUp(balances: Map<string, number>): { from: string; to: string; amount: number }[] {
  const debtors = [...balances].filter(([, v]) => v < 0).map(([id, v]) => ({ id, v: -v }))
  const creditors = [...balances].filter(([, v]) => v > 0).map(([id, v]) => ({ id, v }))
  debtors.sort((a, b) => b.v - a.v)
  creditors.sort((a, b) => b.v - a.v)
  const transfers: { from: string; to: string; amount: number }[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].v, creditors[j].v)
    if (amount > 0) transfers.push({ from: debtors[i].id, to: creditors[j].id, amount })
    debtors[i].v -= amount
    creditors[j].v -= amount
    if (debtors[i].v === 0) i++
    if (creditors[j].v === 0) j++
  }
  return transfers
}

export type DocStatus = 'ok' | 'warning' | 'expired' | 'missing'

// Stato di un documento rispetto al viaggio: scaduto/scade prima del rientro
// (rosso); passaporto valido meno di 6 mesi oltre il rientro, come chiedono
// molti paesi (arancione); altrimenti ok. Senza data di scadenza: ok.
export function docStatus(doc: { doc_type: DocType; expires_on: string | null } | null, trip: { starts_on: string | null; ends_on: string | null }, today: string): DocStatus {
  if (!doc) return 'missing'
  if (!doc.expires_on) return 'ok'
  const until = trip.ends_on ?? trip.starts_on ?? today
  if (doc.expires_on < today || doc.expires_on < until) return 'expired'
  if (doc.doc_type === 'passport' && doc.expires_on < addMonths(until, 6)) return 'warning'
  return 'ok'
}

function addMonths(key: string, months: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1 + months, 1))
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(d, last))
  return date.toISOString().slice(0, 10)
}
