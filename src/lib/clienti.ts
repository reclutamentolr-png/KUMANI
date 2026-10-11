// Clienti e Lavori (PRO): i clienti sono quelli che i Preventivi salvano
// (quote_clients), con in più referente, note e «prossimo passo».
// I conti (accettato, incassato, da incassare) li calcola il database
// dai preventivi collegati (my_clients_overview).

export const CLIENT_LIMITS = {
  name: 200,
  contactName: 120,
  vat: 40,
  address: 300,
  city: 120,
  postalCode: 20,
  pec: 200,
  email: 200,
  phone: 60,
  notes: 3000,
  nextStep: 200,
} as const

export interface ClientOverview {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  city: string | null
  next_step: string | null
  next_step_due: string | null
  updated_at: string
  quotes_count: number
  accepted_total: number
  paid_total: number
  owed: number
  last_quote_at: string | null
}

export interface ClientRecord {
  id: string
  name: string
  contact_name: string | null
  vat: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  pec: string | null
  email: string | null
  phone: string | null
  notes: string | null
  next_step: string | null
  next_step_due: string | null
}

export interface ClientQuote {
  id: string
  quote_number: number
  subject: string | null
  issue_date: string
  gross: number
  accepted: boolean
  payment_status: string
  paid_amount: number
}

export interface ClientFormData {
  name: string
  contactName: string
  vat: string
  address: string
  city: string
  postalCode: string
  pec: string
  email: string
  phone: string
}

export const EMPTY_CLIENT_FORM: ClientFormData = { name: '', contactName: '', vat: '', address: '', city: '', postalCode: '', pec: '', email: '', phone: '' }

export const CLIENT_FILTERS = ['all', 'due', 'owed'] as const
export type ClientFilter = (typeof CLIENT_FILTERS)[number]

// Prossimi passi pronti: testo (chiave in "clienti") e fra quanti giorni
export const QUICK_STEPS = [
  { key: 'quickCall', days: 1 },
  { key: 'quickSendQuote', days: 2 },
  { key: 'quickFollowQuote', days: 5 },
  { key: 'quickPayment', days: 3 },
] as const

// Importo con IVA come lo vede il cliente: «+ IVA» aggiunge l'aliquota
export function quoteGross(total: number, vatMode: string | null, vatRate: number | null): number {
  const rate = Number(vatRate) || 0
  const value = vatMode === 'plus' && rate > 0 ? total * (1 + rate / 100) : total
  return Math.round(value * 100) / 100
}

// Giorno di calendario italiano (AAAA-MM-GG), anche dal server in UTC
export function romeToday(offsetDays = 0): string {
  const day = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(day)
}

// Passo da fare oggi o già scaduto
export function isStepDue(due: string | null): boolean {
  return !!due && due <= romeToday()
}

// Numero per wa.me: solo cifre, prefisso italiano se manca
export function whatsappDigits(phone: string | null): string | null {
  if (!phone) return null
  const trimmed = phone.trim()
  let digits = trimmed.replace(/\D/g, '')
  if (trimmed.startsWith('00')) digits = digits.slice(2)
  else if (!trimmed.startsWith('+') && digits.length <= 10) digits = `39${digits}`
  return digits.length >= 8 ? digits : null
}

export function formatEur(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(value) || 0)
}
