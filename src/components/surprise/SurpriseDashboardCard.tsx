import { getTranslations } from 'next-intl/server'
import { ArrowRight, Gift } from 'lucide-react'
import Link from '@/components/LocalizedLink'

// Dashboard: «Regala un'esperienza» (KUMANI Sorpresa). Nei giorni prima di
// San Valentino e di Natale il testo parla della festa.
function occasion(now = new Date()): 'valentine' | 'christmas' | null {
  const m = now.getMonth() + 1
  const d = now.getDate()
  if (m === 2 && d <= 14) return 'valentine'
  if (m === 12 && d <= 24) return 'christmas'
  return null
}

export default async function SurpriseDashboardCard() {
  const t = await getTranslations('surprise')
  const when = occasion()
  return (
    <Link
      href="/sorprese"
      className="group flex items-center gap-4 rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-r from-[var(--ink)] via-[#2b2110] to-[#3b0d1f] p-4 text-white shadow-sm transition hover:brightness-110 sm:p-5"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] shadow">
        <Gift className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold sm:text-lg">{t('dashboardTitle')}</span>
        <span className="block text-sm text-white/75">{when ? t(`occasion_${when}`) : t('dashboardText')}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-[var(--gold-bright)] group-hover:bg-white/15 sm:inline-flex">
        {t('dashboardCta')} <ArrowRight className="h-4 w-4" />
      </span>
      <ArrowRight className="h-5 w-5 shrink-0 text-[var(--gold-bright)] sm:hidden" />
    </Link>
  )
}
