import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import {
  ArrowLeft,
  Wallet,
  Ticket,
  Gift,
  Sparkles,
  Award,
  TicketCheck,
  Receipt,
  BadgePercent,
  IdCard,
  ArrowRight,
  BadgeCheck,
  Network,
  PartyPopper,
} from 'lucide-react'
import { fetchDirectSponsored } from '@/lib/directAffiliates'
import { isActiveSubscription } from '@/lib/subscriptionGate'
import { getCurrentRank, RANKS } from '@/lib/ranks'
import { listMyVouchers } from '@/app/actions/vouchers'
import WalletMembershipCard from '@/components/WalletMembershipCard'
import WalletCouponsList from '@/components/WalletCouponsList'
import WalletVoucherSection from '@/components/WalletVoucherSection'
import KuRewardsSection from '@/components/ku/KuRewardsSection'
import { loadKuWalletData } from '@/lib/ku-server'
import { listMyPasses } from '@/app/actions/events'
import { EVENT_TYPE_EMOJI, formatEventDate } from '@/lib/events'

function WalletSection({
  icon,
  title,
  comingSoonLabel,
  children,
}: {
  icon: React.ReactNode
  title: string
  comingSoonLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
          {icon}
          {title}
        </h3>
        {comingSoonLabel && (
          <span className="rounded-full border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            {comingSoonLabel}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

export default async function WalletPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('wallet')
  const td = await getTranslations('dashboard')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  // Profilo completo (dati personali inclusi) solo tramite get_my_profile():
  // dal browser/sessione utente le colonne personali non sono più leggibili.
  const { data: profile } = await supabase.rpc('get_my_profile').maybeSingle<Record<string, any>>()
  if (!profile) redirect(`/${locale}/dashboard`)

  const directSponsored = await fetchDirectSponsored(supabase)
  const kuWalletData = await loadKuWalletData(supabase, profile)
  const directActiveCount = directSponsored.filter(isActiveSubscription).length
  const currentRank = getCurrentRank(directActiveCount)

  const { data: receipts } = await supabase
    .from('digital_receipts')
    .select('id, object_name, template, confirmed_at, returned_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const receiptsList = receipts || []
  const receiptsPending = receiptsList.filter((r) => !r.confirmed_at).length
  const receiptsConfirmed = receiptsList.filter((r) => r.confirmed_at && !r.returned_at).length
  const receiptsReturned = receiptsList.filter((r) => r.returned_at).length

  const { data: coupons } = await supabase
    .from('wallet_coupons')
    .select('id, code, title, description, expires_at, redeemed_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const couponsList = coupons || []
  const myVouchers = await listMyVouchers()
  const eventPasses = await listMyPasses()

  // Piano effettivo (la prova Pro conta come Pro): stesso calcolo degli strumenti.
  const { data: plan } = await supabase.rpc('my_plan')
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
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-[0_8px_30px_rgba(23,23,23,0.18)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <Wallet className="h-5 w-5 text-[var(--gold-bright)]" /> {t('title')}
          </h1>
        </div>
      </header>

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
            qrUrl={referralUrl}
          />
        </WalletSection>

        {/* Pass degli eventi a cui sono iscritto (il QR si apre nella pagina dell'evento) */}
        <WalletSection icon={<PartyPopper className="h-5 w-5 text-[var(--gold)]" />} title={t('eventPassesTitle')}>
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
                    <span className="shrink-0 rounded-lg bg-[var(--gold)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">{t('eventPassShow')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </WalletSection>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Points / XP */}
          <WalletSection icon={<Sparkles className="h-5 w-5 text-[var(--gold)]" />} title={t('pointsTitle')}>
            <p className="text-4xl font-bold text-[var(--ink)]">{profile.daily_points || 0}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{t('pointsDisclaimer')}</p>
            <Link
              href="/marketplace/listings"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
            >
              {t('pointsCta')} <ArrowRight className="h-4 w-4" />
            </Link>
          </WalletSection>

          {/* Network points — distinti dai punti giornalieri: si ottengono
              raggiungendo le qualifiche di sponsorizzazione, non dall'uso
              quotidiano della piattaforma. Spendibili comunque insieme ai
              punti giornalieri (vedi WalletVoucherSection). */}
          <WalletSection icon={<Network className="h-5 w-5 text-[var(--gold)]" />} title={t('networkPointsTitle')}>
            <p className="text-4xl font-bold text-[var(--ink)]">{profile.network_points || 0}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{t('networkPointsDisclaimer')}</p>
            <Link
              href="/rewards"
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
            >
              {t('networkPointsCta')} <ArrowRight className="h-4 w-4" />
            </Link>
          </WalletSection>

          {/* Badge */}
          <WalletSection icon={<Award className="h-5 w-5 text-[var(--gold)]" />} title={t('badgeTitle')}>
            <div className="grid grid-cols-3 gap-3">
              {RANKS.map((rank) => {
                const earned = directActiveCount >= rank.threshold
                return (
                  <div
                    key={rank.key}
                    className={`rounded-lg border p-3 text-center ${
                      earned ? 'border-[var(--gold)]/55 bg-[var(--gold-pale)]' : 'border-gray-200 bg-gray-50 opacity-60'
                    }`}
                  >
                    <p className={`text-sm font-bold ${earned ? 'text-[var(--ink)]' : 'text-gray-400'}`}>
                      {td(rank.labelKey)}
                    </p>
                    <p className="mt-1 text-[10px] text-gray-500">
                      {earned ? t('badgeEarned') : t('badgeLocked', { threshold: rank.threshold })}
                    </p>
                  </div>
                )
              })}
            </div>
            {/* Invito a condividere: incoraggia a raggiungere la qualifica successiva. */}
            <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
              {directActiveCount >= RANKS[RANKS.length - 1].threshold
                ? t('badgeEncourageTop')
                : currentRank
                  ? t('badgeEncourageNext')
                  : t('badgeEncourageFirst')}
            </p>
          </WalletSection>
        </div>

        {/* Receipts */}
        <WalletSection icon={<Receipt className="h-5 w-5 text-[var(--gold)]" />} title={t('receiptsTitle')}>
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
          <Link
            href="/marketplace/digital-receipt"
            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
          >
            {t('receiptsCta')} <ArrowRight className="h-4 w-4" />
          </Link>
        </WalletSection>

        {/* Coupon */}
        <WalletSection icon={<Ticket className="h-5 w-5 text-[var(--gold)]" />} title={t('couponTitle')}>
          {couponsList.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">{t('couponEmpty')}</p>
          ) : (
            <WalletCouponsList coupons={couponsList} />
          )}
        </WalletSection>

        {/* Voucher abbonamento */}
        <WalletSection icon={<BadgeCheck className="h-5 w-5 text-[var(--gold)]" />} title={t('voucherTitle')}>
          <KuRewardsSection data={kuWalletData} />

          <WalletVoucherSection initialPoints={profile.network_points || 0} initialVouchers={myVouchers} />
        </WalletSection>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Rewards */}
          <WalletSection icon={<Gift className="h-5 w-5 text-[var(--gold)]" />} title={t('rewardsTitle')} comingSoonLabel={t('comingSoon')}>
            <p className="text-sm text-[var(--muted)]">{t('rewardsEmpty')}</p>
          </WalletSection>

          {/* Pass */}
          <WalletSection icon={<TicketCheck className="h-5 w-5 text-[var(--gold)]" />} title={t('passTitle')} comingSoonLabel={t('comingSoon')}>
            <p className="text-sm text-[var(--muted)]">{t('passEmpty')}</p>
          </WalletSection>

          {/* Gift / Benefit */}
          <WalletSection icon={<BadgePercent className="h-5 w-5 text-[var(--gold)]" />} title={t('giftTitle')} comingSoonLabel={t('comingSoon')}>
            <p className="text-sm text-[var(--muted)]">{t('giftEmpty')}</p>
          </WalletSection>
        </div>
      </main>
    </div>
  )
}
