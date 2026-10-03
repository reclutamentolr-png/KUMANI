// FinCheck — test di educazione finanziaria e check-up del bilancio.
// Logica pura (nessuna chiamata a Supabase): punteggi, profili, indicatori
// calcolati dai dati di Spendly e obiettivi del piano d'azione. I testi sono
// nel namespace "fincheck" dei messaggi.

import {
  fixedExpenseAppliesToMonth,
  paymentKey,
  periodOf,
  type SpendlyFixedExpense,
  type SpendlyFixedPayment,
  type SpendlyIncome,
  type SpendlyVariableExpense,
} from '@/lib/spendly'

export const FINCHECK_AREAS = ['awareness', 'saving', 'debt', 'spending', 'future'] as const
export type FinCheckArea = (typeof FINCHECK_AREAS)[number]

// 15 domande, 3 per area nell'ordine di FINCHECK_AREAS. Testi: q1..q15
// (text, a3, a2, a1, a0 = risposta da 3, 2, 1, 0 punti).
export const FINCHECK_QUESTIONS = Array.from({ length: 15 }, (_, i) => ({
  id: `q${i + 1}`,
  area: FINCHECK_AREAS[Math.floor(i / 3)],
}))

// Ordine delle risposte sullo schermo: diverso per ogni domanda (sempre lo
// stesso, così server e browser mostrano la stessa cosa) per non avere la
// risposta migliore sempre in alto.
const ORDERS: number[][] = [
  [3, 2, 1, 0],
  [1, 3, 0, 2],
  [2, 0, 3, 1],
  [0, 1, 2, 3],
  [2, 3, 1, 0],
]
export const answerOrder = (questionIndex: number) => ORDERS[(questionIndex * 3) % ORDERS.length]

export type AreaLevel = 'green' | 'yellow' | 'red'
export const areaLevel = (score: number): AreaLevel => (score >= 7 ? 'green' : score >= 4 ? 'yellow' : 'red')

export function areaScores(answers: number[]): number[] {
  return FINCHECK_AREAS.map((_, a) => answers[a * 3] + answers[a * 3 + 1] + answers[a * 3 + 2])
}

export type FinCheckProfile = 'planner' | 'builder' | 'balancer' | 'drifter'
export function profileOf(total: number): FinCheckProfile {
  if (total >= 38) return 'planner'
  if (total >= 28) return 'builder'
  if (total >= 18) return 'balancer'
  return 'drifter'
}

// ---------------------------------------------------------------------------
// Check-up del bilancio (dati Spendly, media degli ultimi 3 mesi completi)
// ---------------------------------------------------------------------------

// Regola 50/30/20: "altro" conta tra le necessità
const NEEDS_FIXED = new Set(['mutuo_affitto', 'bollette', 'assicurazioni', 'finanziamenti', 'ricariche', 'altro'])
const NEEDS_VARIABLE = new Set(['spesa_alimentari', 'trasporti', 'salute', 'casa', 'altro'])

export type IndicatorKey = 'savings' | 'fixed' | 'housing' | 'debt' | 'subscriptions' | 'needs' | 'wants'

export type Indicator = {
  key: IndicatorKey
  level: AreaLevel
  percent: number // sulle entrate medie
  amount: number // € al mese
}

export type GrowingCategory = { category: string; level: AreaLevel; percent: number }

export type CheckupResult =
  | { status: 'noData' }
  | {
      status: 'ok'
      months: number
      income: number
      expenses: number
      savings: number
      needs: number
      wants: number
      indicators: Indicator[]
      growing: GrowingCategory[]
    }

// Semaforo: [fino a verde, fino a giallo]; "higherIsBetter" per il risparmio
const THRESHOLDS: Record<IndicatorKey, { green: number; yellow: number; higherIsBetter?: boolean }> = {
  savings: { green: 10, yellow: 0, higherIsBetter: true },
  fixed: { green: 50, yellow: 65 },
  housing: { green: 35, yellow: 45 },
  debt: { green: 10, yellow: 20 },
  subscriptions: { green: 3, yellow: 6 },
  needs: { green: 50, yellow: 60 },
  wants: { green: 30, yellow: 40 },
}

function levelFor(key: IndicatorKey, percent: number): AreaLevel {
  const t = THRESHOLDS[key]
  if (t.higherIsBetter) return percent >= t.green ? 'green' : percent >= t.yellow ? 'yellow' : 'red'
  return percent <= t.green ? 'green' : percent <= t.yellow ? 'yellow' : 'red'
}

type MonthBucket = { income: number; fixed: Record<string, number>; variable: Record<string, number> }

const sum = (record: Record<string, number>, keys?: Set<string>) =>
  Object.entries(record).reduce((acc, [k, v]) => (keys && !keys.has(k) ? acc : acc + v), 0)

/** Ultimi 3 mesi completi prima di "today": [{year, month}] dal più vecchio. */
export function checkupMonths(today: Date) {
  const list: { year: number; month: number }[] = []
  for (let back = 3; back >= 1; back--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - back, 1))
    list.push({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 })
  }
  return list
}

