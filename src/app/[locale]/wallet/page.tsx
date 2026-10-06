import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import {
  Wallet,
  Ticket,
  Gift,
  Sparkles,
  Award,
  Receipt,
  IdCard,
  ArrowRight,
  BadgeCheck,
  Network,
  PartyPopper,
  Hourglass,
  Star,
  Crown,
  Lock,
  HeartHandshake,
  Stamp,
  ChevronRight,
} from 'lucide-react'
import { getCurrentRank, rankProgress } from '@/lib/ranks'
import { rankMissingText } from '@/components/RankRequirements'
import { getMyNetworkWallet } from '@/lib/networkWallet'
import { listMyVouchers } from '@/app/actions/vouchers'
import { listMyRedemptions } from '@/app/actions/rewards'
import { isRewardsCatalogEnabled } from '@/lib/rewardsCatalog'
import WalletMembershipCard from '@/components/WalletMembershipCard'
import WalletDonations from '@/components/donations/WalletDonations'
import { getPublicDonationSummary } from '@/lib/donationsPublic'
import { getMyDonations } from '@/app/actions/donations'
import WalletCouponsList from '@/components/WalletCouponsList'
import WalletVoucherSection from '@/components/WalletVoucherSection'
import WalletRenewalDiscount from '@/components/ku/WalletRenewalDiscount'
import { getMyToolPasses } from '@/lib/toolPasses'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { loadKuWalletData } from '@/lib/ku-server'
import { featureConfig, type KuRenewalConfig } from '@/lib/ku'
import { getMyAttendedCount, listMyPasses } from '@/app/actions/events'
import { EVENT_TYPE_EMOJI, formatEventDate } from '@/lib/events'
import AppHeader from '@/components/nav/AppHeader'
import { effectiveStamps } from '@/lib/fidelity'
import { getSessionProfile, getSessionUser, preloadSession } from '@/lib/session'

const RANK_ICONS = { Star, Sparkles, Crown }

type FidelityWalletCard = {
  token: string
  business_name: string
  prize: string
  stamps_needed: number
  stamps_expire_days: number | null
  stamps_count: number
  last_stamp_at: string | null
  rewards_redeemed: number
  is_active: boolean
}
type ReceivedReceipt = { code: string; object_name: string; template: string; delivery_date: string; declared_value: number | null; confirmed_at: string | null }

