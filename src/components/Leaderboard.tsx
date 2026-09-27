'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Trophy, Medal, Award, Crown, TrendingUp } from 'lucide-react'
import { isActiveSubscription } from '@/lib/subscriptionGate'

type LeaderboardProps = {
  currentUserId: string
}

type LeaderboardEntry = {
  id: string
  first_name: string
  last_name: string
  referral_code: string
  direct_active_count: number
  network_active_count: number
}


export default function Leaderboard({ currentUserId }: LeaderboardProps) {
  const t = useTranslations('dashboard')
  const [allEntries, setAllEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userRank, setUserRank] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'top10' | 'top100'>('top10')
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadLeaderboard()
  }, [currentUserId])

  const loadLeaderboard = async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Recupera tutti i profili
      let { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, referral_code, sponsor_id, subscription_status, subscription_expires_at')

      if (profilesError) {
        // subscription_expires_at may not exist yet on this database (same
        // defensive fallback used in marketplace/page.tsx).
        const fallback = await supabase
          .from('profiles')
          .select('id, first_name, last_name, referral_code, sponsor_id, subscription_status')
        profiles = fallback.data?.map(p => ({ ...p, subscription_expires_at: null })) ?? null
        profilesError = fallback.error
      }

      // 2. Recupera tutti i nodi della matrice
      const { data: allNodes, error: nodesError } = await supabase
        .from('matrix_nodes')
        .select('id, user_id, path')

      if (profilesError) {
        setError(`${t('matrixProfilesError')}: ${profilesError.message}`)
        return
      }

      if (nodesError) {
        setError(`${t('matrixNodesError')}: ${nodesError.message} (Code: ${nodesError.code})`)
        return
      }

      if (!profiles || profiles.length === 0) {
        setError(t('noProfiles'))
        return
      }

      if (!allNodes || allNodes.length === 0) {
        setError(t('noMatrixNodes'))
        return
      }

      // Crea una mappa user_id -> path e una user_id -> profilo (per lo stato abbonamento)
      const userPathMap = new Map<string, string>()
      allNodes.forEach(node => {
        if (node.user_id && node.path) {
          userPathMap.set(node.user_id, node.path)
        }
      })
      const profileById = new Map(profiles.map(p => [p.id, p]))

      // Calcola, per ogni profilo: quanti sponsorizzati diretti sono attivi
      // (paganti) e quanti utenti attivi ci sono nell'intera rete sotto di lui.
      const entriesWithCount: LeaderboardEntry[] = profiles.map(profile => {
        const directActiveCount = profiles.filter(
          p => p.sponsor_id === profile.id && isActiveSubscription(p)
        ).length

        const userPath = userPathMap.get(profile.id)
        let networkActiveCount = 0
        if (userPath) {
          const prefix = userPath + '.'
          networkActiveCount = allNodes
            .filter(node => node.path?.startsWith(prefix))
            .filter(node => {
              const p = node.user_id ? profileById.get(node.user_id) : null
              return p ? isActiveSubscription(p) : false
            }).length
        }

        return {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          referral_code: profile.referral_code,
          direct_active_count: directActiveCount,
          network_active_count: networkActiveCount
        }
      })

      // Ordina per rete attiva decrescente, a parità per diretti attivi
      const sorted = entriesWithCount.sort((a, b) => {
        if (b.network_active_count !== a.network_active_count) {
          return b.network_active_count - a.network_active_count
        }
        if (b.direct_active_count !== a.direct_active_count) {
          return b.direct_active_count - a.direct_active_count
        }
        return (a.first_name || '').localeCompare(b.first_name || '')
      })

      setAllEntries(sorted)

      const rank = sorted.findIndex(e => e.id === currentUserId) + 1
      setUserRank(rank > 0 ? rank : null)
    } catch (error) {
      setError(t('unexpectedError'))
    } finally {
      setLoading(false)
    }
  }

  const displayedEntries = viewMode === 'top10' ? allEntries.slice(0, 10) : allEntries.slice(0, 100)

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="w-5 h-5 text-[var(--gold)]" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
    if (rank === 3) return <Award className="w-5 h-5 text-amber-600" />
    return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-500">{rank}</span>
  }

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-[var(--gold-pale)]/60 to-[var(--paper)] border-[var(--gold)]/40'
    if (rank === 2) return 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
    if (rank === 3) return 'bg-gradient-to-r from-amber-50 to-[var(--paper)] border-amber-200'
    return 'bg-white border-[var(--gold)]/15'
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-xl font-bold text-[var(--ink)] flex items-center gap-2">
          <Trophy className="w-6 h-6 text-[var(--gold)]" />
          {t('leaderboard')}
        </h2>
        
        <div className="flex items-center gap-3">
          {userRank && (
            <div className="flex items-center gap-1 text-sm text-[var(--gold-bright)] font-semibold bg-[var(--ink)] px-3 py-1 rounded-full border border-[var(--gold)]/40">
              <TrendingUp className="w-4 h-4" />
              {t('yourRank', { rank: userRank })}
            </div>
          )}
          
          <div className="flex bg-[var(--paper)] border border-[var(--gold)]/20 rounded-lg p-1">
            <button
              onClick={() => setViewMode('top10')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'top10' ? 'bg-[var(--ink)] text-[var(--gold-bright)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Top 10
            </button>
            <button
              onClick={() => setViewMode('top100')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                viewMode === 'top100' ? 'bg-[var(--ink)] text-[var(--gold-bright)] shadow-sm' : 'text-[var(--muted)] hover:text-[var(--ink)]'
              }`}
            >
              Top 100
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          <strong>{t('error')}:</strong> {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-500 flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin"></div>
          <span>{t('loadingLeaderboard')}</span>
        </div>
      ) : displayedEntries.length === 0 ? (
        <div className="text-center py-8 text-gray-500">{t('noData')}</div>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
          {displayedEntries.map((entry, index) => {
            const rank = index + 1
            const isCurrentUser = entry.id === currentUserId
            return (
              <div
                key={entry.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                  isCurrentUser 
                    ? 'bg-[var(--gold-pale)]/50 border-[var(--gold)] shadow-sm ring-2 ring-[var(--gold)]/40' 
                    : getRankBg(rank)
                }`}
              >
                <div className="flex-shrink-0 w-8 flex justify-center">
                  {getRankIcon(rank)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold truncate ${isCurrentUser ? 'text-[var(--ink)]' : 'text-gray-900'}`}>
                      {entry.first_name} {entry.last_name}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[10px] bg-[var(--ink)] text-[var(--gold-bright)] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {t('youLabel')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono truncate">{entry.referral_code}</div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-4">
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{entry.direct_active_count}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">{t('leaderboardDirectActive')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-900">{entry.network_active_count}</div>
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide">{t('leaderboardNetworkActive')}</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
