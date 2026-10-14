import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import SpendlyCapacity from '@/components/spendly/SpendlyCapacity'
import type { SpendlyIncome, SpendlyFixedExpense, SpendlyFixedPayment, SpendlyVariableExpense } from '@/lib/spendly'
import { currentYear } from '@/lib/spendly'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { settleAutoPayments } from '@/lib/spendly-server'

export default async function SpendlyCapacityPage({
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
    // Nessun filtro per anno, vedi commento in marketplace/spendly/page.tsx.
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

  return (
    <SpendlyCapacity
      income={income || []}
      fixedExpenses={fixedExpenses || []}
      variableExpenses={variableExpenses || []}
      payments={payments || []}
      year={year}
    />
  )
}
