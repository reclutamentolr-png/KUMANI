// KUMANI Casa: tipi, elenchi e calcoli condivisi (nessuna chiamata Supabase).
// Le scadenze della casa sono voci di Life Calendar (casa_home_id), le
// bollette spese fisse di Spendly: qui solo ciò che è proprio della casa.

import type { Recurrence } from '@/lib/lifeCalendar'
import type { FixedExpenseFrequency } from '@/lib/spendly'

export const HOME_KINDS = ['main', 'second', 'rented_out', 'other'] as const
export type HomeKind = (typeof HOME_KINDS)[number]

export const UTILITY_KINDS = ['electricity', 'gas', 'water', 'internet', 'phone', 'waste', 'heating', 'other'] as const
export type UtilityKind = (typeof UTILITY_KINDS)[number]

export const DOCUMENT_KINDS = ['lease', 'deed', 'insurance', 'systems', 'energy', 'floorplan', 'condo', 'other'] as const
export type CasaDocumentKind = (typeof DOCUMENT_KINDS)[number]

export const CASA_TABS = ['deadlines', 'utilities', 'appliances', 'documents'] as const
export type CasaTab = (typeof CASA_TABS)[number]

export const DEADLINE_RECURRENCES: Recurrence[] = ['none', 'monthly', 'yearly', 'every_2_years', 'custom']
// Promemoria delle scadenze della casa (giorni prima)
export const CASA_REMINDER_OFFSETS = [30, 7, 1]

export const BILL_FREQUENCIES: FixedExpenseFrequency[] = ['mensile', 'bimestrale', 'trimestrale', 'semestrale', 'annuale']

// Manutenzioni già pronte: un tocco riempie la scadenza (titolo e ripetizione),
// la data la sceglie l'utente. La periodicità è un'indicazione: vale quella
// del libretto o delle norme del proprio Comune o Regione.
export const MAINTENANCE_PRESETS: { id: string; recurrence: Recurrence; customDays?: number; category: 'home' | 'contracts' }[] = [
  { id: 'boilerService', recurrence: 'yearly', category: 'home' },
  { id: 'boilerEmissions', recurrence: 'every_2_years', category: 'home' },
  { id: 'acFilters', recurrence: 'custom', customDays: 180, category: 'home' },
  { id: 'acSanitize', recurrence: 'yearly', category: 'home' },
  { id: 'smokeDetectors', recurrence: 'yearly', category: 'home' },
  { id: 'extinguisher', recurrence: 'custom', customDays: 180, category: 'home' },
  { id: 'chimney', recurrence: 'yearly', category: 'home' },
  { id: 'gutters', recurrence: 'yearly', category: 'home' },
  { id: 'waterFilter', recurrence: 'custom', customDays: 180, category: 'home' },
  { id: 'applianceCleaning', recurrence: 'custom', customDays: 90, category: 'home' },
  { id: 'gate', recurrence: 'yearly', category: 'home' },
  { id: 'homeInsurance', recurrence: 'yearly', category: 'contracts' },
  { id: 'wasteTax', recurrence: 'yearly', category: 'home' },
]

export interface CasaHome {
  id: string
  name: string
  kind: HomeKind
  address: string | null
  notes: string | null
  created_at: string
}

export interface CasaDeadline {
  id: string
  title: string
  category: string
  due_date: string
  recurrence: Recurrence
  recurrence_custom_days: number | null
  notes: string | null
}

export interface CasaUtility {
  id: string
  home_id: string
  kind: UtilityKind
  provider: string | null
  customer_code: string | null
  supply_code: string | null
  support_phone: string | null
  offer_ends_on: string | null
  notes: string | null
  spendly_fixed_id: string | null
}

export interface CasaAppliance {
  id: string
  home_id: string
  name: string
  brand: string | null
  model: string | null
  serial_number: string | null
  room: string | null
  purchased_on: string | null
  price: number | null
  store: string | null
  warranty_until: string | null
  support_phone: string | null
  notes: string | null
  receipt_path: string | null
  manual_path: string | null
  findo_location_id: string | null
}

// Posizione di Findo da scegliere per un apparecchio (percorso completo)
export interface FindoPlace {
  id: string
  path: string
}

export interface CasaDocument {
  id: string
  home_id: string
  kind: CasaDocumentKind
  title: string
  file_path: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  expires_on: string | null
  created_at: string
}

// Bolletta di Spendly collegata a un'utenza (quella che serve a Casa)
export interface CasaBill {
  id: string
  description: string
  amount: number
  frequency: FixedExpenseFrequency
  start_date: string
  end_date: string | null
  billing_day: number | null
  next_due: string | null
}

export type HomeForm = { name: string; kind: HomeKind; address: string; notes: string }
export const emptyHomeForm = (): HomeForm => ({ name: '', kind: 'main', address: '', notes: '' })

export type DeadlineForm = { title: string; dueDate: string; recurrence: Recurrence; customDays: number | null; notes: string; category: 'home' | 'contracts' }

export type UtilityForm = {
  kind: UtilityKind
  provider: string
  customerCode: string
  supplyCode: string
  supportPhone: string
  offerEndsOn: string
  notes: string
  // Bolletta in Spendly: nessuna, una già presente o una nuova
  billMode: 'none' | 'existing' | 'new'
  billId: string
  billAmount: number | null
  billFrequency: FixedExpenseFrequency
  billDay: number | null
  billStart: string
}

export type ApplianceForm = {
  name: string
  brand: string
  model: string
  serialNumber: string
  room: string
  purchasedOn: string
  price: number | null
  store: string
  warrantyUntil: string
  supportPhone: string
  notes: string
  receiptPath: string | null
  manualPath: string | null
  findoLocationId: string | null
}

export type DocumentForm = {
  kind: CasaDocumentKind
  title: string
  filePath: string
  fileName: string
  mimeType: string
  sizeBytes: number
  expiresOn: string
}

export const CASA_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
export const CASA_FILE_MAX_BYTES = 10 * 1024 * 1024

// Garanzia: 'expired' scaduta, 'soon' entro 60 giorni, 'ok' oltre
export function warrantyState(until: string | null, today: string): 'none' | 'expired' | 'soon' | 'ok' {
  if (!until) return 'none'
  if (until < today) return 'expired'
  const days = Math.round((Date.parse(`${until}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000)
  return days <= 60 ? 'soon' : 'ok'
}

// Due anni dall'acquisto: la garanzia legale per i beni comprati da un
// venditore professionale nell'UE (solo un suggerimento nel modulo)
export function legalWarrantyEnd(purchasedOn: string): string {
  const [y, m, d] = purchasedOn.split('-').map(Number)
  const end = new Date(Date.UTC(y + 2, m - 1, d))
  return end.toISOString().slice(0, 10)
}

export function fileExtension(file: { name: string; type: string }): string {
  const fromType: Record<string, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }
  return fromType[file.type] ?? (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5)
}
