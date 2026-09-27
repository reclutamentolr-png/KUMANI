'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink' // ✅ CAMBIATO: usa LocalizedLink invece di next/link
import { logout } from '@/app/actions/logout'
import {
  Hand,
  Settings,
  LogOut,
  User,
  Wallet
} from 'lucide-react'
import ProfileModal, { type ProfileChangeState } from './ProfileModal'
import { getMyChangeRequest } from '@/app/actions/profileChanges'

type DashboardHeaderActionsProps = {
  user: any
  profile: any
  isAdmin: boolean
}

export default function DashboardHeaderActions({ user, profile, isAdmin }: DashboardHeaderActionsProps) {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const t = useTranslations('dashboard')
  const lockT = useTranslations('profileLock')
  // Profilo ancora da completare (il database imposta profile_completed_at
  // quando tutti i dati obbligatori sono presenti): pallino arancione.
  const profileIncomplete = !profile?.profile_completed_at
  // Esito di una richiesta di cambio dati non ancora visto: pallino verde/rosso.
  const [changeState, setChangeState] = useState<ProfileChangeState>({ pending: null, outcome: null })
  const unseenOutcome = changeState.outcome?.status ?? null

  useEffect(() => {
    if (profileIncomplete) return
    let cancelled = false
    getMyChangeRequest()
      .then((state) => {
        if (!cancelled) setChangeState(state)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [profileIncomplete])
  
  const userInitial = profile?.first_name?.charAt(0) || user?.email?.charAt(0) || 'U'

  return (
    <>
      <div className="flex items-center gap-4">
        {/* Icona Profilo e Nome */}
        <button
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors group"
          title={profileIncomplete ? t('completeProfileShort') : unseenOutcome ? lockT('outcomeDot') : 'Modifica profilo'}
        >
          <div className="relative w-8 h-8 rounded-full bg-[var(--gold)] flex items-center justify-center text-white font-bold text-sm shadow-sm group-hover:shadow-md transition-shadow">
            {userInitial.toUpperCase()}
            {profileIncomplete && (
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--ink)] bg-amber-500" />
            )}
            {!profileIncomplete && unseenOutcome && (
              <span
                className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--ink)] ${unseenOutcome === 'approved' ? 'bg-emerald-500' : 'bg-red-500'}`}
              />
            )}
          </div>
          <span className="hidden sm:block text-left leading-tight">
            <span className="block text-sm text-[var(--gold-bright)] font-medium">{profile?.first_name || 'Il mio profilo'}</span>
            {profileIncomplete && <span className="block text-[10px] font-semibold text-amber-400">{t('completeProfileShort')}</span>}
            {!profileIncomplete && unseenOutcome === 'approved' && (
              <span className="block text-[10px] font-semibold text-emerald-400">{lockT('approvedShort')}</span>
            )}
            {!profileIncomplete && unseenOutcome === 'rejected' && (
              <span className="block text-[10px] font-semibold text-red-400">{lockT('rejectedShort')}</span>
            )}
          </span>
        </button>

        {/* Pulsante My Wallet */}
        <Link
          href="/wallet"
          className="text-sm text-[var(--ink)] bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 font-bold transition-all flex items-center gap-1 px-3 py-1.5 rounded-md shadow-sm"
        >
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">Il mio Wallet</span>
        </Link>

        {/* Pulsante Pannello Admin (Visibile solo agli admin) */}
        {isAdmin && (
          <Link
            href="/admin"
            className="text-sm text-white bg-red-600 hover:bg-red-700 font-medium transition-colors flex items-center gap-1 px-3 py-1.5 rounded-md shadow-sm"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Pannello Admin</span>
          </Link>
        )}

        {/* Pulsante di Logout */}
        <form action={logout} className="inline">
          <button
            type="submit"
            className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors flex items-center gap-1 hover:bg-red-50 px-3 py-1.5 rounded-md"
            title="Esci"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Esci</span>
          </button>
        </form>
      </div>

      {/* Modale Profilo */}
      <ProfileModal 
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        initialData={profile}
        userId={user.id}
        onChangeRequestUpdate={setChangeState}
      />
    </>
  )
}
