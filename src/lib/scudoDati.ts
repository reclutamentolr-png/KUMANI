// SCUDO DATI: tipi ed elementi comuni a server e browser.

export type ScudoBreach = {
  name: string
  domain: string
  // Anno (es. "2021") o anno-mese ("2021-04"), come lo indica la fonte
  date: string
  dataClasses: string[]
  passwordRisk?: string
  logo?: string
}

export type ScudoResult = {
  breached: boolean
  breaches: ScudoBreach[]
  pasteCount: number
  checkedAt: string
}

export type ScudoError = 'auth' | 'not_allowed' | 'no_email' | 'invalid' | 'limit' | 'busy' | 'failed' | 'karma'

export type ScudoResponse =
  | { ok: true; result: ScudoResult; balance?: number }
  | { ok: false; error: ScudoError; cost?: number; balance?: number }

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Email mostrata a metà: ma***@gmail.com
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 1) return email
  const local = email.slice(0, at)
  const shown = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${shown}***${email.slice(at)}`
}

// Tipi di dati esposti (nomi di XposedOrNot, in minuscolo) → chiave del
// testo tradotto (scudoDati.data_<chiave>). Quelli non elencati si mostrano
// come arrivano.
export const DATA_CLASS_KEYS: Record<string, string> = {
  'email addresses': 'email',
  passwords: 'password',
  'phone numbers': 'phone',
  'physical addresses': 'address',
  names: 'name',
  'dates of birth': 'birthDate',
  'ip addresses': 'ip',
  usernames: 'username',
  genders: 'gender',
  'geographic locations': 'location',
  'device information': 'device',
  'browser user agents': 'device',
  'government issued ids': 'governmentId',
  'government ids': 'governmentId',
  'partial government issued ids': 'governmentId',
  'social security numbers': 'governmentId',
  'credit card details': 'card',
  'partial credit card data': 'card',
  'financial transactions': 'financial',
  'account balances': 'financial',
  purchases: 'purchases',
  'social media profiles': 'social',
  'job titles': 'job',
  'private messages': 'messages',
  'auth tokens': 'authTokens',
  'vehicle registration numbers': 'vehicle',
  'licence plates': 'vehicle',
  'profile photos': 'photo',
}
