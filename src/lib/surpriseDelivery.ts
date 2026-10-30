// KUMANI Sorpresa, «Regalo con consegna»: regole comuni a server e browser.
// Vedi la migrazione 20270628100000_surprise_delivery.sql.

export const DELIVERY_STATUSES = ['pending', 'requested', 'booked', 'delivered'] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

// Passi visti da chi ha regalato: inviato → aperto → richiesto → appuntamento → consegnato
export const DELIVERY_STEPS = ['sent', 'opened', 'requested', 'booked', 'delivered'] as const
export type DeliveryStep = (typeof DELIVERY_STEPS)[number]

export const DELIVERY_MAX = {
  name: 80,
  business: 80,
  email: 254,
  phone: 40,
  pickup: 500,
  when: 120,
  contact: 120,
  note: 500,
  booking: 200,
}

// Quando andrebbe bene a chi riceve (testo scritto nella sua lingua nella richiesta)
export const DELIVERY_WHEN = ['weekdayMorning', 'weekdayEvening', 'weekend', 'any'] as const
export type DeliveryWhen = (typeof DELIVERY_WHEN)[number]

export const DELIVERY_CODE_RE = /^KMN-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{3}$/

// Codice scritto a mano (minuscole, spazi, senza trattini): KMN-XXXX-XXX
export function normalizeDeliveryCode(raw: string): string | null {
  const v = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  const body = v.startsWith('KMN') ? v.slice(3) : v
  if (body.length !== 7) return null
  const code = `KMN-${body.slice(0, 4)}-${body.slice(4)}`
  return DELIVERY_CODE_RE.test(code) ? code : null
}

export const deliveryVerifyPath = (code: string) => `/buono/${code}`
export const deliveryManagePath = (code: string) => `/buono/${code}/gestisci`
// Cookie del link segreto di chi consegna (uno per buono)
export const deliveryCookieName = (code: string) => `kmn_dlv_${code}`

export const isEmail = (v: string) => v.length <= DELIVERY_MAX.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)

export type DeliveryRow = {
  gift_id: string
  provider_name: string
  provider_business: string
  provider_phone: string | null
  provider_email: string
  pickup_info: string
  agreed_at: string
  code: string
  status: DeliveryStatus
  requested_at: string | null
  booked_at: string | null
  delivered_at: string | null
  booking_text: string
  booking_at: string | null
}

export const DELIVERY_OWNER_SELECT =
  'gift_id, provider_name, provider_business, provider_phone, provider_email, pickup_info, agreed_at, code, status, requested_at, booked_at, delivered_at, booking_text, booking_at'

// Quello che vede chi riceve, a buono aperto
export type DeliveryView = {
  code: string
  delivered: boolean
  providerName: string
  business: string
  phone: string | null
  email: string
  pickup: string
  requested: boolean
  bookingText: string
  bookingAt: string | null
}

// Appuntamento da mostrare: giorno e ora (ora italiana) e/o il testo scritto
export function bookingLabel(text: string, at: string | null, locale: string): string {
  const when = at
    ? new Date(at).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
    : ''
  return [when, text].filter(Boolean).join(' · ')
}

// Passo raggiunto, per chi ha regalato
export function deliveryStep(gift: { opened_at: string | null; link_opened_at?: string | null }, d: Pick<DeliveryRow, 'status'>): DeliveryStep {
  if (d.status !== 'pending') return d.status
  return gift.opened_at || gift.link_opened_at ? 'opened' : 'sent'
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

export function toDeliveryView(d: DeliveryRow): DeliveryView {
  return {
    code: d.code,
    delivered: d.status === 'delivered',
    providerName: d.provider_name,
    business: d.provider_business,
    phone: d.provider_phone,
    email: d.provider_email,
    pickup: d.pickup_info,
    requested: d.status !== 'pending',
    bookingText: d.booking_text,
    bookingAt: d.booking_at,
  }
}
