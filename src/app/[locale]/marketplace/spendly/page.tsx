import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import SpendlyDashboard from '@/components/spendly/SpendlyDashboard'
import type { SpendlyIncome, SpendlyFixedExpense, SpendlyFixedPayment, SpendlyVariableExpense } from '@/lib/spendly'
import { currentYear } from '@/lib/spendly'

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

  const [{ data: income }, { data: fixedExpenses }, { data: variableExpenses }, { data: payments }] = await Promise.all([
    supabase
      .from('spendly_income')
      .select('id, description, amount, income_type, category, income_date, notes')
      .eq('user_id', user.id)
      .gte('income_date', `${year}-01-01`)
      .lte('income_date', `${year}-12-31`)
      .returns<SpendlyIncome[]>(),
    // Nessun filtro per anno: fixedExpenseAppliesToMonth (in computeMonthlyTotals)
    // decide da sola, mese per mese, se una spesa fissa (con il suo
    // start_date/end_date) ricade nell'anno richiesto — anche quando la
    // ricorrenza attraversa più anni.
    supabase
      .from('spendly_fixed_expenses')
      .select('id, description, amount, frequency, category, start_date, end_date, billing_day, notes')
      .eq('user_id', user.id)
      .returns<SpendlyFixedExpense[]>(),
    supabase
      .from('spendly_variable_expenses')
      .select('id, description, amount, expense_date, category, notes')
      .eq('user_id', user.id)
      .gte('expense_date', `${year}-01-01`)
      .lte('expense_date', `${year}-12-31`)
      .returns<SpendlyVariableExpense[]>(),
    supabase
      .from('spendly_fixed_payments')
      .select('expense_id, period, amount, paid_on')
      .eq('user_id', user.id)
      .gte('period', `${year}-01-01`)
      .lte('period', `${year}-12-01`)
      .returns<SpendlyFixedPayment[]>(),
  ])

  return (
    <SpendlyDashboard
      income={income || []}
      fixedExpenses={fixedExpenses || []}
      variableExpenses={variableExpenses || []}
      payments={payments || []}
      year={year}
    />
  )
}
