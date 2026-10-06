import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import CopyButton from '@/components/CopyButton'
import MatrixTree from '@/components/MatrixTree'
import SpilloverExplainer from '@/components/SpilloverExplainer'
import RankBadge from '@/components/RankBadge'
import KumaniPeople from '@/components/KumaniPeople'
import Leaderboard from '@/components/Leaderboard'
import { getDashboardNetworkData } from '@/lib/dashboardNetworkData'
import { rankProgress } from '@/lib/ranks'
import RankRequirements from '@/components/RankRequirements'
import { getMemberPasses } from '@/lib/memberPasses'
import { defaultLocale } from '../../../../../i18n'
import { TreePine, Star, Sparkles, Crown, Trophy, PartyPopper, UserPlus, CheckCircle2, Shuffle, Network, MessageCircle, Gift, Users } from 'lucide-react'
import NativeShareButton from '@/components/NativeShareButton'
import AppHeader from '@/components/nav/AppHeader'
import { getSessionProfile, getSessionUser, preloadSession } from '@/lib/session'

// Schede "Prossimi obiettivi": aspetto di ciascuna qualifica (soglie e testi dalle qualifiche della rete)
const GOALS = [
  { key: 'rising_star', Icon: Star, icon: 'text-yellow-500', levelKey: 'easy', card: 'from-green-50 to-emerald-50 border-green-200', chip: 'text-green-800 bg-green-200', track: 'bg-green-200', bar: 'from-green-500 to-emerald-500' },
  { key: 'shining_star', Icon: Sparkles, icon: 'text-blue-500', levelKey: 'medium', card: 'from-blue-50 to-indigo-50 border-blue-200', chip: 'text-blue-800 bg-blue-200', track: 'bg-blue-200', bar: 'from-blue-500 to-indigo-500' },
  { key: 'diamond_star', Icon: Crown, icon: 'text-purple-500', levelKey: 'hard', card: 'from-purple-50 to-fuchsia-50 border-purple-200', chip: 'text-purple-800 bg-purple-200', track: 'bg-purple-200', bar: 'from-purple-500 to-fuchsia-500' },
] as const

