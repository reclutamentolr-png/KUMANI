import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import SpendlyDashboard from '@/components/spendly/SpendlyDashboard'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, HeartPulse } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import type { SpendlyIncome, SpendlyFixedExpense, SpendlyFixedPayment, SpendlyVariableExpense } from '@/lib/spendly'
import { currentYear, monthNames } from '@/lib/spendly'
import { personalForecast, previousMonthsTotals, romeMonthToday } from '@/lib/spendlyForecast'
import ForecastCard from '@/components/spendly/ForecastCard'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { settleAutoPayments } from '@/lib/spendly-server'
import { toolMetadata } from '@/lib/toolMetadata'

// Nome del servizio nella scheda del browser
export const generateMetadata = toolMetadata('spendly')

export default async function SpendlyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const { year: yearParam } = await searchParams
  const year = yearParam ? parseInt(yearParam, 10) : currentYear()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  // Addebito automatico: prima registra le scadenze arrivate
  await settleAutoPayments(supabase, user.id)
  const [{ data: income }, { data: fixedExpenses }, { data: variableExpenses }, { data: payments }] = await Promise.all([
    fetchAllRows((from, to) =>
      supabase
        .from('spendly_income')
        .select('id, description, amount, income_type, category, income_date, notes')
        .eq('user_id', user.id)
        .gte('income_date', `${year}-01-01`)
        .lte('income_date', `${year}-12-31`)
        .order('id')
        .range(from, to)
        .returns<SpendlyIncome[]>()
    ),
    // Nessun filtro per anno: fixedExpenseAppliesToMonth (in computeMonthlyTotals)
    // decide da sola, mese per mese, se una spesa fissa (con il suo
    // start_date/end_date) ricade nell'anno richiesto — anche quando la
    // ricorrenza attraversa più anni.
    supabase
      .from('spendly_fixed_expenses')
      .select('id, description, amount, frequency, category, start_date, end_date, billing_day, notes')
      .eq('user_id', user.id)
      .returns<SpendlyFixedExpense[]>(),
    fetchAllRows((from, to) =>
      supabase
        .from('spendly_variable_expenses')
        .select('id, description, amount, expense_date, category, notes')
        .eq('user_id', user.id)
        .gte('expense_date', `${year}-01-01`)
        .lte('expense_date', `${year}-12-31`)
        .order('id')
        .range(from, to)
        .returns<SpendlyVariableExpense[]>()
    ),
    fetchAllRows((from, to) =>
      supabase
        .from('spendly_fixed_payments')
        .select('expense_id, period, amount, paid_on')
        .eq('user_id', user.id)
        .gte('period', `${year}-01-01`)
        .lte('period', `${year}-12-01`)
        .order('id')
        .range(from, to)
        .returns<SpendlyFixedPayment[]>()
    ),
  ])

  // Previsione di fine mese: solo per l'anno in corso, dal mese di oggi
  const today = romeMonthToday()
  let forecast = null
  let incomeMonth = 0
  if (year === today.year) {
    const monthKey = today.key.slice(0, 7)
    const from = new Date(Date.UTC(today.year, today.month - 7, 1)).toISOString().slice(0, 10)
    const { data: past } = await fetchAllRows((from_, to) =>
      supabase
        .from('spendly_variable_expenses')
        .select('id, amount, expense_date')
        .eq('user_id', user.id)
        .gte('expense_date', from)
        .lt('expense_date', `${monthKey}-01`)
        .order('id')
        .range(from_, to)
        .returns<{ id: string; amount: number; expense_date: string }[]>()
    )
    const variableThisMonth = (variableExpenses ?? []).filter((v) => v.expense_date.startsWith(monthKey)).reduce((s, v) => s + Number(v.amount), 0)
    incomeMonth = (income ?? []).filter((i) => i.income_date.startsWith(monthKey)).reduce((s, i) => s + Number(i.amount), 0)
    const history = previousMonthsTotals(past.map((p) => ({ date: p.expense_date, amount: p.amount })), today.year, today.month)
    const anyData = variableThisMonth > 0 || history.some((h) => h > 0) || (fixedExpenses ?? []).length > 0
    if (anyData) forecast = personalForecast({ fixedExpenses: fixedExpenses ?? [], payments: payments ?? [], variableThisMonth, history, today })
  }

  const te = await getTranslations('ecosystem')
  return (
    <>
    {forecast && (
      <div className="mx-auto mb-6 max-w-7xl px-4 sm:px-6 lg:px-8">
        <ForecastCard forecast={forecast} monthName={monthNames(await getLocale())[today.month - 1]} income={incomeMonth} />
      </div>
    )}
    <SpendlyDashboard
      income={income || []}
      fixedExpenses={fixedExpenses || []}
      variableExpenses={variableExpenses || []}
      payments={payments || []}
      year={year}
    />
    {/* Ecosistema: il check-up dei conti di Fincheck usa i dati di Spendly */}
    <div className="mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
      <Link
        href="/app/fincheck"
        className="group flex items-center gap-4 rounded-2xl border border-[var(--gold)]/40 bg-white p-5 shadow-sm transition hover:border-[var(--gold)]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)] text-[var(--gold)]">
          <HeartPulse className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-[var(--ink)]">{te('spendlyFincheckTitle')}</span>
          <span className="block text-sm text-[var(--muted)]">{te('spendlyFincheckText')}</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-[var(--gold)] transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
    </>
  )
}
