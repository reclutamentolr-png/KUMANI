import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import SharedGroupView from '@/components/spendlyShared/SharedGroupView'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { SITE_URL } from '@/lib/siteUrl'
import { forecastMonth, previousMonthsTotals, romeMonthToday } from '@/lib/spendlyForecast'
import { isMonthKey, monthRange, sharedBalances, type SharedExpense, type SharedGroup, type SharedRecurring, type SharedSettlement } from '@/lib/spendlyShared'

// Un gruppo delle spese condivise: mese per mese le spese, «chi deve quanto a
// chi» (su tutte le spese e i rimborsi), le spese fisse, la previsione del
// mese in corso, la mia quota nel mio Spendly e «Il resoconto dell'anno».
export const dynamic = 'force-dynamic'

const EXPENSE_SELECT = 'id, paid_by, amount, category, description, spent_on, split_between, recurring_id'

export default async function SharedGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ mese?: string }>
}) {
  const { locale, id } = await params
  const { mese } = await searchParams
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const t = await getTranslations('spendlyShared')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/spese-condivise/${id}`)}`)

  // Spese fisse arrivate (affitto del mese…): prima di leggere le spese
  await supabase.rpc('spendly_group_run_recurring', { p_group: id })
  const { data: detail } = await supabase.rpc('spendly_group_detail', { p_group: id })
  if (!detail) notFound()
  const group = detail as SharedGroup

  const today = romeMonthToday()
  const currentMonth = today.key.slice(0, 7)
  const month = isMonthKey(mese) ? mese : currentMonth
  const { from, to } = monthRange(month)
  const historyFrom = new Date(Date.UTC(today.year, today.month - 7, 1)).toISOString().slice(0, 10)

  const [{ data: monthExpenses }, { data: allExpenses }, { data: settlements }, { data: recurring }, { data: past }, { data: spendlyStatus }] = await Promise.all([
    fetchAllRows((a, b) =>
      supabase.from('spendly_group_expenses').select(EXPENSE_SELECT).eq('group_id', id).gte('spent_on', from).lte('spent_on', to).order('spent_on', { ascending: false }).order('id').range(a, b).returns<SharedExpense[]>()
    ),
    // Per il saldo bastano chi ha pagato, quanto e tra chi
    fetchAllRows(
      (a, b) =>
        supabase.from('spendly_group_expenses').select('id, paid_by, amount, split_between').eq('group_id', id).order('id').range(a, b).returns<Pick<SharedExpense, 'id' | 'paid_by' | 'amount' | 'split_between'>[]>(),
      50000
    ),
    supabase.from('spendly_group_settlements').select('id, from_member, to_member, amount, settled_on').eq('group_id', id).order('settled_on', { ascending: false }).returns<SharedSettlement[]>(),
    supabase.from('spendly_group_recurring').select('id, description, amount, category, paid_by, split_between, day_of_month, next_period, ends_on, spendly_fixed_id, every_months').eq('group_id', id).order('created_at').returns<SharedRecurring[]>(),
    // Previsione: spese non fisse dei 6 mesi prima del mese in corso
    month === currentMonth
      ? fetchAllRows((a, b) =>
          supabase.from('spendly_group_expenses').select('id, amount, spent_on').eq('group_id', id).is('recurring_id', null).gte('spent_on', historyFrom).lt('spent_on', `${currentMonth}-01`).order('id').range(a, b).returns<{ id: string; amount: number; spent_on: string }[]>()
        )
      : Promise.resolve({ data: [] as { id: string; amount: number; spent_on: string }[] }),
    supabase.rpc('spendly_group_spendly_status', { p_group: id }),
  ])

  const { balances, transfers } = sharedBalances(allExpenses, settlements ?? [])

  // Previsione del mese in corso: le spese fisse del mese contano per intero
  // (quelle non ancora arrivate si aggiungono), le altre col ritmo del mese
  let forecast = null
  if (month === currentMonth && (monthExpenses.length > 0 || (recurring ?? []).length > 0)) {
    const fixedSoFar = monthExpenses.filter((e) => e.recurring_id).reduce((s, e) => s + Number(e.amount), 0)
    const upcoming = (recurring ?? [])
      .filter((r) => r.next_period <= `${currentMonth}-01` && (!r.ends_on || r.ends_on >= `${currentMonth}-01`))
      .reduce((s, r) => s + Number(r.amount), 0)
    const variableSoFar = monthExpenses.filter((e) => !e.recurring_id).reduce((s, e) => s + Number(e.amount), 0)
    const history = previousMonthsTotals(past.map((p) => ({ date: p.spent_on, amount: p.amount })), today.year, today.month)
    forecast = forecastMonth({ fixedMonth: fixedSoFar + upcoming, fixedSoFar, variableSoFar, history, day: today.day, days: today.days })
  }

  return (
    <div className="min-h-screen bg-[var(--background)] pb-16">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/spese-condivise" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('backGroups')}
          </Link>
          <span className="flex items-center gap-2 font-semibold">
            <Users className="h-5 w-5 text-[var(--gold-bright)]" /> {t('title')}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <SharedGroupView
          group={group}
          month={month}
          currentMonth={currentMonth}
          today={today.key}
          expenses={monthExpenses}
          balances={Object.fromEntries(balances)}
          transfers={transfers}
          settlements={settlements ?? []}
          recurring={recurring ?? []}
          forecast={forecast}
          spendlyStatus={(spendlyStatus as { status: string; shares?: number; imported?: number } | null) ?? { status: 'no_access' }}
          inviteUrl={`${SITE_URL}${locale === 'it' ? '' : `/${locale}`}/spese-condivise?codice=${group.invite_code}`}
        />
      </main>
    </div>
  )
}
