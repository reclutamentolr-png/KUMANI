import { fixedExpenseDueDate, paymentKey, periodOf, type SpendlyFixedExpense, type SpendlyFixedPayment } from '@/lib/spendly'

// Previsione di fine mese (Spendly e spese condivise): quanto si spenderà nel
// mese in corso, con una fascia «tra … e …» dichiarata.
//
// - Le spese fisse del mese sono note: contano per intero.
// - Le spese variabili si stimano mescolando il ritmo di questo mese (speso
//   finora / giorni passati × giorni del mese) con la media dei mesi
//   precedenti: a inizio mese pesa di più la media, verso la fine il ritmo.
// - La fascia nasce dalla variabilità dei mesi precedenti e si stringe man
//   mano che il mese va avanti; a fine mese coincide con lo speso.

export type MonthForecast = {
  // Speso finora (fisse già registrate + variabili)
  spent: number
  // Previsione di fine mese e fascia
  expected: number
  low: number
  high: number
  // Giorno del mese e giorni del mese (fuso di Roma)
  day: number
  days: number
  // Pochi dati: nei primi giorni senza mesi precedenti la stima è solo indicativa
  uncertain: boolean
}

const round = (n: number) => Math.round(n * 100) / 100

export function forecastMonth(input: {
  // Spese fisse del mese (tutte, anche quelle non ancora scadute)
  fixedMonth: number
  // Spese fisse già registrate o pagate a oggi (per «speso finora»)
  fixedSoFar: number
  // Spese variabili del mese fino a oggi
  variableSoFar: number
  // Spese variabili dei mesi precedenti (i più recenti, mesi senza dati esclusi)
  history: number[]
  // Oggi: giorno del mese e quanti giorni ha il mese
  day: number
  days: number
}): MonthForecast {
  const { fixedMonth, fixedSoFar, variableSoFar, day, days } = input
  const history = input.history.filter((v) => v > 0).slice(0, 6)
  const progress = Math.min(Math.max(day / days, 0), 1)
  const pace = day > 0 ? (variableSoFar / day) * days : variableSoFar
  const average = history.length ? history.reduce((a, b) => a + b, 0) / history.length : null

  let expectedVariable = average === null ? pace : progress * pace + (1 - progress) * average
  expectedVariable = Math.max(expectedVariable, variableSoFar)

  // Variabilità dei mesi precedenti (deviazione standard), altrimenti un 25% prudente
  const deviation =
    history.length >= 2 && average !== null
      ? Math.sqrt(history.reduce((s, v) => s + (v - average) ** 2, 0) / (history.length - 1))
      : expectedVariable * 0.25
  const spread = (deviation + expectedVariable * 0.05) * (1 - progress)

  const lowVariable = Math.max(variableSoFar, expectedVariable - spread)
  const highVariable = expectedVariable + spread
  return {
    spent: round(fixedSoFar + variableSoFar),
    expected: round(fixedMonth + expectedVariable),
    low: round(fixedMonth + lowVariable),
    high: round(fixedMonth + highVariable),
    day,
    days,
    uncertain: history.length === 0 && day < 7,
  }
}

// Oggi a Roma: anno, mese (1-12), giorno e giorni del mese
export function romeMonthToday(): { year: number; month: number; day: number; days: number; key: string } {
  const key = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
  const [year, month, day] = key.split('-').map(Number)
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return { year, month, day, days, key }
}

// Spendly personale: previsione del mese in corso dalle spese fisse (con le
// scadenze già pagate al loro importo reale), dalle variabili del mese e da
// quelle dei 6 mesi precedenti (totali per mese, dal più recente).
export function personalForecast(input: {
  fixedExpenses: SpendlyFixedExpense[]
  payments: SpendlyFixedPayment[]
  variableThisMonth: number
  history: number[]
  today: { year: number; month: number; day: number; days: number; key: string }
}): MonthForecast {
  const { year, month, day, days, key } = input.today
  const paid = new Map(input.payments.map((p) => [paymentKey(p.expense_id, p.period), Number(p.amount)]))
  let fixedMonth = 0
  let fixedSoFar = 0
  for (const expense of input.fixedExpenses) {
    const due = fixedExpenseDueDate(expense, year, month)
    if (!due) continue
    const amount = paid.get(paymentKey(expense.id, periodOf(year, month))) ?? Number(expense.amount)
    fixedMonth += amount
    if (due <= key || paid.has(paymentKey(expense.id, periodOf(year, month)))) fixedSoFar += amount
  }
  return forecastMonth({ fixedMonth, fixedSoFar, variableSoFar: input.variableThisMonth, history: input.history, day, days })
}

// Totali per mese ('YYYY-MM' → somma) dei 6 mesi prima di quello indicato, dal più recente
export function previousMonthsTotals(rows: { date: string; amount: number }[], year: number, month: number): number[] {
  const sums = new Map<string, number>()
  for (const r of rows) sums.set(r.date.slice(0, 7), (sums.get(r.date.slice(0, 7)) ?? 0) + Number(r.amount))
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(year, month - 2 - i, 1))
    return sums.get(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`) ?? 0
  })
}
