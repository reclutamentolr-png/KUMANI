import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import DashboardHeaderActions from '@/components/DashboardHeaderActions'
import ActivityTracker from '@/components/ActivityTracker'
import ChatModalWrapper from '@/components/ChatModalWrapper'
import ListingDetailModalWrapper from '@/components/ListingDetailModalWrapper'
import { getUnreadMessagesCount } from '@/lib/listings-server'
import InstallAppPrompt from '@/components/InstallAppPrompt'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import RankAchievementModal from '@/components/RankAchievementModal'
import RenewalReminderModal from '@/components/RenewalReminderModal'
import AdminMessagePopup from '@/components/AdminMessagePopup'
import { hasAdminRole } from '@/lib/admin-auth'
import { deferNetworkClaims, getDashboardNetworkData } from '@/lib/dashboardNetworkData'
import { getMarketplaceAccessState } from '@/lib/marketplaceAccess'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getFavoriteToolNames } from '@/lib/favorites'
import DashboardTipo2 from '@/components/dashboard/DashboardTipo2'
import QuickNav from '@/components/QuickNav'
import BachecaMessagesAlert from '@/components/dashboard/BachecaMessagesAlert'
import ProArea from '@/components/dashboard/ProArea'
import ProTeaser from '@/components/dashboard/ProTeaser'
import { getProAreaStats } from '@/lib/proAreaStats'
import UpcomingAgenda from '@/components/agenda/UpcomingAgenda'
import { loadAgenda } from '@/lib/agenda-server'
import { addDays, todayKey } from '@/lib/agenda'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getPlanPrices } from '@/lib/planPrices'
import { freeFirst } from '@/lib/freeFirst'
import type { MyProfile } from '@/lib/myProfile'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('dashboard')
  const marketplaceT = await getTranslations('marketplace')
  const supabase = await createClient()

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
  const [adminRole, { data: profile }, unreadMessagesCount, access, favoriteToolNames] = await Promise.all([
    hasAdminRole(supabase, user.id),
    supabase.rpc('get_my_profile').maybeSingle<MyProfile>(),
    getUnreadMessagesCount(user.id),
    getMarketplaceAccessState(supabase, user.id),
    getFavoriteToolNames(supabase, user.id),
  ])
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
  const basePrice = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(
    (await getPlanPrices()).base
  )

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

  // Chi è Pro trova gli strumenti Pro nell'Area Professionisti: non si
  // ripetono nelle categorie sotto.
  // I servizi gratuiti vengono per primi in ogni categoria.
  const visibleTools = freeFirst(
    isPro ? enabledTools.filter((tool) => requiredPlan(tool.toolName) !== 'pro') : enabledTools,
    (tool) => requiredPlan(tool.toolName) === 'free'
  )
  // Admin-enabled but not usable by THIS user (no active subscription) —
  // shown locked instead of silently hidden, same distinction the
  // marketplace category grid already makes via MarketplaceCard.
  const lockedToolNames = visibleTools.filter((tool) => !isToolEnabled(tool.toolName)).map((tool) => tool.toolName)
  const proToolNames = visibleTools.filter((tool) => requiredPlan(tool.toolName) === 'pro').map((tool) => tool.toolName)
  const freeToolNames = visibleTools.filter((tool) => requiredPlan(tool.toolName) === 'free').map((tool) => tool.toolName)

  // "I prossimi giorni": appuntamenti, promemoria, bollette e scadenze dei
  // prossimi 7 giorni (più quelle scadute negli ultimi 60), dagli strumenti
  // che l'utente può usare.
  const agendaSources = {
    memolife: isToolEnabled('memolife'),
    spendly: isToolEnabled('spendly'),
    lifeCalendar: isToolEnabled('life-calendar'),
  }
  const agendaToday = todayKey()
  const hasAgenda = agendaSources.memolife || agendaSources.spendly || agendaSources.lifeCalendar

  // 4. Rete (serve il profilo), agenda, prova Pro e dati dell'Area
  //    Professionisti: anche queste insieme.
  const [network, agendaEvents, trial, stats] = await Promise.all([
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

  return (
    <div className="min-h-screen bg-[var(--background)]" suppressHydrationWarning>

      {newlyAchievedRank ? (
        <RankAchievementModal
          rankKey={newlyAchievedRank.key}
          labelKey={newlyAchievedRank.labelKey}
          descriptionKey={newlyAchievedRank.descriptionKey}
          icon={newlyAchievedRank.icon}
          threshold={newlyAchievedRank.threshold}
        />
      ) : renewalDaysLeft !== null && profile?.subscription_expires_at ? (
        <RenewalReminderModal expiresAt={profile.subscription_expires_at} daysLeft={renewalDaysLeft} />
      ) : (
        <AdminMessagePopup />
      )}

      <InstallAppPrompt />

      {/* Header */}
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] shadow-[0_8px_30px_rgba(23,23,23,0.18)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="hidden text-2xl font-bold tracking-tight text-white sm:block">{t('programTitle')}</h1>
          <h1 className="text-xl font-bold tracking-tight text-white sm:hidden">Kumani</h1>

          <div className="flex items-center gap-3">
            <LanguageSwitcher dark />
            <DashboardHeaderActions user={user} profile={profile} isAdmin={userIsAdmin} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <ActivityTracker userId={user.id} />

        {/* Messaggi non letti dalla Bacheca: in cima, prima di tutto */}
        {unreadMessagesCount > 0 && <BachecaMessagesAlert initialCount={unreadMessagesCount} />}

        {isPro && proTools.length > 0 ? (
          <ProArea tools={proTools} stats={proAreaStats} trial={proTrial} renewsOn={proRenewsOn} favoriteToolNames={favoriteToolNames} />
        ) : (
          !isPro && proTools.length > 0 && <ProTeaser trialExpired={proTrialExpired} />
        )}

        <DashboardTipo2
          profile={profile}
          shareUrl={shareUrl}
          visibleTools={visibleTools}
          lockedToolNames={lockedToolNames}
          proToolNames={proToolNames}
          freeToolNames={freeToolNames}
          basePrice={basePrice}
          favoriteToolNames={favoriteToolNames}
          proTrialDaysLeft={proTrial?.daysLeft ?? null}
          agenda={hasAgenda ? <UpcomingAgenda events={agendaEvents} today={agendaToday} sources={agendaSources} /> : null}
          network={network}
        />
        <QuickNav current="dashboard" />
      </main>

      <ChatModalWrapper userId={user.id} />
      <ListingDetailModalWrapper />
    </div>
  )
}
