import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import UnreadMessagesBadge from '@/components/UnreadMessagesBadge'
import KumanoDelGiornoPreview from './KumanoDelGiornoPreview'
import CategoryToolsAccordion from './CategoryToolsAccordion'
import InfoPopover from '@/components/InfoPopover'
import type { MarketplaceTool } from '@/lib/marketplaceTools'
import { MARKETPLACE_CATEGORIES, type MarketplaceCategory } from '@/lib/marketplaceTools'
import type { DashboardNetworkData } from '@/lib/dashboardNetworkData'
import { RANKS } from '@/lib/ranks'
import { Users, ArrowRight, Star, CheckCircle2, Crown, Hourglass } from 'lucide-react'
import CopyButton from '@/components/CopyButton'
import VoucherActivationButton from '@/components/VoucherActivationButton'
import KuBadge from '@/components/ku/KuBadge'
import AffinityBadge from './AffinityBadge'

// Tipo 2: the Marketplace-first layout. Tools are the main focus; the
// network (KUMI, matrix, KUMANI lists, qualifications) is reduced to one
// compact summary card that links out to the dedicated /dashboard/rete
// page instead of taking over the page — see the two mockup concepts
// discussed with the client before building this.
export default async function DashboardTipo2({
  profile,
  shareUrl,
  unreadMessagesCount,
  visibleTools,
  lockedToolNames,
  proToolNames,
  favoriteToolNames,
  proTrialDaysLeft = null,
  agenda = null,
  network,
}: {
  profile: any
  shareUrl: string
  unreadMessagesCount: number
  visibleTools: MarketplaceTool[]
  lockedToolNames: string[]
  proToolNames: string[]
  favoriteToolNames: string[]
  // Prova Pro in corso: il riquadro dell'abbonamento propone Pro come
  // scelta principale e il Base come alternativa.
  proTrialDaysLeft?: number | null
  // Riquadro "I prossimi giorni" (agenda unica), già pronto dal server
  agenda?: React.ReactNode
  network: DashboardNetworkData
}) {
  const t = await getTranslations('dashboard')
  const marketplaceT = await getTranslations('marketplace')
  const pt = await getTranslations('proArea')

  const { activeKumani, pendingKumani, currentRank, directSponsorCount } = network
  const nextRank = RANKS.find((rank) => directSponsorCount < rank.threshold) || null
  const rankProgress = nextRank ? Math.min((directSponsorCount / nextRank.threshold) * 100, 100) : 100

  const categoryLabels: Record<MarketplaceCategory, string> = {
    marketing: marketplaceT('categoryMarketing'),
    security: marketplaceT('categorySecurity'),
    personal: marketplaceT('categoryPersonal'),
    wellness: marketplaceT('categoryWellness'),
    lavoro: marketplaceT('categoryLavoro'),
    affinity: marketplaceT('categoryAffinity'),
    svago: marketplaceT('categorySvago'),
    community: marketplaceT('categoryCommunity'),
  }
  // Community: Bacheca, Kumano del Giorno e Kordata (sezioni della
  // piattaforma, non strumenti del Marketplace: niente stella preferiti).
  const communityItems = [
    { toolName: 'community-listings', href: '/marketplace/listings', iconName: 'Tag', title: marketplaceT('listings'), description: marketplaceT('listingsDescription') },
    { toolName: 'community-spotlight', href: '/marketplace/spotlight', iconName: 'Star', title: marketplaceT('kumanoDelGiorno'), description: marketplaceT('kumanoDelGiornoDescription') },
    { toolName: 'community-convivio', href: '/marketplace/convivio', iconName: 'HandPlatter', title: marketplaceT('convivio'), description: marketplaceT('convivioDescription') },
    { toolName: 'community-events', href: '/events', iconName: 'PartyPopper', title: marketplaceT('events'), description: marketplaceT('eventsDescription') },
    { toolName: 'community-timebank', href: '/marketplace/timebank', iconName: 'Hourglass', title: marketplaceT('timebank'), description: marketplaceT('timebankDescription') },
  ].map((item) => ({ ...item, gradient: 'bg-[var(--ink)]', color: 'gold', category: 'community' })) as unknown as MarketplaceTool[]

  const toolsByCategory = MARKETPLACE_CATEGORIES.map((category) => ({
    category,
    tools: category === 'community' ? communityItems : visibleTools.filter((tool) => tool.category === category),
  })).filter((group) => group.tools.length > 0)

  return (
    <>
      {/* Scorciatoia ai servizi preferiti */}
      <Link
        href="/marketplace/preferiti?from=dashboard"
        className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/35 bg-[var(--gold-pale)] px-5 py-4 shadow-sm transition-colors hover:border-[var(--gold)]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-white">
            <Star className="h-4.5 w-4.5" fill="currentColor" />
          </div>
          <span className="font-semibold text-[var(--ink)]">{t('goToFavorites')}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-[var(--ink)] transition-transform group-hover:translate-x-1" />
      </Link>

      {/* Novità di Affinity Amicizie (solo per chi partecipa) */}
      <AffinityBadge />

      {agenda}

      {/* Striscia di stato compatta */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] px-5 py-4 shadow-sm">
          <p className="text-xs text-[var(--muted)] font-medium mb-1.5">{t('pointsCardLabel')}</p>
          <span className="text-2xl font-bold text-[var(--ink)]">{profile?.daily_points || 0}</span>
          <span className="ml-1.5 text-sm font-semibold text-[var(--gold)]">{t('kuPointsLabel')}</span>
          <div className="mt-1.5">
            <KuBadge earnedTotal={profile?.ku_earned_total || 0} />
          </div>
          <div className="mt-1.5">
            <InfoPopover label={t('howPointsWorkLabel')}>{t('howPointsWorkBody')}</InfoPopover>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] px-5 py-4 shadow-sm">
          <p className="text-xs text-[var(--muted)] font-medium mb-1.5">{t('subscriptionStatus')}</p>
          {profile?.subscription_status === 'active' ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-700">{t('subscriptionActive')}</p>
                {profile?.subscription_expires_at && (
                  <p className="text-xs text-emerald-600">
                    {t('expiresAt')}: {new Date(profile.subscription_expires_at).toLocaleDateString('it-IT')}
                  </p>
                )}
              </div>
            </div>
          ) : proTrialDaysLeft !== null ? (
            <>
              <div className="flex items-center gap-2.5 rounded-lg border border-[var(--gold)]/50 bg-[var(--gold-pale)] px-3 py-2">
                <Hourglass className="h-5 w-5 shrink-0 text-[var(--gold)]" />
                <div>
                  <p className="text-sm font-bold text-[var(--ink)]">{pt('subscriptionTrialTitle')}</p>
                  <p className="text-xs text-[var(--muted)]">{pt('trialLeft', { days: proTrialDaysLeft })}</p>
                </div>
              </div>
              <div className="mt-2 space-y-1.5">
                <Link
                  href="/pro"
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-3 py-2 text-sm font-bold text-[var(--ink)]"
                >
                  <Crown className="h-4 w-4" /> {pt('activatePro')}
                </Link>
                <Link href={{ pathname: '/billing' }} className="block text-center text-xs font-medium text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline">
                  {pt('orBaseOnly')}
                </Link>
                <VoucherActivationButton />
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-orange-400" />
                <span className="text-sm font-semibold text-[var(--ink)]">{t('freePlan')}</span>
              </div>
              <div className="mt-2 space-y-1.5">
                <Link
                  href={{ pathname: '/billing' }}
                  className="block text-center rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--ink-soft)]"
                >
                  {t('subscribeNow')}
                </Link>
                <VoucherActivationButton />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] px-5 py-4 shadow-sm">
          <span className="text-sm text-[var(--muted)] font-medium truncate">
            {t('yourReferralCode')} <span className="ml-1.5 font-mono font-bold text-[var(--ink)]">{profile?.referral_code}</span>
          </span>
          <CopyButton text={shareUrl} variant="light" />
        </div>
      </div>

      {/* I tuoi strumenti: categorie chiuse a scheda, come le liste KUMANI */}
      <div>
        <h2 className="text-xl font-bold text-[var(--ink)] mb-5">{t('yourTools')}</h2>

        <div className="space-y-3">
          {toolsByCategory.map(({ category, tools }) => (
            <CategoryToolsAccordion
              key={category}
              category={category}
              label={categoryLabels[category]}
              toolsLabel={marketplaceT('categoryToolCount', { count: tools.length })}
              tools={tools}
              lockedToolNames={lockedToolNames}
              proToolNames={proToolNames}
              favoriteToolNames={favoriteToolNames}
            />
          ))}
        </div>
      </div>

      <KumanoDelGiornoPreview />

      {/* Riepilogo della rete (gli annunci sono nella categoria Community) */}
      <div>
        <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
              <Users className="h-5 w-5 text-[var(--gold)]" />
              {t('yourNetwork')}
            </h2>
            <Link href="/dashboard/rete" className="text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)] flex items-center gap-1">
              {t('viewFullNetwork')}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex items-center gap-6 mb-5">
            <div>
              <p className="text-2xl font-bold text-[var(--ink)] leading-none">{activeKumani.length}</p>
              <p className="text-xs text-[var(--muted)] font-medium mt-1">{t('activeKumaniLabel')}</p>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div>
              <p className="text-2xl font-bold text-[var(--ink)] leading-none">{pendingKumani.length}</p>
              <p className="text-xs text-[var(--muted)] font-medium mt-1">{t('pendingKumaniLabel')}</p>
            </div>
          </div>

          {(currentRank || nextRank) && (
            <div>
              <p className="text-sm font-semibold text-[var(--ink)] mb-1.5">
                {nextRank ? t(nextRank.labelKey) : currentRank ? t(currentRank.labelKey) : ''}
              </p>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-[var(--gold)]" style={{ width: `${rankProgress}%` }} />
              </div>
              {nextRank && (
                <>
                  <p className="text-xs text-[var(--muted)] mt-1.5">
                    {directSponsorCount}/{nextRank.threshold} {t('affiliates')}
                  </p>
                  <p className="text-xs font-semibold text-[var(--gold)] mt-1">
                    {t('missingForNextRank', { count: nextRank.threshold - directSponsorCount, rank: t(nextRank.labelKey) })}
                  </p>
                </>
              )}
            </div>
          )}

          {unreadMessagesCount > 0 && (
            <div className="mt-4">
              <UnreadMessagesBadge initialCount={unreadMessagesCount} />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
