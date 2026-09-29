import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import CopyButton from '@/components/CopyButton'
import MatrixTree from '@/components/MatrixTree'
import SpilloverExplainer from '@/components/SpilloverExplainer'
import RankBadge from '@/components/RankBadge'
import DirectAffiliatesList from '@/components/DirectAffiliatesList'
import NotYetKumaniList from '@/components/NotYetKumaniList'
import Leaderboard from '@/components/Leaderboard'
import { getDashboardNetworkData } from '@/lib/dashboardNetworkData'
import { ArrowLeft, TreePine, Star, Sparkles, Crown, Trophy, Wallet, PartyPopper } from 'lucide-react'
import { RANKS } from '@/lib/ranks'

// Schede "Prossimi obiettivi": aspetto di ciascuna qualifica (soglie e testi da RANKS)
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

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  // Profilo completo (dati personali inclusi) solo tramite get_my_profile():
  // dal browser/sessione utente le colonne personali non sono più leggibili.
  const { data: profile } = await supabase.rpc('get_my_profile').maybeSingle<Record<string, any>>()

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
    currentRank,
    loginUrl,
  } = network

  const shareUrl = `${SITE_URL}/${locale}/ref/${profile?.referral_code}`

  // Qualifiche raggiunte, con i giorni dall'iscrizione (registrate alla
  // prima visita dopo il raggiungimento, con la data ricostruita).
  const { data: achievementRows } = await supabase.rpc('my_rank_achievements')
  const achievements = new Map(
    ((achievementRows ?? []) as { rank_key: string; achieved_at: string; days: number }[]).map((row) => [row.rank_key, row])
  )

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] shadow-[0_8px_30px_rgba(23,23,23,0.18)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-white">{t('yourNetwork')}</h1>
          <Link
            href="/wallet"
            className="flex items-center gap-1.5 rounded-lg border border-[var(--gold)]/45 bg-black px-3 py-1.5 text-sm font-semibold text-[var(--gold-bright)] shadow-sm transition-colors hover:bg-[var(--gold)]/10"
          >
            <Wallet className="h-4 w-4" />
            <span className="hidden sm:inline">{t('myWallet')}</span>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* KUMI + referral */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6 shadow-sm">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('yourSponsor')}</p>
            {sponsorData ? (
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--gold)] shadow-lg">
                  <span className="text-white font-bold text-lg">
                    {sponsorData.first_name?.[0]}
                    {sponsorData.last_name?.[0] || ''}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[var(--ink)] truncate">
                    {sponsorData.first_name} {sponsorData.last_name}
                  </p>
                  {sponsorData.referral_code && <p className="font-mono text-xs text-[var(--gold)]">{sponsorData.referral_code}</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[var(--muted)]">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-lg">-</span>
                </div>
                <p className="text-sm">{t('nobody')}</p>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-[var(--gold)]/45 bg-[var(--ink)] p-6 shadow-sm text-white">
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-stone-300">{t('yourReferralCode')}</p>
            <div className="flex items-center justify-between gap-3">
              <p className="text-2xl sm:text-3xl font-mono font-bold tracking-wider">{profile?.referral_code}</p>
              {currentRank && <RankBadge rank={currentRank} />}
            </div>
            <div className="mt-4 flex gap-2">
              <input
                readOnly
                value={shareUrl}
                className="flex-1 rounded-lg border border-[var(--gold)]/35 bg-white/10 px-3 py-2 text-sm text-white placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/60"
              />
              <CopyButton text={shareUrl} />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] p-5 shadow-sm">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-2xl font-bold text-[var(--ink)]">{directSponsored.length}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('sponsoredLabel')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-emerald-600">{directSponsorCount}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('activeLabel')}</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{directSponsorInSpilloverCount}</p>
                <p className="text-[10px] uppercase tracking-wide text-gray-400">{t('spilloverLabel')}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] p-5 shadow-sm">
            <p className="mb-1 text-sm text-[var(--muted)]">{t('totalDownline')}</p>
            <p className="text-2xl font-bold text-[var(--ink)]">{totalDownline}</p>
            <p className="text-xs text-gray-400 mt-1">
              {maxDownlineDepth > 0 ? t('downlineDepth', { depth: maxDownlineDepth }) : t('downlineDepthNone')}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--gold-pale)] p-5 shadow-sm">
            <p className="mb-1 text-sm text-[var(--ink-soft)] font-medium">{t('directAffiliates')}</p>
            <p className="text-2xl font-bold text-[var(--ink)]">{directSponsorCount}</p>
          </div>
        </div>

        {/* KUMANI lists */}
        <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6 shadow-sm">
          <DirectAffiliatesList people={activeKumani} variant="light" />
          <NotYetKumaniList people={pendingKumani} senderName={profile?.first_name || ''} loginUrl={loginUrl} variant="light" />
        </div>

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
            <MatrixTree rootNode={rootNode} descendants={activeDownlineForTree} />
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
              const rank = RANKS.find((r) => r.key === goal.key)!
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
                    <p className="text-sm text-gray-600 mb-2">{t(rank.descriptionKey)}</p>
                    <div className={`w-full rounded-full h-2.5 ${goal.track}`}>
                      <div
                        className={`bg-gradient-to-r ${goal.bar} h-2.5 rounded-full`}
                        style={{ width: `${achievement ? 100 : Math.min((directSponsorCount / rank.threshold) * 100, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2 font-medium">
                      {directSponsorCount}/{rank.threshold} {t('affiliates')}
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
