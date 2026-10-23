import SurpriseRepliesPopup from '@/components/surprise/SurpriseRepliesPopup'
import { getUnreadReplies } from '@/lib/surpriseReplies'
import SurpriseDashboardCard from '@/components/surprise/SurpriseDashboardCard'
import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import AppHeader from '@/components/nav/AppHeader'
import ActivityTracker from '@/components/ActivityTracker'
import ChatModalWrapper from '@/components/ChatModalWrapper'
import ListingDetailModalWrapper from '@/components/ListingDetailModalWrapper'
import { getUnreadMessagesCount } from '@/lib/listings-server'
import RankAchievementModal from '@/components/RankAchievementModal'
import RenewalReminderModal from '@/components/RenewalReminderModal'
import AdminMessagePopup from '@/components/AdminMessagePopup'
import { hasAdminRole } from '@/lib/admin-auth'
import { deferNetworkClaims, getDashboardNetworkData } from '@/lib/dashboardNetworkData'
import { getMarketplaceAccessState } from '@/lib/marketplaceAccess'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getFavoriteToolNames } from '@/lib/favorites'
import DashboardTipo2 from '@/components/dashboard/DashboardTipo2'
import { getKarmaToday } from '@/lib/karmaToday'
import LateSponsorCard from '@/components/dashboard/LateSponsorCard'
import PushInviteCard from '@/components/dashboard/PushInviteCard'
import { getLateSponsorStatus } from '@/lib/lateSponsor'
import DashboardReturnScroll from '@/components/dashboard/DashboardReturnScroll'
import PendingReceiptClaim from '@/components/receipts/PendingReceiptClaim'
import DashboardTour from '@/components/dashboard/DashboardTour'
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
import { getCommunityItems, getServicesCatalog } from '@/lib/servicesCatalog'
import { COMMUNITY_FOLDER, communityAsService } from '@/lib/communityItems'
import type { MyProfile } from '@/lib/myProfile'
import GiftWelcomeDashboard from '@/components/gifts/GiftWelcomeDashboard'
import DashboardNeeds from '@/components/dashboard/DashboardNeeds'
import VerifiedInviteCard from '@/components/verification/VerifiedInviteCard'
import { buildHomeNeeds } from '@/lib/homeNeedsServer'
import { HOME_NEEDS } from '@/lib/homeNeeds'
import WelcomeHome, { ShowFullHomeLink } from '@/components/dashboard/WelcomeHome'
import ChristmasOfferBanner from '@/components/christmas/ChristmasOfferBanner'
import { getToolUsage, getWelcomeState, VERIFIED_AFTER_LOGINS } from '@/lib/welcomeHome'
import { resolveHomeFolders, resolveHomeView } from '@/lib/homeView'
import { SERVICE_HUBS } from '@/lib/serviceHubs'
import IconHome from '@/components/dashboard/IconHome'
import { getInviteUrl } from '@/lib/shareLinksServer'
import { after } from 'next/server'
import { canSeeSolve } from '@/lib/solve/server'
import SolveEntryCard from '@/components/solve/SolveEntryCard'
import FounderCard from '@/components/founders/FounderCard'
import { grantFounderIfEligible } from '@/lib/founders'

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

  // Profilo, rete e «Il tuo benessere di oggi» partono subito: la rete usa
  // il profilo solo dopo le sue letture (gli passa la promessa).
  const profilePromise = Promise.resolve(
    supabase
      .rpc('get_my_profile')
      .maybeSingle<MyProfile>()
      .then(({ data }) => data ?? null)
  )
  // La dashboard mostra solo un riepilogo della rete (il dettaglio è in
  // /dashboard/rete), ma servono anche per i popup qualifiche/rinnovo.
  const networkPromise = getDashboardNetworkData(supabase, user, profilePromise, locale, { tree: false, claims: 'skip' })
  const wellnessPromise = Promise.resolve(supabase.rpc('wellness_path_today').then((r) => r))
  // KU Karma di oggi: non dipende da niente, parte subito
  const karmaPromise = getKarmaToday(supabase, user.id).catch(() => null)
  // Se la pagina fallisce prima di attenderle, niente errori non gestiti
  networkPromise.catch(() => {})
  wellnessPromise.catch(() => {})

  // 2-3, 7-8. Richieste indipendenti tutte insieme (una alla volta la
  // dashboard impiegava secondi): ruolo admin, profilo completo (solo
  // tramite get_my_profile(): le colonne personali non sono leggibili
  // direttamente), messaggi non letti, piano e strumenti, preferiti.
  const [adminRole, profile, unreadMessagesCount, access, favoriteToolNames, { count: landingUnread }, reviewOptions, lateSponsor, planPrices, { data: giftWelcome }, surpriseReplies] = await Promise.all([
    hasAdminRole(supabase, user.id),
    profilePromise,
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
    // KUMANI Sorpresa: ringraziamenti non ancora letti (popup)
    getUnreadReplies(supabase),
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
  // Link d'invito corto (kumani.io/i/CODICE), sempre lo stesso per il Kumano
  const shareUrl = await getInviteUrl(user.id, `${SITE_URL}/${locale}/ref/${profile?.referral_code}`)

  // Prezzo del piano Plus come lo addebita Stripe (lo stesso del pagamento),
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


  // Fascia «Oggi»: appuntamenti, promemoria, bollette e scadenze dei
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

  // 4. Rete (già partita), agenda, prova Pro e dati dell'Area
  //    Professionisti: anche queste insieme.
  const [network, agendaEvents, trial, stats, catalog, { data: wellnessToday }, karmaToday, welcomeState, communityItems] = await Promise.all([
    networkPromise,
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
    // «Il tuo momento di benessere»: passi, umore, cose belle e KU Karma
    wellnessPromise,
    // KU Karma presi oggi (accesso e servizi), accanto ai KU Karma
    karmaPromise,
    // Home di benvenuto (primi passi) e accessi (per «Diventa Kumano verificato»)
    getWelcomeState({
      userId: user.id,
      createdAt: profile?.created_at,
      metadata: user.user_metadata,
      favoritesCount: favoriteToolNames.length,
      // Tutti i nuovi iscritti, qualunque piano: anche i primi 50 con il Plus
      free: true,
    }).catch(() => null),
    // Sezioni della Community: anche loro come icone e preferiti della Home
    getCommunityItems(supabase, user.id, access).catch(() => []),
  ])
  // Servizi per la Home (preferiti, icone, «Aggiungi»): anche la Community
  const homeItems = [...catalog.items, ...communityItems.map(communityAsService)]
  const { newlyAchievedRank } = network
  // «In cosa possiamo darti una mano?»: qui i servizi portano allo strumento
  const serviceHref = new Map(catalog.items.map((item) => [item.toolName, item.href]))
  const [needs, needsT] = await Promise.all([
    buildHomeNeeds((name) => serviceHref.get(name) ?? `/strumenti/${name}`),
    getTranslations('homeNeeds'),
  ])
  // Bonus della rete: dopo aver mostrato la pagina
  await deferNetworkClaims(supabase)
  // Kumani Fondatori: un posto (e il Plus in regalo) a chi ne ha diritto
  after(() => grantFounderIfEligible(user.id).catch((e) => console.error('[fondatori]', e)))
  proTrial = trial
  if (stats) {
    proAreaStats = stats
    if (!proTrial && profile?.subscription_expires_at) {
      proRenewsOn = new Date(profile.subscription_expires_at).toLocaleDateString(locale)
    }
  }

  // «Diventa Kumano verificato» dopo 7 accessi: vuol dire che usa KUMANI
  const showVerified = (welcomeState?.loginDays ?? 0) >= VERIFIED_AFTER_LOGINS
  const proPrice = formatEur(planPrices.pro)

  // Vista della Home: Lite (i nuovi Gratis partono da qui), Completa o Icone
  const view = resolveHomeView(user.user_metadata, welcomeState?.newcomer ?? false)
  // Home di benvenuto: «Inizia da qui», servizi pronti da provare in riquadri
  // quadrati (Bacheca, Convivium, Manuale, I tuoi dati, Check-up, Respira, Fabula)
  const welcomeOn = view === 'lite' && !!welcomeState?.show
  const WELCOME_QUICK = ['community-listings', 'convivium', 'antitruffa', 'scudo-dati', 'fincheck', 'oxygen', 'fabula']
  const welcomeQuick = welcomeOn
    ? WELCOME_QUICK.map((name) => homeItems.find((item) => item.toolName === name))
        .filter((item) => !!item)
        .map((item) => ({ toolName: item.toolName, href: item.href, iconName: item.iconName, open: item.open }))
    : []
  let iconHome: React.ReactNode = null
  if (view === 'icons') {
    const [usage, hubT] = await Promise.all([getToolUsage(user.id).catch(() => ({})), getTranslations('hub')])
    // Pallini: impegni di oggi (e scaduti) nell'agenda, bollette da pagare in Spendly
    const pending = agendaEvents.filter((event) => !event.done && event.date <= agendaToday)
    const badges: Record<string, number> = {}
    const bills = pending.filter((event) => event.kind === 'bill').length
    const others = pending.length - bills
    if (bills) badges.spendly = bills
    if (others) badges[agendaSources.memolife ? 'memolife' : 'life-calendar'] = others
    const subscribedNow = profile?.subscription_status === 'active'
    const planLabel = subscribedNow
      ? `${hubT('stripPlan')} ${profile?.subscription_plan === 'pro' ? 'Pro' : 'Plus'}`
      : proTrial
        ? `${hubT('stripPlan')} Pro`
        : `${hubT('stripPlan')} ${hubT('stripFree')}`
    iconHome = (
      <IconHome
        firstName={profile?.first_name ?? null}
        dateLabel={new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
        karma={profile?.daily_points ?? 0}
        planLabel={planLabel}
        items={homeItems}
        usage={usage}
        favorites={favoriteToolNames}
        badges={badges}
        folders={resolveHomeFolders(user.user_metadata, [...SERVICE_HUBS, COMMUNITY_FOLDER])}
        // Calendario sempre visibile dopo «Aggiungi»: il giorno di oggi (ora
        // italiana, come la fascia «Oggi») e l'agenda che la persona può aprire
        calendar={{
          day: Number(agendaToday.slice(8, 10)),
          weekday: new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${agendaToday}T12:00:00Z`)).replace('.', ''),
          href: agendaSources.memolife ? '/marketplace/memolife' : agendaSources.lifeCalendar ? '/marketplace/life-calendar' : '/marketplace/memolife',
        }}
      />
    )
  }

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


      <AppHeader loaded={{ user, profile, isAdmin: userIsAdmin }} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <ActivityTracker userId={user.id} />
        <DashboardReturnScroll />
        {/* Ricevuta da salvare dopo la registrazione partita dalla ricevuta */}
        <PendingReceiptClaim />
        {/* Offerta di Natale (Admin → Natale), solo quando è accesa */}
        <ChristmasOfferBanner subscribed={profile?.subscription_status === 'active'} />

        {surpriseReplies.total > 0 && <SurpriseRepliesPopup replies={surpriseReplies.items} total={surpriseReplies.total} />}
        {giftWelcome === true ? (
          <>
            {unreadMessagesCount > 0 && <BachecaMessagesAlert initialCount={unreadMessagesCount} />}
            {(landingUnread ?? 0) > 0 && <LandingMessagesAlert count={landingUnread ?? 0} />}
            {lateSponsor.eligible && lateSponsor.until && <LateSponsorCard until={lateSponsor.until} />}
            <PushInviteCard />
            {canReview && <ReviewInviteCard />}
            <GiftWelcomeDashboard firstName={profile?.first_name ?? null} services={catalog.items} passExpiry={access.passExpiresAt} />
          </>
        ) : (
          <>
            {/* In cima la riga di stato, poi «Oggi» e «In cosa possiamo darti
                una mano?»; inviti, Area Professionisti e Sorpresa dopo */}
            <DashboardTipo2
              profile={profile}
              shareUrl={shareUrl}
              services={homeItems}
              favoriteToolNames={favoriteToolNames}
              basePrice={basePrice}
              proTrialDaysLeft={proTrial?.daysLeft ?? null}
              karmaToday={karmaToday}
              wellness={wellnessToday ? <WellnessTodayCard initial={wellnessToday as WellnessToday} /> : null}
              agenda={hasAgenda ? <UpcomingAgenda events={agendaEvents} today={agendaToday} sources={agendaSources} /> : null}
              needs={
                <DashboardNeeds
                  needs={needs}
                  texts={{ title: needsT('title'), hint: needsT('dashHint'), open: needsT('dashOpen'), hide: needsT('dashHide') }}
                />
              }
              afterStatus={
                <>
                  {/* Promozione di lancio: «Sei tra i primi 50» */}
                  <FounderCard userId={user.id} />
                {(unreadMessagesCount > 0 || (landingUnread ?? 0) > 0) && (
                  <>
                    {/* Messaggi non letti dalla Bacheca e dalla Landing */}
                    {unreadMessagesCount > 0 && <BachecaMessagesAlert initialCount={unreadMessagesCount} />}
                    {(landingUnread ?? 0) > 0 && <LandingMessagesAlert count={landingUnread ?? 0} />}
                  </>
                )}
                </>
              }
              proPrice={proPrice}
              welcome={
                view === 'lite' && welcomeState?.show ? (
                  <WelcomeHome
                    firstName={profile?.first_name ?? null}
                    needs={needs
                      .map((need) => ({
                        key: need.key,
                        icon: need.icon,
                        short: need.short,
                        intro: need.intro,
                        // Tutti i servizi della voce, uno per uno (anche quelli dei servizi uniti)
                        services: [...new Set((HOME_NEEDS.find((n) => n.key === need.key)?.items ?? []) as readonly string[])]
                          .map((name) => homeItems.find((item) => item.toolName === name))
                          .filter((item) => !!item)
                          .map((item) => ({ toolName: item.toolName, title: item.title, description: item.description, iconName: item.iconName, href: item.href, plan: item.plan, open: item.open })),
                      }))
                      .filter((need) => need.services.length > 0)}
                    picked={welcomeState.needs}
                    favorites={favoriteToolNames}
                    quick={welcomeQuick}
                    solve={welcomeOn && (await canSeeSolve())}
                  />
                ) : null
              }
              view={view}
              iconHome={iconHome}
              welcomeFooter={view === 'lite' && welcomeState?.show ? <ShowFullHomeLink /> : null}
              solveEntry={<SolveEntryCard />}
              invites={
                <>
                  {/* Iscritto senza codice: può ancora indicare chi l'ha invitato */}
                  {lateSponsor.eligible && lateSponsor.until && <LateSponsorCard until={lateSponsor.until} />}
                  {/* Invito a diventare «Kumano verificato» (segno accanto al nome), dopo 7 accessi */}
                  {showVerified && <VerifiedInviteCard />}
                  {/* Invito ad attivare le notifiche push su questo dispositivo */}
                  <PushInviteCard />
                  {/* Invito a recensire chi ha acquistato e non l'ha ancora fatto */}
                  {canReview && <ReviewInviteCard />}
                </>
              }
              proBlock={
                isPro && proTools.length > 0 ? (
                  <ProArea tools={proTools} stats={proAreaStats} trial={proTrial} renewsOn={proRenewsOn} favoriteToolNames={favoriteToolNames} />
                ) : (
                  // Invito al Pro solo a chi è Gratis: chi ha il Plus ha già «Passa a Pro» in cima
                  userPlan === 'none' && proTools.length > 0 && <ProTeaser trialExpired={proTrialExpired} />
                )
              }
              // KUMANI Sorpresa: regalare un'esperienza (buono o percorso)
              extras={<SurpriseDashboardCard />}
            />
            {/* Tour di 6 passi: non parte più da solo (al suo posto i «primi
                3 passi»); si rivede dal Centro guide con ?tour=1 */}
            <DashboardTour seen />
          </>
        )}
      </main>

      <ChatModalWrapper userId={user.id} />
      <ListingDetailModalWrapper />
    </div>
  )
}
