import { getTranslations } from 'next-intl/server'
import { ArrowRight, LayoutDashboard, Megaphone, Network, Wallet } from 'lucide-react'
import Link from '@/components/LocalizedLink'

export type QuickNavPage = 'dashboard' | 'community' | 'wallet' | 'listings'

const PAGES: { key: QuickNavPage; href: string; Icon: typeof Wallet }[] = [
  { key: 'dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { key: 'community', href: '/dashboard/rete', Icon: Network },
  { key: 'wallet', href: '/wallet', Icon: Wallet },
  { key: 'listings', href: '/marketplace/listings', Icon: Megaphone },
]

// In fondo alle pagine principali: collegamenti rapidi alle altre (tranne
// quella in cui ci si trova), per spostarsi senza tornare indietro.
export default async function QuickNav({ current }: { current: QuickNavPage }) {
  const t = await getTranslations('quickNav')
  const pages = PAGES.filter((page) => page.key !== current)
  return (
    <nav aria-label={t('title')} className="mt-10 border-t border-[var(--gold)]/25 pt-6">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">{t('title')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {pages.map(({ key, href, Icon }) => (
          <Link
            key={key}
            href={href}
            className="group flex items-center gap-3 rounded-2xl border border-[var(--gold)]/35 bg-[var(--ink)] px-4 py-3.5 text-white shadow-[0_10px_25px_rgba(23,23,23,0.15)] transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-bold">{t(key)}</span>
              <span className="block truncate text-xs text-white/60">{t(`${key}Hint`)}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-[var(--gold-bright)] transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </nav>
  )
}
