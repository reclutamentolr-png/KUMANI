import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import SpendlyNav from '@/components/spendly/SpendlyNav'
import { ArrowLeft, PiggyBank, Sparkles } from 'lucide-react'
import { hasActiveSpendlyAccess } from '@/lib/spendly-server'

// Autenticazione e gate abbonamento fatti una sola volta qui (non ripetuti
// in ognuna delle 5 pagine di Spendly), più header e nav condivisi — stesso
// principio di sicurezza "difesa in profondità" delle altre server action
// del tool: ogni azione ricontrolla comunque l'accesso per conto proprio.
export default async function SpendlyLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('spendly')
  const commonT = await getTranslations('common')
  const marketplaceT = await getTranslations('marketplace')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  const hasAccess = await hasActiveSpendlyAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${await getLocale()}/dashboard`)
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="bg-[var(--ink)] text-white border-b border-[var(--gold)]/25 shadow-lg sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-white/70 hover:text-[var(--gold-bright)] font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {commonT('backToDashboard')}
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <PiggyBank className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>

      <SpendlyNav />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Presentazione compatta, come negli altri strumenti */}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.2)] sm:p-7">
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-16 right-24 h-32 w-32 rounded-full border border-[var(--gold)]/15" />
          <div className="relative flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 sm:flex">
              <PiggyBank className="h-6 w-6 text-[var(--gold-bright)]" />
            </span>
            <div className="max-w-3xl">
              <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--gold)]/15 px-3 py-1 text-xs font-semibold text-[var(--gold-bright)]">
                <Sparkles className="h-3.5 w-3.5" /> {t('title')}
              </p>
              <h2 className="text-xl font-bold sm:text-2xl">{t('heroTitle')}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-white/70 sm:text-base">{marketplaceT('spendlyDescription')}</p>
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  )
}
