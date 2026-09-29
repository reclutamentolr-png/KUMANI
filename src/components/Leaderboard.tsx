'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { Trophy, Medal, Award, Crown, TrendingUp } from 'lucide-react'

type LeaderboardProps = {
  currentUserId: string
}

// Riga della classifica così come arriva dal database
// (get_network_leaderboard): solo nome e codice unico mascherato, mai
// cognome, codice completo o id degli altri Kumani.
type LeaderboardEntry = {
  rank_position: number
  first_name: string
  masked_code: string | null
  direct_active_count: number
  network_active_count: number
  is_me: boolean
}


export default function Leaderboard({ currentUserId }: LeaderboardProps) {
  const t = useTranslations('dashboard')
  const [allEntries, setAllEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userRank, setUserRank] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'top10' | 'top100'>('top10')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    const loadLeaderboard = async () => {
      setLoading(true)
      setError(null)
      try {
        // La classifica è calcolata nel database (Top 100 + la propria riga).
        const { data, error: rpcError } = await supabase.rpc('get_network_leaderboard', { p_limit: 100 })
        if (cancelled) return
        if (rpcError) {
          setError(t('unexpectedError'))
          return
        }
        const rows = (data ?? []) as LeaderboardEntry[]
        setAllEntries(rows.filter((row) => row.rank_position <= 100))
        setUserRank(rows.find((row) => row.is_me)?.rank_position ?? null)
      } catch {
        if (!cancelled) setError(t('unexpectedError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadLeaderboard()
    return () => {
      cancelled = true
    }
  }, [currentUserId, t])

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
          {displayedEntries.map((entry) => {
            const rank = entry.rank_position
            const isCurrentUser = entry.is_me
            return (
              <div
                key={entry.rank_position}
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
                      {entry.first_name}
                    </span>
                    {isCurrentUser && (
                      <span className="text-[10px] bg-[var(--ink)] text-[var(--gold-bright)] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {t('youLabel')}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 font-mono truncate">{entry.masked_code}</div>
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
