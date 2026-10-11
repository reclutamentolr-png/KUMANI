import { escapeVcard } from '@/lib/contactsImport'
export const QR_CONTENT_TYPES = ['link', 'whatsapp', 'phone', 'sms', 'email', 'wifi', 'vcard'] as const
export type QrContentType = (typeof QR_CONTENT_TYPES)[number]

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
