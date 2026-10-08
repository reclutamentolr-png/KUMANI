// Kumani Garage: tipi e calcoli (senza accesso al database, usati sia dal
// server sia dalle pagine). Le date sono giorni di calendario 'YYYY-MM-DD'.
import { addDays, daysBetween } from '@/lib/agenda'

export const VEHICLE_KINDS = ['owned', 'rental'] as const
export type VehicleKind = (typeof VEHICLE_KINDS)[number]

// Auto o moto (stesse scadenze, spese e controllo dei km)
export const VEHICLE_TYPES = ['car', 'motorbike'] as const
export type VehicleType = (typeof VEHICLE_TYPES)[number]

// Documenti del veicolo (foto o PDF nello spazio privato garage-files)
export const GARAGE_DOC_KINDS = ['registration', 'insurance', 'other'] as const
export type GarageDocKind = (typeof GARAGE_DOC_KINDS)[number]
export type GarageDocument = {
  id: string
  vehicle_id: string
  kind: GarageDocKind
  title: string | null
  file_path: string
  file_name: string | null
  mime_type: string | null
  size_bytes: number | null
  created_at: string
}

export const DEADLINE_KINDS = ['bollo', 'assicurazione', 'revisione', 'tagliando', 'gomme', 'altro'] as const
export type DeadlineKind = (typeof DEADLINE_KINDS)[number]

export const DEADLINE_RECURRENCES = ['none', 'yearly', 'every_2_years'] as const
export type DeadlineRecurrence = (typeof DEADLINE_RECURRENCES)[number]

export const EXPENSE_KINDS = ['carburante', 'manutenzione', 'bollo', 'assicurazione', 'revisione', 'gomme', 'pedaggi', 'parcheggio', 'lavaggio', 'altro'] as const
export type ExpenseKind = (typeof EXPENSE_KINDS)[number]

// Scadenza pagata → spesa dello stesso tipo
export const DEADLINE_EXPENSE_KIND: Record<DeadlineKind, ExpenseKind> = {
  bollo: 'bollo',
  assicurazione: 'assicurazione',
  revisione: 'revisione',
  tagliando: 'manutenzione',
  gomme: 'gomme',
  altro: 'altro',
}

export type GarageVehicle = {
  id: string
  kind: VehicleKind
  vehicle_type: VehicleType
  name: string
  model: string | null
  plate: string | null
  initial_km: number
  rental_start: string | null
  rental_months: number | null
  rental_km_included: number | null
  rental_monthly_fee: number | null
  rental_down_payment: number | null
  rental_extra_km_cost: number | null
  rental_unused_km_refund: number | null
  rental_includes_tax: boolean
  rental_includes_insurance: boolean
  spendly_fixed_id: string | null
  created_at: string
}

export type GarageReading = { id: string; vehicle_id: string; km: number; read_on: string; note: string | null }
export type GarageDeadline = {
  id: string
  vehicle_id: string
  kind: DeadlineKind
  title: string | null
  due_date: string
  amount: number | null
  recurrence: DeadlineRecurrence
}
export type GarageExpense = { id: string; vehicle_id: string; kind: ExpenseKind; amount: number; spent_on: string; note: string | null }

export type VehicleForm = {
  kind: VehicleKind
  vehicleType: VehicleType
  name: string
  model: string
  plate: string
  initialKm: number
  rentalStart: string
  rentalMonths: number | null
  rentalKmIncluded: number | null
  rentalMonthlyFee: number | null
  rentalDownPayment: number | null
  rentalExtraKmCost: number | null
  rentalUnusedKmRefund: number | null
  rentalIncludesTax: boolean
  rentalIncludesInsurance: boolean
  // Rata del noleggio anche tra le spese fisse di Spendly
  addFeeToSpendly: boolean
}

