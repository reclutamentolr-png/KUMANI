import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import SpendlyNav from '@/components/spendly/SpendlyNav'
import { ArrowLeft, PiggyBank } from 'lucide-react'
import { hasActiveSpendlyAccess } from '@/lib/spendly-server'

// Autenticazione e gate abbonamento fatti una sola volta qui (non ripetuti
// in ognuna delle 5 pagine di Spendly), più header e nav condivisi — stesso
// principio di sicurezza "difesa in profondità" delle altre server action
// del tool: ogni azione ricontrolla comunque l'accesso per conto proprio.
export default async function SpendlyLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('spendly')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  const hasAccess = await hasActiveSpendlyAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${await getLocale()}/marketplace`)
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="bg-[var(--ink)] border-b border-[var(--gold)]/25 sticky top-0 z-10">
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

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
