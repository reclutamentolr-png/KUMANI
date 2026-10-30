// Ricevuta per prestazione occasionale: tipi, controlli e calcoli condivisi
// tra pagina, azioni del server e PDF. Tutte le cifre sono in centesimi
// interi: niente numeri con la virgola, niente errori di arrotondamento.
//
// Regole applicate (fonti e assunzioni, da rivedere se cambia la legge):
// - Lavoro autonomo occasionale: art. 2222 c.c.; reddito diverso art. 67,
//   c. 1, lett. l) TUIR. Fuori campo IVA per mancanza di abitualità (art. 5
//   D.P.R. 633/1972).
// - Ritenuta d'acconto del 20% se chi paga è sostituto d'imposta (art. 25
//   D.P.R. 600/1973), sul compenso lordo; arrotondata al centesimo (metà in su).
// - Rimborsi spese: di norma si sommano al compenso e anche su di loro si
//   calcola la ritenuta. Restano fuori solo le spese anticipate in nome e per
//   conto del committente, documentate (scelta esplicita di chi compila).
// - Marca da bollo da 2 € se l'importo della ricevuta (compenso + rimborsi)
//   supera 77,47 € (D.P.R. 642/1972, Tariffa parte I, art. 13, c. 1 e nota
//   1; 2 € dal D.L. 43/2013). Il bollo addebitato al cliente non è soggetto
//   a ritenuta (anticipazione: assunzione comune, vedi guide Fiscozen/Danea).
// - Oltre 5.000 € di compensi occasionali nell'anno: iscrizione alla Gestione
//   Separata INPS per la parte che supera (art. 44, c. 2, D.L. 269/2003).
//   Qui solo un avviso, nessun calcolo dei contributi.

export const RO_WITHHOLDING_PERCENT = 20
export const RO_STAMP_THRESHOLD_CENTS = 7747
export const RO_STAMP_CENTS = 200
export const RO_INPS_THRESHOLD_CENTS = 500000
// Avviso «ti stai avvicinando ai 5.000 €»
export const RO_INPS_NEAR_CENTS = 400000
export const RO_MAX_AMOUNT_CENTS = 50_000_000

export const RO_LIMITS = {
  name: 120,
  taxCode: 16,
  clientTaxId: 16,
  address: 160,
  city: 120,
  iban: 34,
  place: 80,
  description: 2000,
  stampId: 20,
  note: 500,
} as const

export type ClientKind = 'private' | 'withholding'
export type StampCharge = 'client' | 'issuer'

export type IssuerProfile = {
  full_name: string
  tax_code: string
  address: string | null
  city: string | null
  iban: string | null
  default_place: string | null
}

export type ReceiptClient = {
  id: string
  name: string
  tax_id: string | null
  address: string | null
  city: string | null
  kind: ClientKind
}

export type OccasionalReceipt = {
  id: string
  year: number
  number: number
  issue_date: string
  place: string | null
  client_id: string | null
  client_name: string
  client_tax_id: string | null
  client_address: string | null
  client_city: string | null
  client_kind: ClientKind
  issuer_name: string
  issuer_tax_code: string
  issuer_address: string | null
  issuer_city: string | null
  issuer_iban: string | null
  description: string
  period_from: string | null
  period_to: string | null
  gross_cents: number
  expenses_cents: number
  expenses_on_behalf: boolean
  withholding: boolean
  withholding_cents: number
  stamp_required: boolean
  stamp_charge: StampCharge
  stamp_cents: number
  stamp_id: string | null
  total_cents: number
  net_cents: number
  paid_on: string | null
  cancelled_at: string | null
  note: string | null
}

export const RECEIPT_COLUMNS =
  'id, year, number, issue_date, place, client_id, client_name, client_tax_id, client_address, client_city, client_kind, issuer_name, issuer_tax_code, issuer_address, issuer_city, issuer_iban, description, period_from, period_to, gross_cents, expenses_cents, expenses_on_behalf, withholding, withholding_cents, stamp_required, stamp_charge, stamp_cents, stamp_id, total_cents, net_cents, paid_on, cancelled_at, note'

// ─── Calcoli ──────────────────────────────────────────────────────────────

export type ReceiptCalc = {
  grossCents: number
  expensesCents: number
  /** Base su cui si calcola la ritenuta */
  taxableCents: number
  withholdingCents: number
  stampRequired: boolean
  /** Bollo aggiunto al totale (solo se a carico del cliente) */
  stampCents: number
  /** Totale della ricevuta: compenso + rimborsi + bollo addebitato */
  totalCents: number
  /** Netto da pagare: totale − ritenuta */
  netCents: number
}

/** Ritenuta del 20% arrotondata al centesimo (metà in su), solo interi. */
export function withholdingOf(taxableCents: number): number {
  if (taxableCents <= 0) return 0
  return Math.floor((taxableCents * RO_WITHHOLDING_PERCENT + 50) / 100)
}

// Stesse formule dei vincoli della tabella occasional_receipts
export function calcReceipt(input: {
  grossCents: number
  expensesCents: number
  expensesOnBehalf: boolean
  withholding: boolean
  stampCharge: StampCharge
}): ReceiptCalc {
  const grossCents = Math.max(0, Math.trunc(input.grossCents))
  const expensesCents = Math.max(0, Math.trunc(input.expensesCents))
  const taxableCents = grossCents + (input.expensesOnBehalf ? 0 : expensesCents)
  const withholdingCents = input.withholding ? withholdingOf(taxableCents) : 0
  const stampRequired = grossCents + expensesCents > RO_STAMP_THRESHOLD_CENTS
  const stampCents = stampRequired && input.stampCharge === 'client' ? RO_STAMP_CENTS : 0
  const totalCents = grossCents + expensesCents + stampCents
  return { grossCents, expensesCents, taxableCents, withholdingCents, stampRequired, stampCents, totalCents, netCents: totalCents - withholdingCents }
}