// Stessa data N mesi dopo (31 gennaio + 1 mese → 28/29 febbraio)
export function addMonths(key: string, months: number): string {
  const [y, m, d] = key.split('-').map(Number)
  const total = y * 12 + (m - 1) + months
  const year = Math.floor(total / 12)
  const month = (total % 12) + 1
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

// Ultimo giorno del contratto: il giorno prima dello stesso giorno N mesi dopo
export function rentalEnd(start: string, months: number): string {
  return addDays(addMonths(start, months), -1)
}

// Prossima scadenza dopo un rinnovo (annuale o ogni due anni)
export function nextDueDate(due: string, recurrence: DeadlineRecurrence): string | null {
  if (recurrence === 'yearly') return addMonths(due, 12)
  if (recurrence === 'every_2_years') return addMonths(due, 24)
  return null
}

// Km all'auto in una data, dalle rilevazioni (lineare tra due rilevazioni;
// dopo l'ultima si resta all'ultima)
export function kmAt(date: string, start: { date: string; km: number }, readings: { km: number; read_on: string }[]): number {
  const points = [start, ...readings.map((r) => ({ date: r.read_on, km: r.km }))].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  if (date <= points[0].date) return points[0].km
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const next = points[i]
    if (date <= next.date) {
      const span = daysBetween(prev.date, next.date)
      if (span <= 0) return next.km
      return prev.km + ((next.km - prev.km) * daysBetween(prev.date, date)) / span
    }
  }
  return points[points.length - 1].km
}

export type RentalStatus = 'ok' | 'warning' | 'over'

export type RentalReport = {
  start: string
  end: string
  months: number
  kmIncluded: number
  monthlyBudget: number
  yearlyBudget: number
  // Ultima rilevazione usata per i calcoli
  readOn: string
  kmDriven: number
  kmLeft: number
  status: RentalStatus
  // Budget maturato alla data della rilevazione e scostamento (+ = oltre)
  budgetToDate: number
  deviation: number
  // Budget a fine del mese contrattuale in corso (per lo stato "fuori budget")
  budgetMonthEnd: number
  overMonthEnd: number
  usedPercent: number
  timePercent: number
  // Mese contrattuale in corso (1..mesi) e sue date
  contractMonth: number
  monthFrom: string
  monthTo: string
  // Anno contrattuale in corso
  contractYear: number
  yearFrom: string
  yearTo: string
  yearUsed: number
  yearLeft: number
  yearPercent: number
  // Km al giorno disponibili da oggi a fine contratto
  dailyAvailable: number | null
  daysLeft: number
  // Previsioni al ritmo attuale
  realMonthly: number | null
  projection12: number | null
  projectionEnd: number | null
  finalMargin: number | null
  // Costo stimato a fine contratto per i km in più (o rimborso per quelli non fatti)
  extraCost: number | null
  refund: number | null
  // Rata, anticipo e costo totale del contratto
  totalCost: number | null
  ended: boolean
}

const DAYS_PER_MONTH = 365.25 / 12

