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
  // Prefisso usato spesso per le chiamate «squillo e richiama» (wangiri)
  callbackRisk: boolean
}

// Prefissi internazionali citati più spesso negli avvisi sulle chiamate
// «squillo e richiama»: uno squillo da un numero estero, chi richiama paga
// tariffe altissime. Non vuol dire che ogni numero sia una truffa: si avvisa
// di non richiamare se non si conosce chi ha chiamato.
const CALLBACK_RISK_PREFIXES = ['216', '222', '223', '224', '225', '232', '233', '234', '242', '243', '252', '269', '375', '383', '870', '881', '882', '883']

export function isCallbackRisk(e164: string): boolean {
  return CALLBACK_RISK_PREFIXES.some((prefix) => e164.startsWith(`+${prefix}`))
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
    callbackRisk: isCallbackRisk(phone.number),
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
