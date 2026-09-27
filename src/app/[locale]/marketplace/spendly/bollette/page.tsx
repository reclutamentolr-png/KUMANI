import { getLocale } from 'next-intl/server'
import { redirect } from 'next/navigation'
import BillsManager from '@/components/spendly/BillsManager'
import { createClient } from '@/lib/supabase/server'
import { todayKey } from '@/lib/agenda'
import type { SpendlyFixedExpense, SpendlyFixedPayment } from '@/lib/spendly'

// Spendly → Bollette: scadenze che si ripetono con importo variabile (luce,
// gas, acqua, telefono…). Nel database sono spese fisse con categoria
// "bollette": qui cambia solo il modo di inserirle e vederle.
export default async function SpendlyBillsPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: openNew } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  const { data: bills } = await supabase
    .from('spendly_fixed_expenses')
    .select('id, description, amount, frequency, category, start_date, end_date, billing_day, notes')
    .eq('user_id', user.id)
    .eq('category', 'bollette')
    .order('description')
    .returns<SpendlyFixedExpense[]>()

  const ids = (bills ?? []).map((b) => b.id)
  const { data: payments } = ids.length
    ? await supabase
        .from('spendly_fixed_payments')
        .select('expense_id, period, amount, paid_on')
        .eq('user_id', user.id)
        .in('expense_id', ids)
        .order('period', { ascending: false })
        .limit(500)
        .returns<SpendlyFixedPayment[]>()
    : { data: [] as SpendlyFixedPayment[] }

  return (
    <BillsManager
      bills={(bills ?? []).map((b) => ({ ...b, amount: Number(b.amount) }))}
      payments={(payments ?? []).map((p) => ({ ...p, amount: Number(p.amount) }))}
      today={todayKey()}
      autoOpen={openNew === '1'}
    />
  )
}
