import { createClient } from '@/lib/supabase/server'
import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import IncomeManager from '@/components/spendly/IncomeManager'
import type { SpendlyIncome } from '@/lib/spendly'
import { currentYear } from '@/lib/spendly'

export default async function SpendlyIncomePage({
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

  const { data: income } = await supabase
    .from('spendly_income')
    .select('id, description, amount, income_type, category, income_date, notes')
    .eq('user_id', user.id)
    .gte('income_date', `${year}-01-01`)
    .lte('income_date', `${year}-12-31`)
    .order('income_date', { ascending: false })
    .returns<SpendlyIncome[]>()

  return <IncomeManager items={income || []} year={year} />
}