// Controllo km del noleggio alla data dell'ultima rilevazione (o a oggi se
// non ce ne sono). Il budget matura giorno per giorno; "fuori budget" se si
// supera anche il budget previsto per la fine del mese contrattuale in corso.
export function rentalReport(vehicle: GarageVehicle, readings: GarageReading[], today: string): RentalReport | null {
  if (vehicle.kind !== 'rental' || !vehicle.rental_start || !vehicle.rental_months || !vehicle.rental_km_included) return null
  const start = vehicle.rental_start
  const months = vehicle.rental_months
  const kmIncluded = vehicle.rental_km_included
  const end = rentalEnd(start, months)
  const totalDays = daysBetween(start, end) + 1

  const sorted = [...readings].sort((a, b) => (a.read_on < b.read_on ? -1 : a.read_on > b.read_on ? 1 : 0))
  const latest = sorted[sorted.length - 1]
  const readOn = latest ? latest.read_on : today < start ? start : today > end ? end : today
  const kmNow = latest ? latest.km : vehicle.initial_km
  const kmDriven = Math.max(0, kmNow - vehicle.initial_km)
  const kmLeft = kmIncluded - kmDriven

  // Giorni trascorsi dal ritiro alla rilevazione (il giorno del ritiro è 0)
  const elapsed = Math.min(Math.max(daysBetween(start, readOn), 0), totalDays)
  const budgetToDate = (kmIncluded * elapsed) / totalDays
  const deviation = kmDriven - budgetToDate

  // Mese contrattuale in corso alla data della rilevazione
  let contractMonth = 1
  while (contractMonth < months && addMonths(start, contractMonth) <= readOn) contractMonth++
  const monthFrom = addMonths(start, contractMonth - 1)
  const monthTo = addDays(addMonths(start, contractMonth), -1)
  const budgetMonthEnd = (kmIncluded * contractMonth) / months
  const overMonthEnd = kmDriven - budgetMonthEnd

  // Anno contrattuale in corso
  const years = Math.max(1, Math.ceil(months / 12))
  let contractYear = 1
  while (contractYear < years && addMonths(start, contractYear * 12) <= readOn) contractYear++
  const yearFrom = addMonths(start, (contractYear - 1) * 12)
  const yearMonths = Math.min(12, months - (contractYear - 1) * 12)
  const yearTo = addDays(addMonths(yearFrom, yearMonths), -1)
  const yearlyBudget = (kmIncluded * yearMonths) / months
  const kmAtYearStart = kmAt(yearFrom, { date: start, km: vehicle.initial_km }, sorted)
  const yearUsed = Math.max(0, kmNow - kmAtYearStart)

  const status: RentalStatus = overMonthEnd > 0 ? 'over' : deviation > 0 ? 'warning' : 'ok'

  const ended = today > end
  const daysLeft = Math.max(0, daysBetween(readOn, end))
  const dailyAvailable = daysLeft > 0 ? Math.max(0, kmLeft) / daysLeft : null

  // Previsioni solo con almeno una settimana di dati
  const hasTrend = latest !== undefined && elapsed >= 7 && kmDriven > 0
  const perDay = hasTrend ? kmDriven / elapsed : null
  const projectionEnd = perDay !== null ? Math.round(perDay * totalDays) : null
  const finalMargin = projectionEnd !== null ? kmIncluded - projectionEnd : null
  const extraCost =
    finalMargin !== null && finalMargin < 0 && vehicle.rental_extra_km_cost ? Math.round(-finalMargin * Number(vehicle.rental_extra_km_cost) * 100) / 100 : null
  const refund =
    finalMargin !== null && finalMargin > 0 && vehicle.rental_unused_km_refund ? Math.round(finalMargin * Number(vehicle.rental_unused_km_refund) * 100) / 100 : null

  const fee = vehicle.rental_monthly_fee !== null ? Number(vehicle.rental_monthly_fee) : null
  const down = vehicle.rental_down_payment !== null ? Number(vehicle.rental_down_payment) : 0
  const totalCost = fee !== null ? Math.round((fee * months + down) * 100) / 100 : null

  return {
    start,
    end,
    months,
    kmIncluded,
    monthlyBudget: kmIncluded / months,
    yearlyBudget,
    readOn,
    kmDriven,
    kmLeft,
    status,
    budgetToDate: Math.round(budgetToDate),
    deviation: Math.round(deviation),
    budgetMonthEnd: Math.round(budgetMonthEnd),
    overMonthEnd: Math.round(overMonthEnd),
    usedPercent: Math.min(100, (kmDriven / kmIncluded) * 100),
    timePercent: Math.min(100, (elapsed / totalDays) * 100),
    contractMonth,
    monthFrom,
    monthTo,
    contractYear,
    yearFrom,
    yearTo,
    yearUsed: Math.round(yearUsed),
    yearLeft: Math.round(yearlyBudget - yearUsed),
    yearPercent: Math.min(100, (yearUsed / yearlyBudget) * 100),
    dailyAvailable,
    daysLeft,
    realMonthly: perDay !== null ? Math.round(perDay * DAYS_PER_MONTH) : null,
    projection12: perDay !== null ? Math.round(perDay * 365.25) : null,
    projectionEnd,
    finalMargin,
    extraCost,
    refund,
    totalCost,
    ended,
  }
}

// Stato di una scadenza rispetto a oggi
export function deadlineState(due: string, today: string): 'overdue' | 'soon' | 'later' {
  const days = daysBetween(today, due)
  if (days < 0) return 'overdue'
  if (days <= 30) return 'soon'
  return 'later'
}