function WalletSection({
  id,
  icon,
  title,
  children,
}: {
  id?: string
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <div id={id} className="relative scroll-mt-6 overflow-hidden rounded-xl border border-[var(--gold)]/40 bg-[var(--paper)] p-6 pt-7 shadow-sm">
      {/* Banda dorata d'inizio sezione */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)]" />
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
          {icon}
          {title}
        </h3>
      </div>
      {children}
    </div>
  )
}

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [t, td, tg, supabase] = await Promise.all([getTranslations('wallet'), getTranslations('dashboard'), getTranslations('gifts'), createClient()])
  // Utente letto una volta sola per la pagina e la sua intestazione
  preloadSession()
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login`)

  // Profilo completo (dati personali inclusi) solo tramite get_my_profile():
  // dal browser/sessione utente le colonne personali non sono più leggibili.
  const profile = await getSessionProfile()
  if (!profile) redirect(`/${locale}/dashboard`)

  const couponQuery = (columns: string) =>
    supabase.from('wallet_coupons').select(columns).eq('user_id', user.id).order('created_at', { ascending: false })

  // Tutte le letture del Wallet insieme (una alla volta la pagina impiegava
  // quasi due secondi): ognuna è indipendente dalle altre.
  const [
    kuWalletData,
    tku,
    networkWallet,
    { data: welcomeAwards },
    [donationSummary, myDonations, tdon],
    { data: achievementRows },
    { data: receipts },
    coupons,
    [myPasses, marketplaceT, tp],
    myVouchers,
    rewardsEnabled,
    redemptions,
    [eventPasses, attendedCount],
    { data: plan },
    { data: fidelityCards },
    { data: receivedReceipts },
  ] = await Promise.all([
    // Sconto sul rinnovo pagato in KU Karma (Gestione KU → 4), solo se attivo
    loadKuWalletData(supabase, profile),
    getTranslations('kuRewards'),
    // KU Points, attivazioni e regole delle qualifiche
    getMyNetworkWallet(supabase),
    // KU Points ricevuti con il Bonus Accoglienza (registro dei punti, tipo
    // 'matrix'; esclusi quelli annullati)
    supabase.from('network_point_awards').select('points').eq('user_id', user.id).eq('kind', 'matrix').is('reversed_at', null),
    // Donazioni (sezione visibile solo con un'associazione attiva)
    Promise.all([getPublicDonationSummary(), getMyDonations(), getTranslations('donations')]),
    // Data in cui ogni badge è stato raggiunto (registrata dal database)
    supabase.rpc('my_rank_achievements'),
    supabase
      .from('digital_receipts')
      .select('id, object_name, template, confirmed_at, returned_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    // Senza la colonna dei pass (migrazione non ancora applicata) si legge come prima
    couponQuery('id, code, title, description, expires_at, redeemed_at, created_at, pass_tool').then(async (withPass) =>
      withPass.error ? (await couponQuery('id, code, title, description, expires_at, redeemed_at, created_at')).data : withPass.data
    ),
    // Pass dei singoli servizi attivi (servizio → scadenza) e nomi tradotti
    Promise.all([getMyToolPasses(supabase), getTranslations('marketplace'), getTranslations('toolPass')]),
    listMyVouchers(),
    // Catalogo Premi: se spento dall'Admin niente collegamenti; i premi già
    // riscattati restano visibili finché ce ne sono
    isRewardsCatalogEnabled(supabase),
    // Premi riscattati dal Catalogo Premi: in preparazione finché lo Staff non
    // li evade (il codice arriva poi tra i Coupon)
    listMyRedemptions(),
    Promise.all([listMyPasses(), getMyAttendedCount()]),
    supabase.rpc('my_plan'),
    // Ecosistema: le Kumi Card fedeltà dei negozi e le ricevute confermate
    supabase.rpc('my_fidelity_cards'),
    supabase.rpc('my_received_receipts', { p_limit: 5 }),
  ])

  const fidelityList = (fidelityCards ?? []) as FidelityWalletCard[]
  const receivedList = (receivedReceipts ?? []) as ReceivedReceipt[]
  const renewal = featureConfig<KuRenewalConfig>(kuWalletData.features, 'renewal_discount')
  const { ranks } = networkWallet
  const welcomeBonusPoints = (welcomeAwards ?? []).reduce((sum, row) => sum + (row.points ?? 0), 0)
  const achievements = new Map(
    ((achievementRows ?? []) as { rank_key: string; achieved_at: string }[]).map((row) => [row.rank_key, row])
  )
  // Qualifiche registrate dal database (attivazioni pagate + KU Points)
  const achievedKeys = [...achievements.keys()]
  const currentRank = getCurrentRank(achievedKeys, ranks)
  const nextRank = ranks.find((rank) => !achievements.has(rank.key)) ?? null
  const nextMissing = nextRank ? await rankMissingText(nextRank, networkWallet.activations, networkWallet.confirmedPoints) : null

  const receiptsList = receipts || []
  const receiptsPending = receiptsList.filter((r) => !r.confirmed_at).length
  const receiptsConfirmed = receiptsList.filter((r) => r.confirmed_at && !r.returned_at).length
  const receiptsReturned = receiptsList.filter((r) => r.returned_at).length

  const couponsList = (coupons ?? []) as unknown as {
    id: string
    code: string
    title: string
    description: string | null
    expires_at: string | null
    redeemed_at: string | null
    created_at: string
    pass_tool?: string | null
  }[]
  const toolsByName = new Map(getMarketplaceTools((key) => marketplaceT(key)).map((tool) => [tool.toolName, tool]))
  const passTitles = Object.fromEntries([...toolsByName].map(([name, tool]) => [name, tool.title]))
  const myRedemptions = redemptions as unknown as {
    id: string
    points_spent: number
    redeemed_at: string
    fulfilled_at: string | null
    reward_catalog: { title: string | null; image_url: string | null } | { title: string | null; image_url: string | null }[] | null
  }[]

  // Piano effettivo (la prova Pro conta come Pro): stesso calcolo degli strumenti.
  const onProTrial =
    plan === 'pro' && profile.pro_trial_ends_at && new Date(profile.pro_trial_ends_at).getTime() > new Date().getTime() && profile.subscription_plan !== 'pro'
  const planName = plan === 'pro' ? (onProTrial ? t('planProTrial') : t('planPro')) : plan === 'base' ? t('planBase') : null

  const baseUrl = SITE_URL
  const referralUrl = `${baseUrl}/${locale}/ref/${profile.referral_code}`
  const memberSince = new Date(profile.created_at).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('title')} icon={<Wallet className="h-5 w-5" />} />

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-4 max-w-2xl">
          <p className="mb-2 text-lg font-semibold text-[var(--ink)]">{t('intro')}</p>
          <p className="text-sm leading-6 text-[var(--muted)]">{t('introSub')}</p>
        </div>

        {/* Membership */}
        <WalletSection icon={<IdCard className="h-5 w-5 text-[var(--gold)]" />} title={t('membershipTitle')}>
          <WalletMembershipCard
            firstName={profile.first_name}
            lastName={profile.last_name}
            memberId={profile.referral_code}
            memberSince={memberSince}
            planLabel={planName ? td('subscriptionActive') : td('freePlan')}
            planName={planName}
            rankLabel={currentRank ? td(currentRank.labelKey) : null}
            validUntil={planName && profile.subscription_expires_at ? new Date(profile.subscription_expires_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : null}
            qrUrl={referralUrl}
          />
        </WalletSection>

        {/* Pass dei singoli servizi (acquistati o attivati con codice) */}
        {myPasses.size > 0 && (
          <WalletSection icon={<Ticket className="h-5 w-5 text-[var(--gold)]" />} title={tp('walletPassTitle')}>
            <ul className="space-y-2">
              {[...myPasses].map(([tool, expiresAt]) => {
                const info = toolsByName.get(tool)
                return (
                  <li key={tool} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/25 bg-white px-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-semibold text-[var(--ink)]">{info?.title ?? tool}</span>
                      <span className="block text-xs text-[var(--muted)]">
                        {tp('walletPassUntil', { date: new Date(expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}
                      </span>
                    </span>
                    <span className="flex shrink-0 gap-2">
                      <Link href={`/pass/${tool}`} className="rounded-lg border border-[var(--gold)]/50 px-3 py-1.5 text-xs font-semibold text-[var(--ink)]">
                        {tp('walletPassRenew')}
                      </Link>
                      {info && (
                        <Link href={info.href} className="rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-[var(--gold-bright)]">
                          {tp('openService')}
                        </Link>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </WalletSection>
        )}

        {/* Kumi Card fedeltà dei negozi: legate all'account quando si aprono con l'accesso */}
        <WalletSection id="fidelity" icon={<Stamp className="h-5 w-5 text-[var(--gold)]" />} title={t('fidelityTitle')}>
          {fidelityList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t('fidelityEmpty')}</p>
          ) : (
            <ul className="space-y-2">
              {fidelityList.map((card) => {
                const stamps = Math.min(effectiveStamps(card, card), card.stamps_needed)
                const complete = stamps >= card.stamps_needed
                return (
                  <li key={card.token}>
                    <Link
                      href={`/f/${card.token}`}
                      className="flex items-center gap-3 rounded-xl border border-[var(--gold)]/25 bg-white px-4 py-3 transition-colors hover:border-[var(--gold)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[var(--ink)]">{card.business_name}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">
                          {complete ? t('fidelityComplete', { prize: card.prize }) : t('fidelityMissing', { count: card.stamps_needed - stamps, prize: card.prize })}
                        </span>
                        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-gray-100">
                          <span className="block h-full rounded-full bg-[var(--gold)]" style={{ width: `${(stamps / card.stamps_needed) * 100}%` }} />
                        </span>
                      </span>
                      <span className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold ${complete ? 'bg-emerald-100 text-emerald-700' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
                        {stamps}/{card.stamps_needed}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </WalletSection>

        {/* Pass degli eventi a cui sono iscritto (il QR si apre nella pagina dell'evento) */}
        <WalletSection icon={<PartyPopper className="h-5 w-5 text-[var(--gold)]" />} title={t('eventPassesTitle')}>
          {/* "C'ero": eventi a cui sono davvero entrato (check-in fatto) */}
          {attendedCount > 0 && (
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/50 bg-[var(--gold-pale)] px-3 py-1.5 text-sm font-bold text-[var(--ink)]">
              <span aria-hidden="true">🎉</span> {t('eventAttendedBadge', { count: attendedCount })}
            </p>
          )}
          {eventPasses.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">{t('eventPassesEmpty')}</p>
              <Link href="/events" className="rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white">
                {t('eventPassesCta')}
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {eventPasses.map((pass) => (
                <li key={pass.id}>
                  <Link
                    href={`/events/${pass.id}`}
                    className="flex items-center gap-3 rounded-xl border border-[var(--gold)]/25 bg-white px-4 py-3 transition-colors hover:border-[var(--gold)]"
                  >
                    <span className="text-2xl">{EVENT_TYPE_EMOJI[pass.type]}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-[var(--ink)]">{pass.title}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">
                        {formatEventDate(pass.starts_at, pass.timezone, locale)}
                        {pass.city ? ` · ${pass.city}` : ''}
                      </span>
                    </span>
                    {pass.my_status === 'waitlist' ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-[var(--gold)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">
                        <Hourglass className="h-3.5 w-3.5" /> {t('eventPassWaitlist')}
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-lg bg-[var(--gold)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">{t('eventPassShow')}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </WalletSection>

        <div className="space-y-6">
          {/* Punti: KU Karma (uso quotidiano) e KU Points (inviti),
              due saldi separati nella stessa scheda */}
          <WalletSection id="wallet-points" icon={<Sparkles className="h-5 w-5 text-[var(--gold)]" />} title={t('pointsCardTitle')}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_auto_1fr]">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
                  <Sparkles className="h-4 w-4 text-[var(--gold)]" /> {t('pointsTitle')}
                </p>
                <p className="mt-1 text-4xl font-bold text-[var(--ink)]">{profile.daily_points || 0}</p>
                <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{t('pointsDisclaimer')}</p>
                <Link
                  href="/marketplace/listings"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
                >
                  {t('pointsCta')} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              {/* Separatore: orizzontale su telefono, verticale da tablet in su */}
              <div aria-hidden className="h-px bg-gradient-to-r from-transparent via-[var(--gold)] to-transparent md:h-auto md:w-px md:bg-gradient-to-b" />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
                  <Network className="h-4 w-4 text-[var(--gold)]" /> {t('networkPointsTitle')}
                </p>
                <p className="mt-1 text-4xl font-bold text-[var(--ink)]">{networkWallet.networkPoints}</p>
                {/* Quanti ne sono arrivati con il Bonus Accoglienza */}
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-800">
                  <Gift className="h-3.5 w-3.5" /> {t('welcomeBonusReceived', { points: welcomeBonusPoints })}
                </p>
                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t('networkPointsDisclaimer')}</p>
                {rewardsEnabled && (
                  <Link
                    href="/rewards"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
                  >
                    {t('networkPointsCta')} <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            </div>
          </WalletSection>

          {/* Donazioni: dona i tuoi KU Points e vedi quanto dona KUMANI */}
          {donationSummary?.active && (
            <WalletSection icon={<HeartHandshake className="h-5 w-5 text-[var(--gold)]" />} title={tdon('sectionTitle')}>
              <WalletDonations summary={donationSummary} mine={myDonations} networkPoints={networkWallet.networkPoints} />
            </WalletSection>
          )}

          {/* Qualifiche Kuman Green / Star / Black: attivazioni pagate delle
              persone invitate e KU Points guadagnati, con i voucher premio */}
          <WalletSection icon={<Award className="h-5 w-5 text-[var(--gold)]" />} title={t('badgeTitle')}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-[var(--muted)]">{t('badgeActivations')}</p>
                  <p className="text-3xl font-bold text-[var(--ink)]">{networkWallet.activations}</p>
                  {networkWallet.pendingActivations > 0 && <p className="text-xs text-amber-700">{t('badgePending', { count: networkWallet.pendingActivations })}</p>}
                </div>
                <div>
                  <p className="text-xs text-[var(--muted)]">{t('badgeConfirmedPoints')}</p>
                  <p className="text-3xl font-bold text-[var(--ink)]">{networkWallet.confirmedPoints}</p>
                  {networkWallet.pendingPoints > 0 && <p className="text-xs text-amber-700">{t('badgePendingPoints', { count: networkWallet.pendingPoints })}</p>}
                </div>
              </div>
              <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-xs font-bold text-[var(--gold-bright)]">
                {currentRank ? td(currentRank.labelKey) : t('badgeNone')}
              </span>
            </div>

            {nextRank ? (
              <div className="mt-3">
                <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]"
                    style={{ width: `${rankProgress(nextRank, networkWallet.activations, networkWallet.confirmedPoints)}%` }}
                  />
                </div>
                {nextMissing && <p className="mt-1.5 text-xs font-semibold text-[var(--ink)]">{nextMissing}</p>}
              </div>
            ) : (
              <p className="mt-3 text-xs font-semibold text-[var(--gold)]">{t('badgeEncourageTop')}</p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
              {ranks.map((rank) => {
                const earned = achievements.has(rank.key)
                const Icon = RANK_ICONS[rank.icon]
                const achieved = achievements.get(rank.key)
                return (
                  <div
                    key={rank.key}
                    className={`flex flex-col items-center rounded-xl border p-3 text-center ${
                      earned ? 'border-[var(--gold)]/55 bg-[var(--gold-pale)]' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div
                      className={`relative flex h-12 w-12 items-center justify-center rounded-full ${
                        earned ? 'bg-[var(--ink)] text-[var(--gold-bright)] shadow-md' : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                      {!earned && (
                        <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white shadow">
                          <Lock className="h-3 w-3 text-gray-500" />
                        </span>
                      )}
                    </div>
                    <p className={`mt-2 text-xs font-bold sm:text-sm ${earned ? 'text-[var(--ink)]' : 'text-gray-500'}`}>{td(rank.labelKey)}</p>
                    <p className="text-[10px] text-gray-500 sm:text-xs">{t('badgeRequirement', { acts: rank.activations, points: rank.points })}</p>
                    <p className="text-[10px] font-semibold text-[var(--gold)] sm:text-xs">{t('badgePrize', { count: rank.vouchers })}</p>
                    <p className={`mt-1 text-[10px] font-semibold ${earned ? 'text-emerald-700' : 'text-gray-400'}`}>
                      {earned
                        ? achieved
                          ? t('badgeReachedOn', { date: new Date(achieved.achieved_at).toLocaleDateString(locale) })
                          : t('badgeEarned')
                        : t('badgeToReach')}
                    </p>
                  </div>
                )
              })}
            </div>

            {achievements.has(ranks[ranks.length - 1].key) ? (
              // Kuman Black: messaggio in evidenza, nero e oro
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-gray-950 via-gray-900 to-gray-800 px-4 py-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] ring-1 ring-[var(--gold)]/50">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/15 ring-1 ring-[var(--gold-bright)]/60">
                  <Crown className="h-6 w-6 text-[var(--gold-bright)]" />
                </span>
                <p className="text-sm font-bold leading-6 text-[var(--gold-bright)] sm:text-base">{t('badgeBlackNote', { every: networkWallet.blackPlusEvery })}</p>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{currentRank ? t('badgeEncourageNext') : t('badgeEncourageFirst')}</p>
            )}
            <Link
              href="/dashboard/rete"
              className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
            >
              {t('badgeSeeNetwork')} <ArrowRight className="h-4 w-4" />
            </Link>
          </WalletSection>
        </div>

        {/* Receipts */}
        <WalletSection icon={<Receipt className="h-5 w-5 text-[var(--gold)]" />} title={t('receiptsTitle')}>
          {plan !== 'pro' && (
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-3 py-2.5 text-sm text-[var(--ink)]">
              <span>{t('receiptsProOnly')}</span>
              <Link href="/pro" className="shrink-0 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white">
                {t('receiptsProCta')}
              </Link>
            </div>
          )}
          {receiptsList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t('receiptsEmpty')}</p>
          ) : (
            <div className="mb-4 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-2xl font-bold text-orange-500">{receiptsPending}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('receiptsPending')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{receiptsConfirmed}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('receiptsConfirmed')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--ink)]">{receiptsReturned}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('receiptsReturned')}</p>
              </div>
            </div>
          )}
          {/* Ricevute fatte da altri che ho confermato con l'accesso */}
          {receivedList.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{t('receiptsReceivedTitle')}</p>
              <ul className="space-y-1.5">
                {receivedList.map((r) => (
                  <li key={r.code}>
                    <Link href={`/ricevute/${r.code}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:border-[var(--gold)]">
                      <span className="min-w-0 truncate font-medium text-[var(--ink)]">{r.object_name}</span>
                      <span className="shrink-0 text-xs text-[var(--muted)]">
                        {r.declared_value ? `€${r.declared_value} · ` : ''}
                        {new Date(r.delivery_date).toLocaleDateString(locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Link
            href="/marketplace/digital-receipt"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
          >
            {t('receiptsCta')} <ArrowRight className="h-4 w-4" />
          </Link>
        </WalletSection>

        {/* I miei premi: riscatti dal Catalogo Premi e il loro stato */}
        {(rewardsEnabled || myRedemptions.length > 0) && (
        <WalletSection icon={<Gift className="h-5 w-5 text-[var(--gold)]" />} title={t('rewardsTitle')}>
          {myRedemptions.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--muted)]">{t('rewardsEmpty')}</p>
              <Link href="/rewards" className="rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-semibold text-white">
                {t('networkPointsCta')}
              </Link>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {myRedemptions.map((redemption) => {
                  const reward = Array.isArray(redemption.reward_catalog) ? redemption.reward_catalog[0] : redemption.reward_catalog
                  const delivered = Boolean(redemption.fulfilled_at)
                  return (
                    <li key={redemption.id} className="flex items-center gap-3 rounded-xl border border-[var(--gold)]/25 bg-white px-4 py-3">
                      {reward?.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={reward.image_url} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--gold-pale)]">
                          <Gift className="h-5 w-5 text-[var(--gold)]" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[var(--ink)]">{reward?.title || t('rewardFallbackTitle')}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">
                          {t('rewardSpent', {
                            points: redemption.points_spent,
                            date: new Date(redemption.redeemed_at).toLocaleDateString(locale),
                          })}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--muted)]">
                          {delivered ? (
                            <a href="#wallet-coupon" className="font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                              {t('rewardDeliveredHint')}
                            </a>
                          ) : (
                            t('rewardPendingHint')
                          )}
                        </span>
                      </span>
                      {delivered ? (
                        <span className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <BadgeCheck className="h-3.5 w-3.5" /> {t('rewardDelivered')}
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-1 rounded-lg border border-dashed border-[var(--gold)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">
                          <Hourglass className="h-3.5 w-3.5" /> {t('rewardPending')}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
              {rewardsEnabled && (
                <Link href="/rewards" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                  {t('networkPointsCta')} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </>
          )}
        </WalletSection>
        )}

        {/* Coupon */}
        <WalletSection id="wallet-coupon" icon={<Ticket className="h-5 w-5 text-[var(--gold)]" />} title={t('couponTitle')}>
          {couponsList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t('couponEmpty')}</p>
          ) : (
            <WalletCouponsList coupons={couponsList} passTitles={passTitles} />
          )}
        </WalletSection>

        {/* Sconto sul rinnovo con i KU Karma */}
        {renewal?.enabled && (
          <WalletSection icon={<Ticket className="h-5 w-5 text-[var(--gold)]" />} title={tku('renewalTitle')}>
            <WalletRenewalDiscount
              config={renewal}
              balance={kuWalletData.balance}
              usedThisYear={kuWalletData.renewalUsedThisYear}
              hasStripeSubscription={kuWalletData.hasStripeSubscription}
            />
          </WalletSection>
        )}

        {/* Regali: codici per Base/Pro o per il Pass di un servizio */}
        <WalletSection icon={<Gift className="h-5 w-5 text-[var(--gold)]" />} title={tg('walletTitle')}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm leading-6 text-[var(--muted)]">{tg('walletText')}</p>
            <Link href="/regali" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-[var(--gold-bright)]">
              <Gift className="h-4 w-4" /> {tg('walletButton')}
            </Link>
          </div>
        </WalletSection>

        {/* KU Points, qualifiche e voucher premio */}
        <WalletSection id="voucher" icon={<BadgeCheck className="h-5 w-5 text-[var(--gold)]" />} title={t('voucherTitle')}>
          <WalletVoucherSection
            points={networkWallet.networkPoints}
            rules={networkWallet.pointsRules}
            ranks={networkWallet.ranks}
            blackPlusEvery={networkWallet.blackPlusEvery}
            initialVouchers={myVouchers}
            pendingPoints={networkWallet.pendingPoints}
            confirmDays={networkWallet.confirmDays}
          />
        </WalletSection>
      </main>
    </div>
  )
}
