import { parsePhoneNumberFromString, type NumberType } from 'libphonenumber-js/max'
import { maskPhone, type ScamTargetKey } from '@/lib/scamNet'

// Numeri di telefono (solo sul server: la libreria completa è pesante).
// Senza prefisso internazionale si considera l'Italia.

export type PhoneInfo = {
  e164: string
  international: string
  country: string | null
  type: NumberType | null
  valid: boolean
}

export function phoneInfo(raw: string): PhoneInfo | null {
  const value = String(raw ?? '').trim().replace(/^00/, '+').replace(/^tel:/i, '')
  if (!value || value.length > 40) return null
  const phone = parsePhoneNumberFromString(value, 'IT')
  if (!phone || !phone.isPossible()) return null
  return {
    e164: phone.number,
    international: phone.formatInternational(),
    country: phone.country ?? null,
    type: phone.getType() ?? null,
    valid: phone.isValid(),
  }
}

export function normalizePhone(raw: string): ScamTargetKey | null {
  const info = phoneInfo(raw)
  if (!info) return null
  return { kind: 'phone', key: info.e164, display: info.international }
}

export function maskedPhone(display: string, key: string): string {
  return maskPhone(key, display)
}
