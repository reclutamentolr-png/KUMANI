import { getLocale, getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import KumanoDelGiornoPreview from './KumanoDelGiornoPreview'
import ToolTiers from './ToolTiers'
import InfoPopover from '@/components/InfoPopover'
import type { MarketplaceTool } from '@/lib/marketplaceTools'
import type { MarketplaceCategory } from '@/lib/marketplaceTools'
import type { DashboardNetworkData } from '@/lib/dashboardNetworkData'
import { Users, ArrowRight, Star, CheckCircle2, Crown, Hourglass, Sparkles, BadgeCheck, Gift, BookOpen } from 'lucide-react'
import CopyButton from '@/components/CopyButton'
import VoucherActivationButton from '@/components/VoucherActivationButton'
import DashboardDonations from '@/components/donations/DashboardDonations'
import KuBadge from '@/components/ku/KuBadge'
import AffinityBadge from './AffinityBadge'
import type { MyProfile } from '@/lib/myProfile'
import NativeShareButton from '@/components/NativeShareButton'

// Tipo 2: the Marketplace-first layout. Tools are the main focus; the
// network (KUMI, matrix, KUMANI lists, qualifications) is reduced to one
// compact summary card that links out to the dedicated /dashboard/rete
// page instead of taking over the page — see the two mockup concepts
// discussed with the client before building this.
export default async function DashboardTipo2({
  profile,
  shareUrl,
  visibleTools,
  lockedToolNames,
  passPrices = {},
  basePrice,
  proPrice,
  toolPlans,
  communityAccess = {},
  favoriteToolNames,
  proTrialDaysLeft = null,
  agenda = null,
  network,
}: {
  profile: MyProfile | null
  shareUrl: string
  visibleTools: MarketplaceTool[]
  lockedToolNames: string[]
  // Servizi bloccati acquistabili da soli: prezzo del pass
  passPrices?: Record<string, string>
  // Prezzo del piano Base già formattato (es. "49 €")
  basePrice: string
  // Prezzo del piano Pro già formattato (es. "149 €")
  proPrice: string
  // Fascia di ogni servizio: Gratis, Base o Pro
  toolPlans: Record<string, 'free' | 'base' | 'pro'>
  // Sezioni della Community: visibile (accesa) e bloccata dal piano
  communityAccess?: Record<string, { visible: boolean; locked: boolean }>
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
  const guidesT = await getTranslations('guides')
  const locale = await getLocale()

  // Qualifiche (solo badge) sui Punti Community guadagnati in totale
  const { activeKumani, pendingKumani, receivedKumani, currentRank, ranks, networkPointsEarned } = network
  const nextRank = ranks.find((rank) => networkPointsEarned < rank.threshold) || null
  const rankProgress = nextRank ? Math.min((networkPointsEarned / nextRank.threshold) * 100, 100) : 100

  const categoryLabels: Record<MarketplaceCategory, string> = {
    marketing: marketplaceT('categoryMarketing'),
    security: marketplaceT('categorySecurity'),
    personal: marketplaceT('categoryPersonal'),
    wellness: marketplaceT('categoryWellness'),
    lavoro: marketplaceT('categoryLavoro'),
    svago: marketplaceT('categorySvago'),
    community: marketplaceT('categoryCommunity'),
  }
  // Community: Bacheca, Kumano del Giorno e Kordata (sezioni della
  // piattaforma, non strumenti del Marketplace: niente stella preferiti).
  const communityItems = [
    { toolName: 'community-listings', setting: 'listings', href: '/marketplace/listings', iconName: 'Tag', title: marketplaceT('listings'), description: marketplaceT('listingsDescription') },
    { toolName: 'community-spotlight', setting: 'spotlight', href: '/marketplace/spotlight', iconName: 'Star', title: marketplaceT('kumanoDelGiorno'), description: marketplaceT('kumanoDelGiornoDescription') },
    { toolName: 'community-convivio', setting: 'convivio', href: '/marketplace/convivio', iconName: 'HandPlatter', title: marketplaceT('convivio'), description: marketplaceT('convivioDescription') },
    { toolName: 'community-events', setting: 'events', href: '/events', iconName: 'PartyPopper', title: marketplaceT('events'), description: marketplaceT('eventsDescription') },
    { toolName: 'community-timebank', setting: 'timebank', href: '/marketplace/timebank', iconName: 'Hourglass', title: marketplaceT('timebank'), description: marketplaceT('timebankDescription') },
  ]
    .filter((item) => communityAccess[item.setting]?.visible !== false)
    .map((item) => ({ ...item, locked: communityAccess[item.setting]?.locked === true }))


  return (
    <>
      {/* Scorciatoie: servizi preferiti e Centro guide, affiancati */}
      <div data-tour="shortcuts" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      <Link href="/guida" className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/35 bg-[var(--gold-pale)] px-5 py-4 shadow-sm transition-colors hover:border-[var(--gold)]">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-white">
            <BookOpen className="h-4.5 w-4.5" />
          </div>
          <span className="font-semibold text-[var(--ink)]">{guidesT('dashboardTitle')}</span>
        </div>
        <ArrowRight className="h-4 w-4 text-[var(--ink)] transition-transform group-hover:translate-x-1" />
      </Link>
      </div>

      {/* Novità di Affinity Amicizie (solo per chi partecipa) */}
      <AffinityBadge />

      {agenda}

      {/* Striscia di stato compatta */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div data-tour="points" className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white px-5 pb-5 pt-6 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" />
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
              <Sparkles className="h-4.5 w-4.5" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('pointsCardLabel').replace(/:\s*$/, '')}</p>
          </div>
          <span className="text-4xl font-extrabold leading-none text-[var(--ink)]">{profile?.daily_points || 0}</span>
          <span className="ml-2 text-sm font-bold text-[var(--gold)]">{t('kuPointsLabel')}</span>
          <div className="mt-2.5">
            <KuBadge earnedTotal={profile?.ku_earned_total || 0} />
          </div>
          <div className="mt-1.5">
            <InfoPopover label={t('howPointsWorkLabel')}>{t('howPointsWorkBody')}</InfoPopover>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white px-5 pb-5 pt-6 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" />
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
              <BadgeCheck className="h-4.5 w-4.5" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('subscriptionStatus')}</p>
          </div>

          {profile?.subscription_status === 'active' ? (
            <>
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 shadow">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-base font-extrabold text-emerald-700">{t('subscriptionActive')}</p>
                {profile?.subscription_expires_at && (
                  <p className="text-xs text-emerald-600">
                    {t('expiresAt')}: {new Date(profile.subscription_expires_at).toLocaleDateString(locale)}
                  </p>
                )}
              </div>
            </div>
            {/* Pagina Abbonamento: carta, fatture, disdetta e recesso */}
            <Link
              href={{ pathname: '/billing' }}
              className="mt-3 flex items-center justify-center gap-1 rounded-lg border border-[var(--gold)]/50 px-3 py-1.5 text-xs font-bold text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)]"
            >
              {pt('manageSubscription')} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            </>
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
                  {t('subscribeNow', { price: basePrice })}
                </Link>
                <VoucherActivationButton />
              </div>
            </>
          )}
        </div>

        <div data-tour="invite" className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white px-5 pb-5 pt-6 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" />
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
              <Gift className="h-4.5 w-4.5" />
            </span>
            <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('yourReferralCode')}</p>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="break-all font-mono text-2xl font-extrabold tracking-wide text-[var(--ink)]">{profile?.referral_code}</span>
            <CopyButton text={shareUrl} variant="light" />
          </div>
          <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t('inviteTileHint')}</p>
          <NativeShareButton url={shareUrl} title="KUMANI" variant="light" copyFallback={false} className="mt-3 w-full" />
        </div>
      </div>

      {/* Donazioni della community (solo con un'associazione attiva) */}
      <DashboardDonations />

      {/* I tuoi servizi in tre fasce (Gratis / Base / Pro), poi la Community */}
      <div>
        <h2 className="mb-1 text-xl font-bold text-[var(--ink)]">{t('yourTools')}</h2>
        <ToolTiers
          tools={visibleTools}
          toolPlans={toolPlans}
          lockedToolNames={lockedToolNames}
          passPrices={passPrices}
          favoriteToolNames={favoriteToolNames}
          categoryLabels={categoryLabels}
          basePrice={basePrice}
          proPrice={proPrice}
          community={communityItems}
        />
      </div>

      <KumanoDelGiornoPreview />

      {/* Riepilogo della rete: tutta la scheda porta alla pagina Rete */}
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
            <p className="text-4xl font-extrabold leading-none text-[var(--gold-bright)]">{activeKumani.length}</p>
            <p className="mt-1.5 text-xs font-medium text-white/70">{t('activeKumaniLabel')}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3">
            <p className="text-4xl font-extrabold leading-none text-white">{pendingKumani.length}</p>
            <p className="mt-1.5 text-xs font-medium text-white/70">{t('pendingKumaniLabel')}</p>
          </div>
          <div className="rounded-xl border border-sky-300/25 bg-sky-400/[0.08] px-4 py-3">
            <p className="text-4xl font-extrabold leading-none text-sky-300">{receivedKumani.length}</p>
            <p className="mt-1.5 text-xs font-medium text-white/70">{t('receivedKumaniLabel')}</p>
          </div>
        </div>

        {(currentRank || nextRank) && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-white">{nextRank ? t(nextRank.labelKey) : currentRank ? t(currentRank.labelKey) : ''}</span>
              {nextRank && (
                <span className="text-xs text-white/60">
                  {networkPointsEarned}/{nextRank.threshold} {t('communityPointsUnit')}
                </span>
              )}
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" style={{ width: `${rankProgress}%` }} />
            </div>
            {nextRank && (
              <p className="mt-2 text-xs font-semibold text-[var(--gold-bright)]">
                {t('missingForNextRank', { count: nextRank.threshold - networkPointsEarned, rank: t(nextRank.labelKey) })}
              </p>
            )}
          </div>
        )}

        <span className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] shadow transition group-hover:brightness-110">
          {t('openCommunityCta')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </span>
      </Link>
    </>
  )
}
