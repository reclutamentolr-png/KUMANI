import { escapeVcard } from '@/lib/contactsImport'
// Tipi di un QR che apre una cosa sola; «multi» apre una pagina con più contatti
export const QR_ITEM_TYPES = ['link', 'whatsapp', 'phone', 'sms', 'email', 'wifi', 'vcard'] as const
export type QrItemType = (typeof QR_ITEM_TYPES)[number]
export const QR_CONTENT_TYPES = [...QR_ITEM_TYPES, 'multi'] as const
export type QrContentType = (typeof QR_CONTENT_TYPES)[number]

// «Più contatti»: chi inquadra il QR vede una pagina (/qr/<codice>) con un
// pulsante per contatto, nell'ordine scelto. Ogni contatto ha i campi del suo tipo.
export const MULTI_MAX_ITEMS = 10
export type MultiItem = { type: QrItemType; label: string; data: Record<string, string> }
export interface MultiDestination {
  title: string
  subtitle: string
  items: MultiItem[]
}

export const WIFI_ENCRYPTIONS = ['WPA', 'WEP', 'nopass'] as const
export type WifiEncryption = (typeof WIFI_ENCRYPTIONS)[number]

export interface LinkDestination {
  url: string
}
export interface WhatsappDestination {
  phone: string
  message: string
}
export interface PhoneDestination {
  phone: string
}
export interface SmsDestination {
  phone: string
  message: string
}
export interface EmailDestination {
  email: string
  subject: string
  body: string
}
export interface WifiDestination {
  ssid: string
  password: string
  encryption: WifiEncryption
}
export interface VcardDestination {
  firstName: string
  lastName: string
  phone: string
  mobile: string
  email: string
  website: string
  company: string
  jobTitle: string
  fax: string
  address: string
  city: string
  postalCode: string
  country: string
}

export type QrDestination =
  | LinkDestination
  | WhatsappDestination
  | PhoneDestination
  | SmsDestination
  | EmailDestination
  | WifiDestination
  | VcardDestination
  | MultiDestination

export interface QrCodeFormData {
  label: string
  contentType: QrContentType
  destination: QrDestination
  fgColor: string
  bgColor: string
}

export function emptyDestinationFor(type: QrContentType): QrDestination {
  switch (type) {
    case 'link':
      return { url: '' }
    case 'whatsapp':
      return { phone: '', message: '' }
    case 'phone':
      return { phone: '' }
    case 'sms':
      return { phone: '', message: '' }
    case 'email':
      return { email: '', subject: '', body: '' }
    case 'wifi':
      return { ssid: '', password: '', encryption: 'WPA' }
    case 'multi':
      return { title: '', subtitle: '', items: [] }
    case 'vcard':
      return {
        firstName: '',
        lastName: '',
        phone: '',
        mobile: '',
        email: '',
        website: '',
        company: '',
        jobTitle: '',
        fax: '',
        address: '',
        city: '',
        postalCode: '',
        country: '',
      }
  }
}

// Campi minimi per ogni tipo (modulo e salvataggio)
export function isDestinationValid(type: QrContentType, d: QrDestination): boolean {
  if (type === 'multi') {
    const items = (d as MultiDestination).items ?? []
    return items.length > 0 && items.length <= MULTI_MAX_ITEMS && items.every((item) => isDestinationValid(item.type, item.data as unknown as QrDestination))
  }
  const v = d as unknown as Record<string, string>
  if (type === 'link') return !!v.url?.trim()
  if (type === 'whatsapp' || type === 'phone' || type === 'sms') return !!v.phone?.trim()
  if (type === 'email') return !!v.email?.trim()
  if (type === 'wifi') return !!v.ssid?.trim()
  return !!v.firstName?.trim() || !!v.lastName?.trim()
}

// Indirizzo sicuro di un sito: solo http/https (niente javascript:, data:…),
// con https:// aggiunto se manca; null se non è un indirizzo valido
export function safeWebUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  try {
    const parsed = new URL(withScheme)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : null
  } catch {
    return null
  }
}

// Dove porta un contatto (sito, WhatsApp, chiamata, SMS, email); null per
// Wi-Fi e scheda contatto, che hanno una loro visualizzazione
export function qrItemHref(type: QrItemType, d: Record<string, string>): string | null {
  switch (type) {
    case 'link':
      return d.url ? safeWebUrl(d.url) : null
    case 'whatsapp': {
      if (!d.phone) return null
      const digits = d.phone.replace(/[^\d+]/g, '').replace(/^\+/, '')
      return `https://wa.me/${digits}${d.message ? `?text=${encodeURIComponent(d.message)}` : ''}`
    }
    case 'phone':
      return d.phone ? `tel:${d.phone.replace(/\s/g, '')}` : null
    case 'sms':
      return d.phone ? `sms:${d.phone.replace(/\s/g, '')}${d.message ? `?body=${encodeURIComponent(d.message)}` : ''}` : null
    case 'email': {
      if (!d.email) return null
      const params = new URLSearchParams()
      if (d.subject) params.set('subject', d.subject)
      if (d.body) params.set('body', d.body)
      const query = params.toString()
      return `mailto:${d.email}${query ? `?${query}` : ''}`
    }
    default:
      return null
  }
}

// The WiFi QR standard: the connection data is embedded directly in the QR
// (that's what lets phones offer a one-tap "join network" action). It cannot
// go through our /q/[code] redirect the way other types do, so editing the
// network later means re-downloading and re-sharing the QR image.
export function buildWifiQrPayload(d: WifiDestination): string {
  const esc = (s: string) => s.replace(/([\\;,:"])/g, '\\$1')
  const password = d.encryption === 'nopass' ? '' : `P:${esc(d.password)};`
  return `WIFI:T:${d.encryption};S:${esc(d.ssid)};${password};`
}

export function buildVcardContent(d: VcardDestination): string {
  const e = (value: string | null | undefined) => escapeVcard(value ?? '')
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${e(d.lastName)};${e(d.firstName)};;;`,
    `FN:${e([d.firstName, d.lastName].filter(Boolean).join(' '))}`,
    d.company && `ORG:${e(d.company)}`,
    d.jobTitle && `TITLE:${e(d.jobTitle)}`,
    d.phone && `TEL;TYPE=WORK,VOICE:${e(d.phone)}`,
    d.mobile && `TEL;TYPE=CELL:${e(d.mobile)}`,
    d.fax && `TEL;TYPE=FAX:${e(d.fax)}`,
    d.email && `EMAIL:${e(d.email)}`,
    d.website && `URL:${e(d.website)}`,
    (d.address || d.city || d.postalCode || d.country) &&
      `ADR;TYPE=WORK:;;${e(d.address)};${e(d.city)};;${e(d.postalCode)};${e(d.country)}`,
    'END:VCARD',
  ].filter(Boolean)
  return lines.join('\r\n')
}
