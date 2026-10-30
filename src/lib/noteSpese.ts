// Note spese e rimborso chilometrico: tipi, costanti e calcoli condivisi
// (pagina, azioni del server, PDF, CSV). Importi sempre in centesimi interi.

export const EXPENSE_CATEGORIES = ['meals', 'lodging', 'transport', 'taxi', 'parking', 'fuel', 'mileage', 'other'] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const REPORT_STATUSES = ['open', 'submitted', 'reimbursed'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const EXPENSE_BUCKET = 'expense-receipts'
// Foto ridotta nel browser: lato lungo 1600 px, JPEG al 75% (leggibile anche
// lo scontrino stampato piccolo); il bucket accetta al massimo 3 MB
export const RECEIPT_MAX_SIDE = 1600
export const RECEIPT_QUALITY = 0.75
export const RECEIPT_MAX_BYTES = 3 * 1024 * 1024
export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Stessi limiti della migrazione 20270619100000_note_spese.sql
export const EXPENSE_LIMITS = {
  title: 120,
  employeeName: 120,
  recipient: 160,
  notes: 1000,
  description: 200,
  place: 120,
  maxAmountCents: 10_000_000,
  maxAdvanceCents: 100_000_000,
  maxKm: 50_000,
  maxRate: 10,
  maxItemsPerReport: 500,
}

export type ExpenseReport = {
  id: string
  title: string
  employee_name: string | null
  recipient: string | null
  period_from: string | null
  period_to: string | null
  status: ReportStatus
  submitted_on: string | null
  reimbursed_on: string | null
  advance_cents: number
  km_rate: number | null
  notes: string | null
  created_at: string
}

export type ExpenseReportSummary = ExpenseReport & { items_count: number; total_cents: number }

export type ExpenseItem = {
  id: string
  report_id: string
  spent_on: string
  category: ExpenseCategory
  description: string
  amount_cents: number
  route_from: string | null
  route_to: string | null
  km: number | null
  round_trip: boolean
  km_rate: number | null
  receipt_path: string | null
  receipt_url: string | null
}

export type ReportFormData = {
  title: string
  employeeName: string
  recipient: string
  periodFrom: string
  periodTo: string
  advance: string
  notes: string
}

export type ItemFormData = {
  spentOn: string
  category: ExpenseCategory
  description: string
  amount: string
  routeFrom: string
  routeTo: string
  km: string
  roundTrip: boolean
  kmRate: string
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function romeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
}

// Numero scritto all'italiana o all'inglese: «12,50», «1.234,5», «12.50»
export function parseDecimal(value: string): number | null {
  const raw = value.trim().replace(/\s|€/g, '')
  if (!raw) return null
  const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw
  if (!/^\d*\.?\d*$/.test(normalized) || normalized === '.') return null
  const n = Number(normalized)
  return Number.isFinite(n) ? n : null
}

// Euro scritti → centesimi interi (null se non è un numero valido)
export function parseCents(value: string): number | null {
  const n = parseDecimal(value)
  return n === null ? null : Math.round(n * 100)
}

// Centesimi → testo da rimettere nel campo («12,50»)
export function centsToInput(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(cents / 100)
}

export function formatCents(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)
}

export function formatKm(km: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(km)
}

export function formatRate(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(rate)
}

// Data «2027-03-14» → «14/03/2027» nella lingua della pagina (senza fuso)
export function formatDay(day: string | null, locale: string, style: 'short' | 'long' = 'short'): string {
  if (!day || !DATE_RE.test(day)) return ''
  const [y, m, d] = day.split('-').map(Number)
  return new Intl.DateTimeFormat(locale, style === 'long' ? { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } : { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
}

// Giorni da aggiungere a una data (per duplicare una nota spese)
export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  const a = from.split('-').map(Number)
  const b = to.split('-').map(Number)
  return Math.round((Date.UTC(b[0], b[1] - 1, b[2]) - Date.UTC(a[0], a[1] - 1, a[2])) / 86_400_000)
}

// Chilometri effettivi: doppi con andata e ritorno
export function itemKm(item: Pick<ExpenseItem, 'km' | 'round_trip'>): number {
  return item.km ? item.km * (item.round_trip ? 2 : 1) : 0
}

// Stesso calcolo del database (expense_items_mileage_amount)
export function mileageCents(km: number, roundTrip: boolean, rate: number): number {
  return Math.round(Math.round(km * (roundTrip ? 2 : 1) * rate * 1_000_000) / 10_000)
}

export type ReportTotals = {
  byCategory: { category: ExpenseCategory; cents: number; count: number }[]
  totalCents: number
  totalKm: number
  advanceCents: number
  // Positivo: l'azienda deve rimborsare; negativo: va restituito all'azienda
  dueCents: number
  receipts: number
}

export function computeTotals(items: ExpenseItem[], advanceCents: number): ReportTotals {
  const map = new Map<ExpenseCategory, { cents: number; count: number }>()
  let totalCents = 0
  let totalKm = 0
  let receipts = 0
  for (const it of items) {
    const row = map.get(it.category) ?? { cents: 0, count: 0 }
    row.cents += it.amount_cents
    row.count += 1
    map.set(it.category, row)
    totalCents += it.amount_cents
    totalKm += itemKm(it)
    if (it.receipt_path) receipts += 1
  }
  const byCategory = EXPENSE_CATEGORIES.filter((c) => map.has(c)).map((c) => ({ category: c, ...map.get(c)! }))
  return { byCategory, totalCents, totalKm: Math.round(totalKm * 10) / 10, advanceCents, dueCents: totalCents - advanceCents, receipts }
}

// Voci in ordine di data (poi di inserimento)
export function sortItems(items: ExpenseItem[]): ExpenseItem[] {
  return [...items].sort((a, b) => a.spent_on.localeCompare(b.spent_on))
}

// Testo del percorso per la tabella: «Roma → Milano»
export function routeText(item: Pick<ExpenseItem, 'route_from' | 'route_to'>): string {
  return [item.route_from, item.route_to].filter(Boolean).join(' → ')
}

export function receiptExtension(file: File): string {
  return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
}

// Nome del file scaricato: «nota-spese-trasferta-milano.pdf»
export function fileSlug(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return slug || 'nota-spese'
}

// CSV per Excel (punto e virgola, BOM): testo che inizia con = + - @ non
// diventa una formula
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    if (value === null || value === undefined) return ''
    const text = typeof value === 'number' ? String(value).replace('.', ',') : /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return '﻿' + rows.map((row) => row.map(cell).join(';')).join('\r\n')
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
