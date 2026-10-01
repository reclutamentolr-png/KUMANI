import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, HeartHandshake } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getPublicDonationSummary } from '@/lib/donationsPublic'
import { euroFormat } from '@/lib/donationTypes'

// Dashboard: quanto ha donato finora la community e a chi, con l'invito a
// donare i propri Punti Community. Nascosta senza associazione attiva.
export default async function DashboardDonations() {
  const summary = await getPublicDonationSummary()
  const active = summary?.active
  if (!summary || !active) return null
  const t = await getTranslations('donations')
  const locale = await getLocale()

  return (
    <Link
      href="/donazioni"
      className="group flex flex-col gap-4 rounded-2xl border border-[var(--gold)]/45 bg-gradient-to-r from-[var(--gold-pale)] via-white to-[var(--gold-pale)] p-5 shadow-[0_10px_30px_rgba(199,154,59,0.15)] transition-all hover:-translate-y-0.5 hover:border-[var(--gold)] sm:flex-row sm:items-center"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
        <HeartHandshake className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-extrabold text-[var(--ink)]">{t('dashboardTitle', { amount: euroFormat(locale, summary.accrued_cents) })}</span>
        <span className="block text-sm text-[var(--muted)]">{t('dashboardText', { association: active.name })}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--gold-bright)]">
        {t('learnMore')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  )
}
