import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import VariableExpenseManager from '@/components/spendly/VariableExpenseManager'
import type { SpendlyVariableExpense } from '@/lib/spendly'
import { currentYear } from '@/lib/spendly'

export default async function SpendlyVariableExpensesPage({
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

  const { data: variableExpenses } = await supabase
    .from('spendly_variable_expenses')
    .select('id, description, amount, expense_date, category, notes')
    .eq('user_id', user.id)
    .gte('expense_date', `${year}-01-01`)
    .lte('expense_date', `${year}-12-31`)
    .order('expense_date', { ascending: false })
    .returns<SpendlyVariableExpense[]>()

  return <VariableExpenseManager items={variableExpenses || []} year={year} />
}
