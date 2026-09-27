// Spendly (Organizzazione Personale > gestione spese) — tipi condivisi,
// tassonomia categorie e logica di calcolo pura (nessuna chiamata Supabase
// qui, solo funzioni deterministiche testabili e riusabili sia lato server
// che nei componenti client).

export type IncomeType = 'fissa' | 'variabile'
export type FixedExpenseFrequency = 'mensile' | 'bimestrale' | 'trimestrale' | 'semestrale' | 'annuale' | 'una_tantum'
export type BudgetStatus = 'positivo' | 'in_guardia' | 'critico'

export const INCOME_CATEGORIES = ['stipendio', 'bonus', 'freelance', 'vendite', 'altro'] as const
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number]

export const FIXED_EXPENSE_CATEGORIES = [
  'mutuo_affitto',
  'bollette',
  'abbonamenti',
  'assicurazioni',
  'finanziamenti',
  'ricariche',
  'altro',
] as const
export type FixedExpenseCategory = (typeof FIXED_EXPENSE_CATEGORIES)[number]

export const VARIABLE_EXPENSE_CATEGORIES = [
  'spesa_alimentari',
  'svago_ristoranti',
  'trasporti',
  'salute',
  'casa',
  'shopping',
  'altro',
] as const
export type VariableExpenseCategory = (typeof VARIABLE_EXPENSE_CATEGORIES)[number]

export interface SpendlyIncome {
  id: string
  description: string
  amount: number
  income_type: IncomeType
  category: IncomeCategory
  income_date: string
  notes: string | null
}

export interface SpendlyFixedExpense {
  id: string
  description: string
  amount: number
  frequency: FixedExpenseFrequency
  category: FixedExpenseCategory
  start_date: string
  end_date: string | null
  billing_day: number | null
  notes: string | null
}

export interface SpendlyVariableExpense {
  id: string
  description: string
  amount: number
  expense_date: string
  category: VariableExpenseCategory
  notes: string | null
}

export const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
] as const

export const MONTH_SHORT_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'] as const

const FREQUENCY_STEP: Record<FixedExpenseFrequency, number> = {
  mensile: 1,
  bimestrale: 2,
  trimestrale: 3,
  semestrale: 6,
  annuale: 12,
  una_tantum: 0,
}

/** Anno corrente reale (non hardcoded, per non richiedere di ricordarsi di
 * aggiornare la lista ogni gennaio). */
export function currentYear(): number {
  return new Date().getFullYear()
}

/** Anni selezionabili nella Dashboard: dal 2024 all'anno corrente (mai un
 * anno futuro, vedi FULL_YEARS_START). */
const FULL_YEARS_START = 2024
export function dashboardYears(): number[] {
  const years: number[] = []
  for (let y = FULL_YEARS_START; y <= currentYear(); y++) years.push(y)
  return years
}

/** Anni selezionabili nelle altre pagine (Entrate, Spese Fisse, Spese
 * Variabili, Capienza): solo l'anno corrente, niente storico né anni
 * futuri — semplifica l'uso quotidiano dello strumento. */
export function currentYearOnly(): number[] {
  return [currentYear()]
}

/**
 * Un mese (year, month) di calendario espresso come intero unico
 * (year*12+month-1), utile per confrontare "a partire da"/"fino a" con un
 * mese target senza gestire manualmente i cambi di anno.
 */
function yearMonthIndex(dateStr: string): number {
  const d = new Date(dateStr)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

/**
 * Vero se una spesa fissa (con il suo start_date/end_date e frequenza) è
 * dovuta nel mese (year, month) indicato. "Mensile" è dovuta in ogni mese
 * dell'intervallo; le altre frequenze ricorrono ogni N mesi a partire dal
 * mese di start_date, anche attraverso più anni (es. un finanziamento
 * trimestrale che inizia a novembre 2026 tocca anche febbraio/maggio
 * 2027).
 */
export function fixedExpenseAppliesToMonth(expense: SpendlyFixedExpense, year: number, month: number): boolean {
  const targetIdx = year * 12 + (month - 1)
  const startIdx = yearMonthIndex(expense.start_date)
  if (targetIdx < startIdx) return false
  if (expense.end_date) {
    const endIdx = yearMonthIndex(expense.end_date)
    if (targetIdx > endIdx) return false
  }
  if (expense.frequency === 'mensile') return true
  // Una tantum: solo nel mese della data indicata.
  if (expense.frequency === 'una_tantum') return targetIdx === startIdx
  const step = FREQUENCY_STEP[expense.frequency]
  return (targetIdx - startIdx) % step === 0
}

/** Primo giorno del mese (chiave di una singola scadenza): '2026-10-01'. */
export function periodOf(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/**
 * Data di scadenza di una spesa fissa nel mese indicato ('YYYY-MM-DD'), o
 * null se in quel mese non è dovuta. Il giorno è il "giorno di scadenza"
 * (billing_day) o, se manca, quello della data di inizio; nei mesi più corti
 * si usa l'ultimo giorno (es. 31 → 30 novembre). Una tantum: la data esatta.
 */
export function fixedExpenseDueDate(expense: SpendlyFixedExpense, year: number, month: number): string | null {
  if (!fixedExpenseAppliesToMonth(expense, year, month)) return null
  if (expense.frequency === 'una_tantum') return expense.start_date
  const wanted = expense.billing_day ?? Number(expense.start_date.slice(8, 10))
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(wanted, lastDay)).padStart(2, '0')}`
}

/** Pagamento registrato per una scadenza (importo reale pagato). */
export interface SpendlyFixedPayment {
  expense_id: string
  period: string
  amount: number
  paid_on: string
}

/** Chiave "spesa:mese" per ritrovare in fretta il pagamento di una scadenza. */
export function paymentKey(expenseId: string, period: string): string {
  return `${expenseId}:${period}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount)
}

