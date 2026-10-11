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
  jobTitle: 200,
  checklistItem: 200,
  checklistItems: 50,
  paymentNote: 200,
  costDescription: 200,
  timeNote: 200,
  maxHourlyCost: 10_000,
  maxHoursEntry: 24,
  maxAmount: 10_000_000,
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
  open_jobs: number
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
  paid_at: string | null
  // Imponibile (senza IVA): per il margine del lavoro
  net: number
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

// Lavori (fase 2): stato, cose da fare e pagamenti registrati a mano
export const JOB_STAGES = ['todo', 'doing', 'done', 'paid'] as const
export type JobStage = (typeof JOB_STAGES)[number]
export const PAYMENT_METHODS = ['transfer', 'cash', 'card', 'other'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export interface ChecklistItem {
  text: string
  done: boolean
}

export interface ClientJob {
  id: string
  client_id: string
  quote_id: string | null
  title: string
  stage: JobStage
  amount: number | null
  address: string | null
  start_date: string | null
  due_date: string | null
  notes: string | null
  checklist: ChecklistItem[]
  hourly_cost: number | null
}

export interface ClientPayment {
  id: string
  job_id: string | null
  amount: number
  paid_on: string
  method: PaymentMethod
  note: string | null
}

export interface JobFormData {
  title: string
  amount: string
  quoteId: string
  address: string
  startDate: string
  dueDate: string
}

export interface PaymentFormData {
  amount: string
  paidOn: string
  method: PaymentMethod
  jobId: string
  note: string
}

// Importo scritto all'italiana («1.234,56», «12,5») o con il punto decimale
export function parseEuro(value: string): number | null {
  const raw = value.trim().replace(/\s|€/g, '')
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw
  const n = Number(normalized)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null
}

export const STAGE_STYLES: Record<JobStage, string> = {
  todo: 'bg-[var(--background)] text-[var(--muted)]',
  doing: 'bg-[#e8f0ff] text-[#1e4fa3]',
  done: 'bg-[var(--gold-pale)] text-[#7a5a14]',
  paid: 'bg-[#e7f4ea] text-[#1d6b34]',
}

// Fase 3: tempo, costi, foto e documenti del lavoro
export interface TimeEntry {
  id: string
  started_at: string
  ended_at: string | null
  note: string | null
}

export const COST_KINDS = ['material', 'expense'] as const
export type CostKind = (typeof COST_KINDS)[number]

export interface JobCost {
  id: string
  kind: CostKind
  description: string
  quantity: number
  unit_cost: number
  product_id: string | null
  stock_unloaded: boolean
}

export interface JobFile {
  id: string
  name: string
  mime: string
  size: number
  created_at: string
  url: string | null
}

export interface JobProduct {
  id: string
  name: string
  unit: string
  purchase_price: number
  stock: number
}

export const JOB_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const JOB_FILE_MAX_BYTES = 10 * 1024 * 1024

// Imponibile del preventivo: «IVA inclusa» va scorporata
export function quoteNet(total: number, vatMode: string | null, vatRate: number | null): number {
  const rate = Number(vatRate) || 0
  const value = vatMode === 'included' && rate > 0 ? total / (1 + rate / 100) : total
  return Math.round(value * 100) / 100
}

// Minuti di una sessione (acceso: fino a adesso)
export function entryMinutes(entry: TimeEntry, now = Date.now()): number {
  const end = entry.ended_at ? new Date(entry.ended_at).getTime() : now
  return Math.max(0, (end - new Date(entry.started_at).getTime()) / 60_000)
}

export function formatHours(minutes: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(minutes / 60)
}

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${Math.floor(total / 3600)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
}
