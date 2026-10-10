import { getTranslations } from 'next-intl/server'
import { ArrowRight, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import type { DashboardNetworkData } from '@/lib/dashboardNetworkData'
import { rankProgress } from '@/lib/ranks'
import RankRequirements, { rankMissingText } from '@/components/RankRequirements'

// Riepilogo della rete (pagina Community): tutta la scheda porta alla
// pagina Rete con stella, KUMANI e qualifiche.
export default async function NetworkSummaryCard({ network }: { network: DashboardNetworkData }) {
  const t = await getTranslations('dashboard')
  // Qualifiche: attivazioni pagate delle persone invitate + KU Points guadagnati
  const { activeKumaniCount, pendingKumaniCount, receivedKumaniCount, currentRank, ranks, networkPointsEarned, networkActivations, achievedKeys, networkPendingActivations, networkPendingPoints } = network
  const nextRank = ranks.find((rank) => !achievedKeys.includes(rank.key)) || null
  const progress = nextRank ? rankProgress(nextRank, networkActivations, networkPointsEarned) : 100
  const missing = nextRank ? await rankMissingText(nextRank, networkActivations, networkPointsEarned) : null

  return (
    <Link
      href="/dashboard/rete"
      className="group block overflow-hidden rounded-2xl border border-[var(--gold)]/45 bg-gradient-to-br from-[#26221c] to-[var(--ink)] p-5 text-white shadow-[0_18px_40px_rgba(23,23,23,0.25)] transition-all hover:-translate-y-0.5 hover:border-[var(--gold)] hover:shadow-[0_22px_50px_rgba(199,154,59,0.25)] sm:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] shadow">
          <Users className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-white sm:text-xl">{t('yourNetwork')}</h2>
          <p className="text-xs text-white/60">{t('communityCardSubtitle')}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
          <p className="text-4xl font-extrabold leading-none text-[var(--gold-bright)]">{activeKumaniCount}</p>
          <p className="mt-1.5 text-xs font-medium text-white/70">{t('activeKumaniLabel', { n: activeKumaniCount })}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
          <p className="text-4xl font-extrabold leading-none text-white">{pendingKumaniCount}</p>
          <p className="mt-1.5 text-xs font-medium text-white/70">{t('pendingKumaniLabel')}</p>
        </div>
        <div className="rounded-xl border border-sky-300/25 bg-sky-400/[0.08] px-4 py-3">
          <p className="text-4xl font-extrabold leading-none text-sky-300">{receivedKumaniCount}</p>
          <p className="mt-1.5 text-xs font-medium text-white/70">{t('receivedKumaniLabel')}</p>
        </div>
      </div>

      {(currentRank || nextRank) && (
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-white">{nextRank ? t(nextRank.labelKey) : currentRank ? t(currentRank.labelKey) : ''}</span>
            {nextRank && (
              <RankRequirements
                rank={nextRank}
                activations={networkActivations}
                points={networkPointsEarned}
                pendingActivations={networkPendingActivations}
                pendingPoints={networkPendingPoints}
                className="text-right text-xs text-white/60"
              />
            )}
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" style={{ width: `${progress}%` }} />
          </div>
          {missing && <p className="mt-2 text-xs font-semibold text-[var(--gold-bright)]">{missing}</p>}
        </div>
      )}

      <span className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] shadow transition group-hover:brightness-110">
        {t('openCommunityCta')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  )
}
