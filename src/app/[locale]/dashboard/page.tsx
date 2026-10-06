import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import AppHeader from '@/components/nav/AppHeader'
import ActivityTracker from '@/components/ActivityTracker'
import ChatModalWrapper from '@/components/ChatModalWrapper'
import ListingDetailModalWrapper from '@/components/ListingDetailModalWrapper'
import { getUnreadMessagesCount } from '@/lib/listings-server'
import InstallAppPrompt from '@/components/InstallAppPrompt'
import RankAchievementModal from '@/components/RankAchievementModal'
import RenewalReminderModal from '@/components/RenewalReminderModal'
import AdminMessagePopup from '@/components/AdminMessagePopup'
import { hasAdminRole } from '@/lib/admin-auth'
import { deferNetworkClaims, getDashboardNetworkData } from '@/lib/dashboardNetworkData'
import { getMarketplaceAccessState } from '@/lib/marketplaceAccess'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getFavoriteToolNames } from '@/lib/favorites'
import DashboardTipo2 from '@/components/dashboard/DashboardTipo2'
import LateSponsorCard from '@/components/dashboard/LateSponsorCard'
import PushInviteCard from '@/components/dashboard/PushInviteCard'
import { getLateSponsorStatus } from '@/lib/lateSponsor'
import DashboardReturnScroll from '@/components/dashboard/DashboardReturnScroll'
import DashboardTour from '@/components/dashboard/DashboardTour'
import InterestsOnboarding from '@/components/dashboard/InterestsOnboarding'
import LandingMessagesAlert from '@/components/dashboard/LandingMessagesAlert'
import BachecaMessagesAlert from '@/components/dashboard/BachecaMessagesAlert'
import ProArea from '@/components/dashboard/ProArea'
import ReviewInviteCard from '@/components/reviews/ReviewInviteCard'
import { getMyReviewOptions } from '@/app/actions/reviews'
import ProTeaser from '@/components/dashboard/ProTeaser'
import { getProAreaStats } from '@/lib/proAreaStats'
import UpcomingAgenda from '@/components/agenda/UpcomingAgenda'
import { loadAgenda } from '@/lib/agenda-server'
import WellnessTodayCard from '@/components/ecosystem/WellnessTodayCard'
import type { WellnessToday } from '@/app/actions/ecosystem'
import { addDays, todayKey } from '@/lib/agenda'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getPlanPrices } from '@/lib/planPrices'
import { getServicesCatalog } from '@/lib/servicesCatalog'
import type { MyProfile } from '@/lib/myProfile'
import GiftWelcomeDashboard from '@/components/gifts/GiftWelcomeDashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [marketplaceT, supabase] = await Promise.all([getTranslations('marketplace'), createClient()])

  // 1. Verifica autenticazione
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/${locale}/login`)
  }

  // 2-3, 7-8. Richieste indipendenti tutte insieme (una alla volta la
  // dashboard impiegava secondi): ruolo admin, profilo completo (solo
  // tramite get_my_profile(): le colonne personali non sono leggibili
  // direttamente), messaggi non letti, piano e strumenti, preferiti.
  const [adminRole, { data: profile }, unreadMessagesCount, access, favoriteToolNames, { count: landingUnread }, reviewOptions, lateSponsor, planPrices, { data: giftWelcome }] = await Promise.all([
    hasAdminRole(supabase, user.id),
    supabase.rpc('get_my_profile').maybeSingle<MyProfile>(),
    getUnreadMessagesCount(user.id),
    getMarketplaceAccessState(supabase, user.id),
    getFavoriteToolNames(supabase, user.id),
    // Messaggi non letti dal modulo "Scrivimi" della propria Landing Page
    supabase.from('landing_messages').select('id', { count: 'exact', head: true }).eq('owner_id', user.id).is('read_at', null),
    // Recensioni: cosa può recensire (acquisti da almeno 7 giorni)
    getMyReviewOptions(),
    // Iscritto senza codice: può ancora indicare chi l'ha invitato
    getLateSponsorStatus(user.id),
    // Prezzi dei piani come li addebita Stripe (in cache per un'ora)
    getPlanPrices(),
    // Arrivato con il regalo di un Pass e senza piano: dashboard essenziale
    supabase.rpc('my_gift_welcome'),
  ])
  const canReview = reviewOptions.some((option) => option.purchaseLabel && !option.review)
  const { userPlan, isSettingEnabled, isToolEnabled, requiredPlan } = access
  const userIsAdmin = adminRole || profile?.is_admin === true

  // Promemoria di rinnovo: mostrato ogni volta che entra in dashboard negli
  // ultimi 15 giorni prima della scadenza (a differenza del popup qualifiche,
  // qui non c'è "vista una volta" — è un promemoria di pagamento, deve
  // ripresentarsi finché non rinnova).
  let renewalDaysLeft: number | null = null
  if (profile?.subscription_status === 'active' && profile?.subscription_expires_at) {
    const msLeft = new Date(profile.subscription_expires_at).getTime() - new Date().getTime()
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24))
    if (daysLeft >= 0 && daysLeft <= 15) renewalDaysLeft = daysLeft
  }

  // 6. URL di condivisione
  const shareUrl = `${SITE_URL}/${locale}/ref/${profile?.referral_code}`

  // Prezzo del piano Base come lo addebita Stripe (lo stesso del pagamento),
  // per il pulsante "Abbonati ora"
  const formatEur = (value: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value)
  const basePrice = formatEur(planPrices.base)

  // Strumenti attivi e piano dell'utente (Area Professionisti e categorie)
  const enabledTools = getMarketplaceTools(marketplaceT).filter((tool) => isSettingEnabled(tool.toolName))
  const proTools = enabledTools.filter((tool) => requiredPlan(tool.toolName) === 'pro')
  const isPro = userPlan === 'pro'

  // Area Professionisti: dati dell'attività, giorni di prova rimasti o data di rinnovo
  let proAreaStats: Awaited<ReturnType<typeof getProAreaStats>> = {}
  let proRenewsOn: string | null = null
  // Prova Pro in corso (non ancora pagato): giorni rimasti, scadenza, prezzo.
  type ProTrial = { daysLeft: number; totalDays: number; endsOn: string; price: number }
  let proTrial: ProTrial | null = null
  const paidPro = profile?.subscription_status === 'active' && profile?.subscription_plan === 'pro'
  const trialEnd = profile?.pro_trial_ends_at ? new Date(profile.pro_trial_ends_at).getTime() : 0
  const nowMs = new Date().getTime()
  // Prova finita senza passare a Pro: l'invito in dashboard lo dice.
  const proTrialExpired = !isPro && trialEnd > 0 && trialEnd <= nowMs
  const loadProTrial = async (): Promise<ProTrial> => {
    const { data: planSettings } = await createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
      .from('system_settings')
      .select('key, value')
      .in('key', ['pro_trial_days'])
    const setting = (key: string, fallback: number) =>
      Number(String(planSettings?.find((row) => row.key === key)?.value ?? fallback).replace(/"/g, '')) || fallback
    return {
      daysLeft: Math.ceil((trialEnd - nowMs) / (1000 * 60 * 60 * 24)),
      totalDays: setting('pro_trial_days', 15),
      endsOn: new Date(trialEnd).toLocaleDateString(locale),
      price: (await getPlanPrices()).pro,
    }
  }


  // "I prossimi giorni": appuntamenti, promemoria, bollette e scadenze dei
  // prossimi 7 giorni (più quelle scadute negli ultimi 60), dagli strumenti
  // che l'utente può usare.
  const agendaSources = {
    memolife: isToolEnabled('memolife'),
    spendly: isToolEnabled('spendly'),
    lifeCalendar: isToolEnabled('life-calendar'),
  }
  const agendaToday = todayKey()
  // Anche solo Kumani Garage (es. con il Pass): le scadenze dell'auto
  const hasAgenda = agendaSources.memolife || agendaSources.spendly || agendaSources.lifeCalendar || isToolEnabled('garage')

  // 4. Rete (serve il profilo), agenda, prova Pro e dati dell'Area
  //    Professionisti: anche queste insieme.
  const [network, agendaEvents, trial, stats, catalog, { data: wellnessToday }] = await Promise.all([
    // La dashboard mostra solo un riepilogo della rete (il dettaglio è in
    // /dashboard/rete), ma servono anche per i popup qualifiche/rinnovo.
    getDashboardNetworkData(supabase, user, profile, locale, { tree: false, claims: 'skip' }),
    hasAgenda
      ? loadAgenda(supabase, user.id, {
          from: agendaToday,
          to: addDays(agendaToday, 6),
          overdueSince: addDays(agendaToday, -60),
          sources: agendaSources,
          useReminders: true,
        })
      : Promise.resolve([]),
    isPro && !paidPro && trialEnd > nowMs ? loadProTrial() : Promise.resolve(null),
    isPro && proTools.length > 0 ? getProAreaStats(supabase, user.id) : Promise.resolve(null),
    // Tutti i servizi con lo stato per l'utente: preferiti, recenti e suggerimento
    getServicesCatalog(supabase, user.id, locale, { access, favorites: favoriteToolNames }),
    // «Il tuo benessere di oggi»: i tre passi e il bonus
    supabase.rpc('wellness_path_today'),
  ])
  const { newlyAchievedRank } = network
  // Bonus della rete: dopo aver mostrato la pagina
  await deferNetworkClaims(supabase)
  proTrial = trial
  if (stats) {
    proAreaStats = stats
    if (!proTrial && profile?.subscription_expires_at) {
      proRenewsOn = new Date(profile.subscription_expires_at).toLocaleDateString(locale)
    }
  }

  const firstAccess = (user.user_metadata ?? {}) as { tour_seen?: boolean; interests_seen?: boolean }
  const askInterests = !firstAccess.interests_seen && !firstAccess.tour_seen && favoriteToolNames.length === 0

  return (
    <div className="min-h-screen bg-[var(--background)]" suppressHydrationWarning>

      {newlyAchievedRank ? (
        <RankAchievementModal
          rankKey={newlyAchievedRank.key}
          labelKey={newlyAchievedRank.labelKey}
          color={newlyAchievedRank.color}
          vouchers={newlyAchievedRank.vouchers}
          blackPlusEvery={network.blackPlusEvery}
        />
      ) : renewalDaysLeft !== null && profile?.subscription_expires_at ? (
        <RenewalReminderModal expiresAt={profile.subscription_expires_at} daysLeft={renewalDaysLeft} />
      ) : (
        <AdminMessagePopup />
      )}

      <InstallAppPrompt />

      <AppHeader loaded={{ user, profile, isAdmin: userIsAdmin }} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <ActivityTracker userId={user.id} />
        <DashboardReturnScroll />

        {/* Iscritto senza codice: può ancora indicare chi l'ha invitato */}
        {lateSponsor.eligible && lateSponsor.until && <LateSponsorCard until={lateSponsor.until} />}

        {/* Invito ad attivare le notifiche push su questo dispositivo */}
        <PushInviteCard />

        {/* Messaggi non letti dalla Bacheca: in cima, prima di tutto */}
        {unreadMessagesCount > 0 && <BachecaMessagesAlert initialCount={unreadMessagesCount} />}
        {(landingUnread ?? 0) > 0 && <LandingMessagesAlert count={landingUnread ?? 0} />}

        {/* Invito a recensire chi ha acquistato e non l'ha ancora fatto */}
        {canReview && <ReviewInviteCard />}

        {giftWelcome === true ? (
          <GiftWelcomeDashboard firstName={profile?.first_name ?? null} services={catalog.items} passExpiry={access.passExpiresAt} />
        ) : (
          <>
            {isPro && proTools.length > 0 ? (
              <ProArea tools={proTools} stats={proAreaStats} trial={proTrial} renewsOn={proRenewsOn} favoriteToolNames={favoriteToolNames} />
            ) : (
              !isPro && proTools.length > 0 && <ProTeaser trialExpired={proTrialExpired} />
            )}

            <DashboardTipo2
              profile={profile}
              shareUrl={shareUrl}
              services={catalog.items}
              favoriteToolNames={favoriteToolNames}
              basePrice={basePrice}
              proTrialDaysLeft={proTrial?.daysLeft ?? null}
              wellness={wellnessToday ? <WellnessTodayCard initial={wellnessToday as WellnessToday} /> : null}
              agenda={hasAgenda ? <UpcomingAgenda events={agendaEvents} today={agendaToday} sources={agendaSources} /> : null}
            />
            {/* Primo accesso: prima "Cosa ti interessa?" (riempie i preferiti),
                poi il tour (una volta sola; si rivede dal Centro guide) */}
            {askInterests ? <InterestsOnboarding items={catalog.items} /> : <DashboardTour seen={firstAccess.tour_seen === true} />}
          </>
        )}
      </main>

      <ChatModalWrapper userId={user.id} />
      <ListingDetailModalWrapper />
    </div>
  )
}
