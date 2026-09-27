export const CATEGORIES = [
  'person',
  'auto',
  'home',
  'family',
  'contracts',
  'warranties',
  'subscriptions',
  'work',
  'travel',
  'other',
] as const
export type Category = (typeof CATEGORIES)[number]

export const RECURRENCE_OPTIONS = ['none', 'monthly', 'yearly', 'every_2_years', 'custom'] as const
export type Recurrence = (typeof RECURRENCE_OPTIONS)[number]

export type ItemStatus = 'regular' | 'upcoming' | 'urgent' | 'expired'

export interface LifeCalendarItemFormData {
  title: string
  category: Category
  profileId: string | null
  dueDate: string // ISO date (YYYY-MM-DD)
  notes: string
  reminderOffsets: number[]
  recurrence: Recurrence
  recurrenceCustomDays: number | null
}

// Reminder-day presets per category — used only to pre-check the form's
// reminder checkboxes; the user can still edit them before saving. Purely
// data, no AI, no notification is actually sent in V1.
export const REMINDER_PRESETS: Record<Category, number[]> = {
  person: [90, 30, 7],
  auto: [60, 30, 7, 1],
  home: [30, 7],
  family: [90, 30, 7],
  contracts: [30, 7],
  warranties: [30, 7],
  subscriptions: [14, 7, 1],
  work: [30, 7],
  travel: [60, 30, 7],
  other: [30, 7],
}

export function getItemStatus(dueDate: string): ItemStatus {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const daysUntil = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil < 0) return 'expired'
  if (daysUntil <= 7) return 'urgent'
  if (daysUntil <= 30) return 'upcoming'
  return 'regular'
}

export function daysUntil(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

// Somma mesi a una data 'YYYY-MM-DD' in UTC, fermandosi all'ultimo giorno del
// mese di arrivo (31/01 + 1 mese = 28/02, non 03/03; 29/02 + 1 anno = 28/02).
function addMonthsClamped(dateStr: string, months: number): string {
  const y = Number(dateStr.slice(0, 4))
  const m = Number(dateStr.slice(5, 7)) - 1
  const d = Number(dateStr.slice(8, 10))
  const target = new Date(Date.UTC(y, m + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

// Prossima scadenza dopo `steps` ricorrenze (default 1) a partire da
// currentDueDate. Con steps > 1 si calcola sempre dalla data di partenza, così
// il giorno del mese non "scivola" per effetto del clamp a fine mese.
export function computeNextDueDate(
  currentDueDate: string,
  recurrence: Recurrence,
  customDays: number | null,
  steps: number = 1
): string | null {
  const base = currentDueDate.slice(0, 10)
  switch (recurrence) {
    case 'monthly':
      return addMonthsClamped(base, steps)
    case 'yearly':
      return addMonthsClamped(base, 12 * steps)
    case 'every_2_years':
      return addMonthsClamped(base, 24 * steps)
    case 'custom': {
      if (!customDays) return null
      const date = new Date(`${base}T12:00:00Z`)
      date.setUTCDate(date.getUTCDate() + customDays * steps)
      return date.toISOString().slice(0, 10)
    }
    case 'none':
    default:
      return null
  }
}