// The Tipo 2 dashboard's dedicated network area: everything Tipo 1 shows
// inline (KUMI, referral share, matrix, KUMANI lists, qualifications) lives
// here instead, reachable from the main dashboard's compact summary card.
export default async function DashboardRetePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('dashboard')
  const supabase = await createClient()

  // Utente letto una volta sola per la pagina e la sua intestazione
  preloadSession()
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login`)

  // Profilo completo (dati personali inclusi) solo tramite get_my_profile():
  // dal browser/sessione utente le colonne personali non sono più leggibili.
  const profile = await getSessionProfile()

  const network = await getDashboardNetworkData(supabase, user, profile, locale)
  const {
    rootNode,
    activeDownlineForTree,
    downlineError,
    totalDownline,
    maxDownlineDepth,
    sponsorData,
    directSponsored,
    directSponsorCount,
    activeKumani,
    pendingKumani,
    directSponsorInSpilloverCount,
    receivedKumani,
    receivedIds,
    currentRank,
    ranks,
    networkPointsEarned,
    networkActivations,
    loginUrl,
  } = network

  const shareUrl = `${SITE_URL}/${locale}/ref/${profile?.referral_code}`
  // Chi non ha ancora un piano ma usa un servizio con il Pass (anche regalato
  // da te): si vede nell'elenco, con un messaggio per scoprire gli altri servizi
  const passes = await getMemberPasses(pendingKumani.map((person) => person.id), user.id)
  const pendingWithPasses = pendingKumani.map((person) => ({ ...person, passes: passes.get(person.id) ?? [] }))
  const catalogUrl = `${SITE_URL}${locale === defaultLocale ? '' : `/${locale}`}/catalogo`

  // Qualifiche (badge) raggiunte, con i giorni dall'iscrizione: la data la
  // registra il database quando i Punti Community guadagnati superano la soglia.
  const { data: achievementRows } = await supabase.rpc('my_rank_achievements')
  const achievements = new Map(
    ((achievementRows ?? []) as { rank_key: string; achieved_at: string; days: number }[]).map((row) => [row.rank_key, row])
  )

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('yourNetwork')} icon={<Users className="h-5 w-5" />} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KUMI e codice invito */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.5fr]">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white px-5 pb-5 pt-6 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" />
            <p className="mb-4 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('yourSponsor')}</p>
            {sponsorData ? (
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-xl font-bold text-[var(--ink)] shadow-lg">
                  {sponsorData.first_name?.[0]}
                  {sponsorData.last_name?.[0] || ''}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xl font-bold text-[var(--ink)]">
                    {sponsorData.first_name} {sponsorData.last_name}
                  </p>
                  {sponsorData.referral_code && <p className="font-mono text-sm text-[var(--gold)]">{sponsorData.referral_code}</p>}
                  <p className="mt-1 text-xs text-[var(--muted)]">{t('sponsorHint')}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)] shadow-lg">
                  <Crown className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-lg font-bold text-[var(--ink)]">{t('nobody')}</p>
                  <p className="text-xs text-[var(--muted)]">{t('noSponsorHint')}</p>
                </div>
              </div>
            )}
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/45 bg-gradient-to-br from-[#26221c] to-[var(--ink)] p-6 text-white shadow-[0_18px_40px_rgba(23,23,23,0.25)]">
            <div aria-hidden className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-[var(--gold)]/15 blur-2xl" />
            <div className="relative flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold-bright)]">{t('yourReferralCode')}</p>
                <p className="mt-2 break-all font-mono text-3xl font-extrabold tracking-wider sm:text-4xl">{profile?.referral_code}</p>
              </div>
              {currentRank && <RankBadge rank={currentRank} />}
            </div>
            <div className="relative mt-5 flex gap-2">
              <input
                readOnly
                value={shareUrl}
                aria-label={t('yourReferralCode')}
                className="min-w-0 flex-1 rounded-lg border border-[var(--gold)]/35 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/60"
              />
              <CopyButton text={shareUrl} />
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(t('inviteShareMessage', { link: shareUrl }))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="relative mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] hover:brightness-110"
            >
              <MessageCircle className="h-4 w-4" /> {t('inviteShareWhatsapp')}
            </a>
            <NativeShareButton
              url={shareUrl}
              title="KUMANI"
              text={t('inviteShareMessage', { link: '' }).trim()}
              variant="glass"
              copyFallback={false}
              className="relative mt-2 w-full"
            />
          </div>
        </div>

        {/* Numeri della rete */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white px-5 pb-5 pt-6 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" />
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                <UserPlus className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('sponsoredLabel')}</p>
            </div>
            <p className="mt-3 text-4xl font-extrabold leading-none text-[var(--ink)]">{directSponsored.length}</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white px-5 pb-5 pt-6 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" />
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('activeLabel')}</p>
            </div>
            <p className="mt-3 text-4xl font-extrabold leading-none text-emerald-600">{directSponsorCount}</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white px-5 pb-5 pt-6 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" />
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                <Shuffle className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('spilloverLabel')}</p>
            </div>
            <p className="mt-3 text-4xl font-extrabold leading-none text-amber-600">{directSponsorInSpilloverCount}</p>
          </div>
          {/* Dalla community: invitati da altri Kumani, arrivati nella stella */}
          <div className="relative overflow-hidden rounded-2xl border border-sky-300/60 bg-white px-5 pb-5 pt-6 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 to-sky-300" />
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-950 text-sky-200">
                <Gift className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('receivedLabel')}</p>
            </div>
            <p className="mt-3 text-4xl font-extrabold leading-none text-sky-600">{receivedKumani.length}</p>
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white px-5 pb-5 pt-6 shadow-[0_10px_30px_rgba(23,23,23,0.08)]">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" />
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                <Network className="h-4.5 w-4.5" />
              </span>
              <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('totalDownline')}</p>
            </div>
            <p className="mt-3 text-4xl font-extrabold leading-none text-[var(--ink)]">{totalDownline}</p>
            <p className="mt-1.5 text-xs text-[var(--muted)]">
              {maxDownlineDepth > 0 ? t('downlineDepth', { depth: maxDownlineDepth }) : t('downlineDepthNone')}
            </p>
          </div>
        </div>

        {/* I tuoi KUMANI: attivi e non ancora attivi */}
        <KumaniPeople active={activeKumani} pending={pendingWithPasses} received={receivedKumani} senderName={profile?.first_name || ''} loginUrl={loginUrl} catalogUrl={catalogUrl} />

        {/* Matrice */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <TreePine className="h-6 w-6 text-[var(--gold)]" />
              {t('yourMatrix')}
            </h2>
            <span className="rounded-lg border border-[var(--gold)]/30 bg-[var(--gold-pale)] px-3 py-1.5 text-xs font-medium text-[var(--ink-soft)]">
              {t('directPositions')}
            </span>
          </div>
          {downlineError ? (
            <p className="text-red-500 text-center py-8">
              {t('matrixError')}: {downlineError.message}
            </p>
          ) : (
            <MatrixTree rootNode={rootNode} descendants={activeDownlineForTree} receivedIds={receivedIds} />
          )}
        </div>

        <SpilloverExplainer />

        {/* Classifica & Prossimi obiettivi */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Leaderboard currentUserId={user.id} />
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            {t('nextGoals')}
          </h2>
          <div className="space-y-4">
            {GOALS.map((goal) => {
              const rank = ranks.find((r) => r.key === goal.key)!
              const achievement = achievements.get(goal.key)
              const Icon = goal.Icon
              return (
                <div key={goal.key}>
                  {achievement && (
                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-3 py-2 text-sm font-bold text-[var(--ink)] shadow-sm">
                      <PartyPopper className="h-5 w-5 shrink-0" />
                      <span>
                        {t('goalReachedIn', { days: achievement.days })}
                        <span className="ml-1 font-medium opacity-75">
                          · {new Date(achievement.achieved_at).toLocaleDateString(locale)}
                        </span>
                      </span>
                    </div>
                  )}
                  <div className={`p-4 bg-gradient-to-r ${goal.card} rounded-lg border ${achievement ? 'ring-2 ring-[var(--gold)]/60' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`w-8 h-8 ${goal.icon}`} />
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${goal.chip}`}>{t(goal.levelKey)}</span>
                    </div>
                    <p className="font-bold text-gray-900 mb-1">{t(rank.labelKey)}</p>
                    <p className="text-sm text-gray-600 mb-2">{t(rank.descriptionKey, { acts: rank.activations, points: rank.points, vouchers: rank.vouchers })}</p>
                    <div className={`w-full rounded-full h-2.5 ${goal.track}`}>
                      <div
                        className={`bg-gradient-to-r ${goal.bar} h-2.5 rounded-full`}
                        style={{ width: `${achievement ? 100 : rankProgress(rank, networkActivations, networkPointsEarned)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 font-medium">
                      <RankRequirements rank={rank} activations={networkActivations} points={networkPointsEarned} />
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        </div>

      </main>
    </div>
  )
}
