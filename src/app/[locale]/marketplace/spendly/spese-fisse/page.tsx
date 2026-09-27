import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FixedExpenseManager from '@/components/spendly/FixedExpenseManager'
import type { SpendlyFixedExpense, SpendlyFixedPayment } from '@/lib/spendly'

export default async function SpendlyFixedExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; new?: string }>
}) {
  const { year: yearParam, new: openNew } = await searchParams
  const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Mostra le spese fisse ancora "attive" durante l'anno selezionato: sono
  // iniziate entro il 31/12 dell'anno e non sono ancora terminate prima del
  // 1/1 dello stesso anno (end_date nullo = nessuna scadenza).
  const [{ data: fixedExpenses }, { data: payments }] = await Promise.all([
    supabase
      .from('spendly_fixed_expenses')
      .select('id, description, amount, frequency, category, start_date, end_date, billing_day, notes')
      .eq('user_id', user.id)
      // Le bollette hanno la loro scheda (Spendly → Bollette)
      .neq('category', 'bollette')
      .lte('start_date', `${year}-12-31`)
      .or(`end_date.is.null,end_date.gte.${year}-01-01`)
      .order('start_date', { ascending: false })
      .returns<SpendlyFixedExpense[]>(),
    // Scadenze già pagate nell'anno (stato "Pagata" e importo reale)
    supabase
      .from('spendly_fixed_payments')
      .select('expense_id, period, amount, paid_on')
      .eq('user_id', user.id)
      .gte('period', `${year}-01-01`)
      .lte('period', `${year}-12-01`)
      .returns<SpendlyFixedPayment[]>(),
  ])

  return (
    <FixedExpenseManager
      items={(fixedExpenses || []).map((e) => ({ ...e, amount: Number(e.amount) }))}
      payments={(payments || []).map((p) => ({ ...p, amount: Number(p.amount) }))}
      year={year}
      autoOpen={openNew === '1'}
    />
  )
}
