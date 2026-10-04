import { getTranslations } from 'next-intl/server'
import { Mail } from 'lucide-react'
import Link from '@/components/LocalizedLink'

// Avviso in cima alla dashboard: messaggi non letti arrivati dal modulo
// "Scrivimi" della propria Landing Page.
export default async function LandingMessagesAlert({ count }: { count: number }) {
  const t = await getTranslations('landingEditor')
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl border-2 border-[var(--gold)] bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)]">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)]">
        <Mail className="h-6 w-6 text-[var(--ink)]" />
        <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white ring-2 ring-[var(--ink)]">
          {count > 99 ? '99+' : count}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold text-[var(--gold-bright)]">{t('alertTitle', { count })}</p>
        <p className="mt-1 text-sm text-white/75">{t('alertText')}</p>
      </div>
      <Link
        href="/marketplace/landing-page?tab=messages"
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] transition hover:brightness-110"
      >
        {t('alertCta')}
      </Link>
    </div>
  )
}