export interface MonthTotals {
  month: number
  income: number
  fixedExpenses: number
  variableExpenses: number
  balance: number
}

/**
 * Riepilogo mensile "grezzo" (entrate, spese fisse, spese variabili, saldo
 * netto) per i 12 mesi di un anno — usato sia dalla Dashboard (grafici e
 * card mensili) sia dalla pagina Capienza (che aggiunge budget/percentuale
 * sopra questi stessi numeri).
 */
export function computeMonthlyTotals(
  income: SpendlyIncome[],
  fixedExpenses: SpendlyFixedExpense[],
  variableExpenses: SpendlyVariableExpense[],
  year: number,
  // Scadenze già pagate: nel mese conta l'importo reale al posto della stima.
  payments: SpendlyFixedPayment[] = []
): MonthTotals[] {
  const paid = new Map(payments.map((p) => [paymentKey(p.expense_id, p.period), Number(p.amount)]))
  const months: MonthTotals[] = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    income: 0,
    fixedExpenses: 0,
    variableExpenses: 0,
    balance: 0,
  }))

  for (const item of income) {
    const d = new Date(item.income_date)
    if (d.getUTCFullYear() !== year) continue
    const bucket = months[d.getUTCMonth()]
    if (bucket) bucket.income += item.amount
  }

  for (const item of fixedExpenses) {
    for (const bucket of months) {
      if (fixedExpenseAppliesToMonth(item, year, bucket.month)) {
        bucket.fixedExpenses += paid.get(paymentKey(item.id, periodOf(year, bucket.month))) ?? item.amount
      }
    }
  }

  for (const item of variableExpenses) {
    const d = new Date(item.expense_date)
    if (d.getUTCFullYear() !== year) continue
    const bucket = months[d.getUTCMonth()]
    if (bucket) bucket.variableExpenses += item.amount
  }

  for (const bucket of months) {
    bucket.balance = bucket.income - bucket.fixedExpenses - bucket.variableExpenses
  }

  return months
}

export interface MonthCapacity extends MonthTotals {
  availableBudget: number
  remaining: number
  usedPercent: number
  status: BudgetStatus
}

/** Soglie di stato: sotto il 70% del budget disponibile = positivo, fino al
 * 99% = in guardia, dal 100% (o budget disponibile <= 0) = critico — a meno
 * che il mese non sia semplicemente vuoto (nessuna entrata né spesa
 * registrata), nel qual caso non c'è nulla da segnalare come "critico". */
export function budgetStatus(totals: MonthTotals, usedPercent: number, availableBudget: number): BudgetStatus {
  const isEmpty = totals.income === 0 && totals.fixedExpenses === 0 && totals.variableExpenses === 0
  if (isEmpty) return 'positivo'
  if (availableBudget <= 0 || usedPercent >= 100) return 'critico'
  if (usedPercent >= 70) return 'in_guardia'
  return 'positivo'
}

export function computeMonthCapacity(totals: MonthTotals): MonthCapacity {
  const availableBudget = totals.income - totals.fixedExpenses
  const remaining = availableBudget - totals.variableExpenses
  const usedPercent = availableBudget > 0
    ? Math.round((totals.variableExpenses / availableBudget) * 100)
    : (totals.variableExpenses > 0 ? 100 : 0)

  return {
    ...totals,
    availableBudget,
    remaining,
    usedPercent,
    status: budgetStatus(totals, usedPercent, availableBudget),
  }
}
