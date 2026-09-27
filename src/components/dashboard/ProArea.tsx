import { getTranslations } from 'next-intl/server'
import { ArrowRight, Briefcase, Crown, HandPlatter, Hourglass, Smartphone } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import type { MarketplaceTool } from '@/lib/marketplaceTools'
import type { ProAreaStats } from '@/lib/proAreaStats'

// Area Professionisti: in cima alla dashboard per chi ha il piano Pro (anche
// in prova). Gli strumenti Pro (decisi dall'admin) con un dato della propria
// attività ciascuno, più lo stato del piano.
export default async function ProArea({
  tools,
  stats,
  trial,
  renewsOn,
}: {
  tools: MarketplaceTool[]
  stats: ProAreaStats
  trial: { daysLeft: number; totalDays: number; endsOn: string; price: number } | null
  renewsOn: string | null
}) {
  const t = await getTranslations('proArea')

  const statLine = (toolName: string): string | null => {
    switch (toolName) {
      case 'fidelity':
        return stats.fidelity ? t('statFidelity', { members: stats.fidelity.members, stamps: stats.fidelity.stamps30d }) : null
      case 'preventivi':
        return stats.preventivi ? t('statQuotes', { count: stats.preventivi.thisMonth }) : null
      case 'digital-receipt':
        return stats['digital-receipt'] ? t('statReceipts', { count: stats['digital-receipt'].pending }) : null
      case 'qr-code-pro':
        return stats['qr-code-pro'] ? t('statQr', { count: stats['qr-code-pro'].scans }) : null
      case 'offermaker':
        return stats.offermaker ? t('statOffers', { count: stats.offermaker.clicks }) : null
      case 'menu':
        return stats.menu ? t('statMenu', { count: stats.menu.items, soldOut: stats.menu.soldOut }) : null
      default:
        return null
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--gold)]/40 bg-[var(--ink)] p-5 text-white shadow-[0_10px_30px_rgba(23,23,23,0.2)] sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
            <Briefcase className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              {t('title')}
              <span className="rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-[var(--ink)]">
                PRO
              </span>
            </h2>
            <p className="text-sm text-white/60">{t('subtitle')}</p>
          </div>
        </div>

        {!trial && (
          <div className="text-right text-xs">
            <p className="font-semibold text-emerald-300">{t('planActive')}</p>
            {renewsOn && <p className="mt-0.5 text-white/60">{t('renewsOn', { date: renewsOn })}</p>}
            <Link href="/billing" className="mt-1 inline-block text-white/70 underline-offset-2 hover:text-white hover:underline">
              {t('manageSubscription')}
            </Link>
          </div>
        )}
      </div>

      {trial && (
        <div className="mb-5 rounded-xl border border-[var(--gold)]/60 bg-gradient-to-r from-[var(--gold)]/25 to-[var(--gold-bright)]/10 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Hourglass className={`mt-0.5 h-6 w-6 shrink-0 ${trial.daysLeft <= 3 ? 'animate-pulse text-amber-300' : 'text-[var(--gold-bright)]'}`} />
              <div>
                <p className="text-lg font-bold text-white">{t('trialBannerTitle', { days: trial.daysLeft })}</p>
                <p className="mt-0.5 text-sm text-white/75">{t('trialBannerBody', { date: trial.endsOn })}</p>
              </div>
            </div>
            <Link
              href="/pro"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
            >
              <Crown className="h-5 w-5" /> {t('trialBannerCta', { price: trial.price })}
            </Link>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]"
              style={{ width: `${Math.max(4, Math.min(100, (trial.daysLeft / Math.max(trial.totalDays, 1)) * 100))}%` }}
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => {
          const Icon = marketplaceIconMap[tool.iconName] || Smartphone
          const stat = statLine(tool.toolName)
          return (
            <Link
              key={tool.toolName}
              href={`${tool.href}?from=dashboard`}
              className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-[var(--gold)]/60 hover:bg-white/[0.07]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
                <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2 text-sm font-bold">
                  <span className="truncate">{tool.title}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--gold-bright)] transition-transform group-hover:translate-x-0.5" />
                </p>
                {stat ? (
                  <p className="mt-1 text-xs font-medium text-[var(--gold-bright)]">{stat}</p>
                ) : (
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/60">{tool.description}</p>
                )}
              </div>
            </Link>
          )
        })}
        {/* Convivio: offerte di gruppo e richieste dei capocordata */}
        <Link
          href="/marketplace/convivio/fornitore"
          className="group flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4 transition-colors hover:border-[var(--gold)]/60 hover:bg-white/[0.07]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
            <HandPlatter className="h-4.5 w-4.5" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center justify-between gap-2 text-sm font-bold">
              <span className="truncate">{t('convivioTitle')}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[var(--gold-bright)] transition-transform group-hover:translate-x-0.5" />
            </p>
            <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/60">{t('convivioHint')}</p>
          </div>
        </Link>
      </div>
    </section>
  )
}