export function computeCheckup(
  income: SpendlyIncome[],
  fixed: SpendlyFixedExpense[],
  variable: SpendlyVariableExpense[],
  payments: SpendlyFixedPayment[],
  today: Date
): CheckupResult {
  const months = checkupMonths(today)
  const paid = new Map(payments.map((p) => [paymentKey(p.expense_id, p.period), Number(p.amount)]))
  const buckets: MonthBucket[] = months.map(({ year, month }) => {
    const key = `${year}-${String(month).padStart(2, '0')}`
    const bucket: MonthBucket = { income: 0, fixed: {}, variable: {} }
    for (const item of income) if (item.income_date.slice(0, 7) === key) bucket.income += Number(item.amount)
    for (const item of fixed) {
      if (!fixedExpenseAppliesToMonth(item, year, month)) continue
      const amount = paid.get(paymentKey(item.id, periodOf(year, month))) ?? Number(item.amount)
      bucket.fixed[item.category] = (bucket.fixed[item.category] ?? 0) + amount
    }
    for (const item of variable) {
      if (item.expense_date.slice(0, 7) !== key) continue
      bucket.variable[item.category] = (bucket.variable[item.category] ?? 0) + Number(item.amount)
    }
    return bucket
  })

  // Solo i mesi con entrate registrate
  const used = buckets.filter((b) => b.income > 0)
  if (!used.length) return { status: 'noData' }
  const n = used.length
  const avg = (pick: (b: MonthBucket) => number) => used.reduce((acc, b) => acc + pick(b), 0) / n

  const inc = avg((b) => b.income)
  const fixedTot = avg((b) => sum(b.fixed))
  const variableTot = avg((b) => sum(b.variable))
  const expenses = fixedTot + variableTot
  const savings = inc - expenses
  const fixedCat = (cat: string) => avg((b) => b.fixed[cat] ?? 0)
  const housing = fixedCat('mutuo_affitto') + fixedCat('bollette')
  const debt = fixedCat('finanziamenti')
  const subscriptions = fixedCat('abbonamenti')
  const needs = avg((b) => sum(b.fixed, NEEDS_FIXED) + sum(b.variable, NEEDS_VARIABLE))
  const wants = expenses - needs
  const pct = (value: number) => Math.round((value / inc) * 1000) / 10

  const make = (key: IndicatorKey, amount: number): Indicator => ({ key, amount, percent: pct(amount), level: levelFor(key, pct(amount)) })
  const indicators = [
    make('savings', savings),
    make('fixed', fixedTot),
    make('housing', housing),
    make('debt', debt),
    make('subscriptions', subscriptions),
    make('needs', needs),
    make('wants', wants),
  ]

  // Categorie variabili in crescita: ultimo mese rispetto alla media dei 2 precedenti
  const growing: GrowingCategory[] = []
  const [first, second, last] = buckets
  for (const category of Object.keys(last.variable)) {
    const before = ((first.variable[category] ?? 0) + (second.variable[category] ?? 0)) / 2
    const now = last.variable[category]
    if (before <= 0 || now < 20) continue
    const percent = Math.round(((now - before) / before) * 100)
    if (percent >= 25) growing.push({ category, percent, level: percent >= 50 ? 'red' : 'yellow' })
  }
  growing.sort((a, b) => b.percent - a.percent)

  return { status: 'ok', months: n, income: inc, expenses, savings, needs, wants, indicators, growing: growing.slice(0, 3) }
}

// ---------------------------------------------------------------------------
// Piano d'azione: fino a 3 obiettivi, nell'ordine di importanza
// ---------------------------------------------------------------------------

export type GoalKey = 'emergencyFund' | 'noNewDebt' | 'saveAuto' | 'track30' | 'compareBills' | 'cutWants' | 'cancelSub' | 'writeGoal'
export type Goal = { key: GoalKey; amount?: number; monthly?: number }

export function pickGoals(answers: number[] | null, checkup: CheckupResult): Goal[] {
  const areas = answers ? areaScores(answers) : null
  const weak = (area: FinCheckArea) => (areas ? areas[FINCHECK_AREAS.indexOf(area)] <= 6 : false)
  const data = checkup.status === 'ok' ? checkup : null
  const ind = (key: IndicatorKey) => data?.indicators.find((i) => i.key === key)
  const above = (key: IndicatorKey, limit: number) => (ind(key)?.percent ?? 0) > limit

  const goals: Goal[] = []
  // Fondo imprevisti: domanda 6 sotto i 3 mesi
  if (answers && answers[5] <= 1) {
    const fund = data ? Math.round(data.expenses * 3) : undefined
    goals.push({ key: 'emergencyFund', amount: fund, monthly: fund ? Math.round(fund / 12) : undefined })
  }
  if (above('debt', 10) || weak('debt')) goals.push({ key: 'noNewDebt' })
  if ((data && (ind('savings')?.percent ?? 0) < 10) || weak('saving')) goals.push({ key: 'saveAuto', amount: data ? Math.round(data.income * 0.1) : undefined })
  if (weak('awareness')) goals.push({ key: 'track30' })
  if (above('housing', 35) || (answers && answers[11] <= 1)) goals.push({ key: 'compareBills' })
  if (above('wants', 30)) goals.push({ key: 'cutWants', amount: data ? Math.round(data.wants * 0.1) : undefined })
  if (above('subscriptions', 3) || (answers && answers[9] <= 1)) goals.push({ key: 'cancelSub' })
  if (weak('future')) goals.push({ key: 'writeGoal' })
  return goals.slice(0, 3)
}
