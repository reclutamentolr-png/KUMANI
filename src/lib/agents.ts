import { validateIban } from '@/lib/iban'

// Agenti venditori: controlli sui dati fiscali (browser e server) e
// definizioni comuni. La logica delle provvigioni è in agentCommissions.ts.

export const TAX_REGIMES = ['partita_iva', 'occasionale', 'agenzia'] as const
export type TaxRegime = (typeof TAX_REGIMES)[number]

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  partita_iva: 'Partita IVA',
  occasionale: 'Prestazione occasionale',
  agenzia: 'Contratto di agenzia',
}

// Codice fiscale italiano (persona fisica): formato e carattere di controllo
const CF_ODD: Record<string, number> = {
  '0': 1, '1': 0, '2': 5, '3': 7, '4': 9, '5': 13, '6': 15, '7': 17, '8': 19, '9': 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
}
function cfEven(ch: string): number {
  return /[0-9]/.test(ch) ? Number(ch) : ch.charCodeAt(0) - 65
}

export function isValidFiscalCode(raw: string): boolean {
  const cf = raw.trim().toUpperCase()
  // Consente anche le lettere di omocodia al posto delle cifre
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false
  let sum = 0
  for (let i = 0; i < 15; i++) sum += i % 2 === 0 ? CF_ODD[cf[i]] : cfEven(cf[i])
  return String.fromCharCode(65 + (sum % 26)) === cf[15]
}

// Partita IVA italiana: 11 cifre con cifra di controllo (algoritmo di Luhn)
export function isValidVatNumber(raw: string): boolean {
  const piva = raw.trim().replace(/^IT/i, '')
  if (!/^[0-9]{11}$/.test(piva)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    let n = Number(piva[i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return (10 - (sum % 10)) % 10 === Number(piva[10])
}

export function isValidIban(raw: string): boolean {
  return validateIban(raw).valid
}

export function normalizeIbanValue(raw: string): string {
  return validateIban(raw).normalized
}

// Codice destinatario SDI (fatturazione elettronica): 7 caratteri
export function isValidSdiCode(raw: string): boolean {
  return /^[A-Z0-9]{7}$/.test(raw.trim().toUpperCase())
}

// Euro da centesimi, nel formato della lingua
export function formatEuroCents(cents: number, locale = 'it'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

// Stato di una provvigione come la vede l'agente: "in maturazione" nei 14
// giorni del diritto di recesso, poi "maturata" finché non viene pagata
export type CommissionState = 'pending' | 'matured' | 'paid' | 'cancelled'
export function commissionState(status: string, maturesAt: string, now = Date.now()): CommissionState {
  if (status === 'paid') return 'paid'
  if (status === 'cancelled') return 'cancelled'
  return new Date(maturesAt).getTime() <= now ? 'matured' : 'pending'
}
