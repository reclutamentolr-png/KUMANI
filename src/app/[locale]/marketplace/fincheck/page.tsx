import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, Gauge, Sparkles } from 'lucide-react'
import FinCheckApp, { type FinCheckResultRow } from '@/components/fincheck/FinCheckApp'
import { hasActiveSpendlyAccess } from '@/lib/spendly-server'
import { checkupMonths, computeCheckup, type CheckupResult } from '@/lib/fincheck'
import type { SpendlyFixedExpense, SpendlyFixedPayment, SpendlyIncome, SpendlyVariableExpense } from '@/lib/spendly'

// FinCheck: test di educazione finanziaria (gratuito) e check-up del
// bilancio con i dati di Spendly (per chi ha Spendly nel proprio piano).
export default async function FinCheckPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('fincheck')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  // Servizio gratuito: chiuso solo se lo Staff lo spegne (Admin → Marketplace)
  const { data: access } = await supabase.rpc('can_use_tool', { p_tool: 'fincheck' }).maybeSingle<{ allowed: boolean; known: boolean }>()
  if (access?.known && !access.allowed) redirect(`/${locale}/dashboard`)

  const [{ data: results }, hasSpendly] = await Promise.all([
    supabase
      .from('fincheck_results')
      .select('id, answers, area_scores, total, ku_awarded, goals_done, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(12)
      .returns<FinCheckResultRow[]>(),
    hasActiveSpendlyAccess(supabase, user.id),
  ])

  // Check-up: solo con Spendly nel piano, sugli ultimi 3 mesi completi
  let checkup: CheckupResult | null = null
  if (hasSpendly) {
    const today = new Date()
    const months = checkupMonths(today)
    const from = `${months[0].year}-${String(months[0].month).padStart(2, '0')}-01`
    const last = months[months.length - 1]
    const to = new Date(Date.UTC(last.year, last.month, 0)).toISOString().slice(0, 10)
    const [{ data: income }, { data: fixed }, { data: variable }, { data: payments }] = await Promise.all([
      supabase
        .from('spendly_income')
        .select('id, description, amount, income_type, category, income_date, notes')
        .eq('user_id', user.id)
        .gte('income_date', from)
        .lte('income_date', to)
        .returns<SpendlyIncome[]>(),
      supabase
        .from('spendly_fixed_expenses')
        .select('id, description, amount, frequency, category, start_date, end_date, billing_day, notes')
        .eq('user_id', user.id)
        .returns<SpendlyFixedExpense[]>(),
      supabase
        .from('spendly_variable_expenses')
        .select('id, description, amount, expense_date, category, notes')
        .eq('user_id', user.id)
        .gte('expense_date', from)
        .lte('expense_date', to)
        .returns<SpendlyVariableExpense[]>(),
      supabase
        .from('spendly_fixed_payments')
        .select('expense_id, period, amount, paid_on')
        .eq('user_id', user.id)
        .gte('period', from)
        .lte('period', to)
        .returns<SpendlyFixedPayment[]>(),
    ])
    checkup = computeCheckup(income ?? [], fixed ?? [], variable ?? [], payments ?? [], today)
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">FinCheck</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <Sparkles className="h-4 w-4" /> {t('eyebrow')}
            </div>
            <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">FinCheck</h1>
            <p className="text-base text-white/70 sm:text-lg">{t('subtitle')}</p>
          </div>
        </div>

        <FinCheckApp results={results ?? []} checkup={checkup} hasSpendly={hasSpendly} locale={locale} />

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-5 text-[var(--muted)]">{t('disclaimer')}</p>
      </main>
    </div>
  )
}
