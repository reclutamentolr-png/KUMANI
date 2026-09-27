'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { createClient } from '@/lib/supabase/client'
import { Sparkles } from 'lucide-react'

type User = {
  id: string
  first_name: string | null
  last_name: string | null
  referral_code: string | null
  country_code: string | null
  created_at: string
  username: string | null
}

export default function LatestUsersRotating() {
  const t = useTranslations('landingHome')
  const [users, setUsers] = useState<User[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.rpc('get_public_latest_users', {
          p_limit: 10,
        })

        if (!error && data) {
          setUsers(data as User[])
        }
      } catch (err) {
        console.error('Errore:', err)
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [])

  // Cambia nome ogni 3 secondi
  useEffect(() => {
    if (users.length <= 1) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % users.length)
    }, 3000)

    return () => clearInterval(interval)
  }, [users.length])

  if (loading || users.length === 0) {
    return null // Nascondi se non ci sono dati
  }

  const user = users[currentIndex]

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-[var(--gold)]/30 w-full max-w-sm mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-[var(--gold-bright)]" />
        <h3 className="text-lg font-bold text-white">{t('latestUsers')}</h3>
      </div>

      {/* Card con fade transition */}
      <div key={user.id} className="animate-fadeIn">
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="flex items-center gap-4">
            {/* Avatar */}
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] flex items-center justify-center flex-shrink-0 shadow-lg">
              <span className="text-[var(--ink)] font-bold text-xl">
                {user.first_name?.[0] || user.username?.[0] || 'U'}
                {user.last_name?.[0] || ''}
              </span>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-lg truncate">
                {user.first_name} {user.last_name}
              </p>
              <p className="text-sm text-[var(--gold-pale)] font-mono truncate">
                {user.referral_code}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400 bg-white/10 px-2 py-0.5 rounded">
                  {user.country_code || 'IT'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Indicatori dots */}
        <div className="flex justify-center gap-1.5 mt-4">
          {users.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-[var(--gold-bright)] w-6'
                  : 'bg-white/30 w-1.5'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}