/** Compensi dell'anno che contano per i 5.000 € (ricevute non annullate). */
export type YearTotals = { count: number; grossCents: number; withholdingCents: number; netCents: number; paidNetCents: number; unpaidNetCents: number }

export function yearTotals(receipts: OccasionalReceipt[]): YearTotals {
  const t: YearTotals = { count: 0, grossCents: 0, withholdingCents: 0, netCents: 0, paidNetCents: 0, unpaidNetCents: 0 }
  for (const r of receipts) {
    if (r.cancelled_at) continue
    t.count += 1
    // Compenso + rimborsi soggetti a ritenuta: è quello che conta come reddito
    t.grossCents += r.gross_cents + (r.expenses_on_behalf ? 0 : r.expenses_cents)
    t.withholdingCents += r.withholding_cents
    t.netCents += r.net_cents
    if (r.paid_on) t.paidNetCents += r.net_cents
    else t.unpaidNetCents += r.net_cents
  }
  return t
}

// ─── Importi ──────────────────────────────────────────────────────────────

/** «1.234,56», «1234.56», «1234,5», «€ 80» → centesimi; null se non valido. */
export function parseEuroToCents(value: string): number | null {
  const raw = value.trim().replace(/[\s €]/g, '')
  if (!raw) return null
  let normalized: string
  const lastComma = raw.lastIndexOf(',')
  const lastDot = raw.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Il separatore che viene per ultimo è quello dei decimali
    normalized = lastComma > lastDot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')
  } else if (lastComma >= 0) {
    normalized = /^\d{1,3}(,\d{3}){2,}$/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, '')
  } else {
    normalized = raw
  }
  const m = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(normalized)
  if (!m) return null
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

/** Centesimi → «1234,56» per i campi da modificare */
export function centsToInput(cents: number): string {
  if (!cents) return ''
  const euros = Math.floor(cents / 100)
  const rest = cents % 100
  return rest ? `${euros},${String(rest).padStart(2, '0')}` : String(euros)
}

export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

/** Formato italiano fisso per il PDF e il CSV: «1.234,56» (senza €) */
export function centsIt(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${euros},${String(abs % 100).padStart(2, '0')}`
}

// ─── Date ─────────────────────────────────────────────────────────────────

export function romeTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [y, m, d] = value.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d && y >= 2000 && y <= 2100
}

/** «2027-10-30» → «30/10/2027» (date senza ora: niente fusi) */
export function dateIt(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export function formatDate(iso: string, locale: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

// ─── Codice fiscale e partita IVA ─────────────────────────────────────────

const CF_ODD: Record<string, number> = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
}
const CF_RE = /^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/

export function normalizeTaxId(value: string): string {
  return value.replace(/[\s.-]+/g, '').toUpperCase()
}

export type TaxIdError = 'format' | 'checksum'

/** Codice fiscale di persona (16 caratteri): formato e carattere di controllo. */
export function checkCodiceFiscale(raw: string): TaxIdError | null {
  const code = normalizeTaxId(raw)
  if (!CF_RE.test(code)) return 'format'
  let sum = 0
  for (let i = 0; i < 15; i++) {
    const c = code[i]
    sum += i % 2 === 0 ? CF_ODD[c] : /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65
  }
  return String.fromCharCode(65 + (sum % 26)) === code[15] ? null : 'checksum'
}

/** Partita IVA (o codice fiscale numerico di società ed enti): 11 cifre con controllo. */
export function checkPartitaIva(raw: string): TaxIdError | null {
  const code = normalizeTaxId(raw).replace(/^IT/, '')
  if (!/^\d{11}$/.test(code)) return 'format'
  let sum = 0
  for (let i = 0; i < 10; i++) {
    let d = Number(code[i])
    if (i % 2 === 1) {
      d *= 2
      if (d > 9) d -= 9
    }
    sum += d
  }
  return (10 - (sum % 10)) % 10 === Number(code[10]) ? null : 'checksum'
}

/** Cliente: codice fiscale di 16 caratteri oppure 11 cifre (partita IVA). */
export function checkClientTaxId(raw: string): TaxIdError | null {
  const code = normalizeTaxId(raw).replace(/^IT(?=\d{11}$)/, '')
  if (/^\d+$/.test(code)) return checkPartitaIva(code)
  return checkCodiceFiscale(code)
}

export function cleanClientTaxId(raw: string): string {
  return normalizeTaxId(raw).replace(/^IT(?=\d{11}$)/, '')
}

// ─── Dati del modulo ──────────────────────────────────────────────────────

export type ProfileForm = { fullName: string; taxCode: string; address: string; city: string; iban: string; defaultPlace: string }
export type ClientForm = { name: string; taxId: string; address: string; city: string; kind: ClientKind }
export type ReceiptForm = {
  issueDate: string
  place: string
  clientId: string | null
  /** Cliente nuovo scritto nella ricevuta (se clientId è null) */
  client: ClientForm
  saveClient: boolean
  description: string
  periodFrom: string
  periodTo: string
  grossCents: number
  expensesCents: number
  expensesOnBehalf: boolean
  stampCharge: StampCharge
  stampId: string
  paidOn: string
  note: string
}

export function receiptFileName(r: Pick<OccasionalReceipt, 'number' | 'year'>): string {
  return `ricevuta-${r.number}-${r.year}.pdf`
}
