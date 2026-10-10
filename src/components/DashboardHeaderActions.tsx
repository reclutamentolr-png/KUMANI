'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink' // ✅ CAMBIATO: usa LocalizedLink invece di next/link
import { logout } from '@/app/actions/logout'
import { forgetPushDevice } from '@/lib/pushClient'
import {
  Settings,
  LogOut,
  Wallet,
  FolderOpen,
  Building2,
  Menu,
  X,
  ChevronRight,
  Smartphone
} from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import NotificationBell from '@/components/notifications/NotificationBell'
import { InstallAppLink } from '@/components/InstallAppBanner'
import ProfileModal, { type ProfileChangeState } from './ProfileModal'
import { getMyChangeRequest } from '@/app/actions/profileChanges'
import { OPEN_PROFILE_EVENT } from '@/components/nav/AppNav'
import type { User as AuthUser } from '@supabase/supabase-js'
import type { MyProfile } from '@/lib/myProfile'

type DashboardHeaderActionsProps = {
  user: AuthUser
  profile: MyProfile | null
  isAdmin: boolean
}

export default function DashboardHeaderActions({ user, profile, isAdmin }: DashboardHeaderActionsProps) {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  // Telefono: lingua, profilo, documenti, Wallet, Admin ed Esci in un menu ☰
  const [menuOpen, setMenuOpen] = useState(false)
  const hubT = useTranslations('hub')
  const t = useTranslations('dashboard')
  const lockT = useTranslations('profileLock')
  const docsT = useTranslations('documents')
  const bpT = useTranslations('businessProfile')
  const tInstall = useTranslations('install')
  // Profilo ancora da completare (il database imposta profile_completed_at
  // quando tutti i dati obbligatori sono presenti): pallino arancione.
  const profileIncomplete = !profile?.profile_completed_at
  // Esito di una richiesta di cambio dati non ancora visto: pallino verde/rosso.
  const [changeState, setChangeState] = useState<ProfileChangeState>({ pending: null, outcome: null })
  const unseenOutcome = changeState.outcome?.status ?? null

  // "Profilo" del menu fisso: evento se si è già in Home, ?profilo=1 se si
  // arriva da un'altra pagina (tolto subito dall'indirizzo)
  useEffect(() => {
    const open = () => setIsProfileModalOpen(true)
    window.addEventListener(OPEN_PROFILE_EVENT, open)
    const url = new URL(window.location.href)
    if (url.searchParams.get('profilo') === '1') {
      url.searchParams.delete('profilo')
      window.history.replaceState(null, '', url.toString())
      open()
    }
    return () => window.removeEventListener(OPEN_PROFILE_EVENT, open)
  }, [])

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

  const logoutAction = async () => {
    await forgetPushDevice()
    await logout()
  }
  const statusDot = profileIncomplete ? 'bg-amber-500' : unseenOutcome === 'approved' ? 'bg-emerald-500' : unseenOutcome === 'rejected' ? 'bg-red-500' : null
  const menuItem = 'flex w-full items-center gap-3 rounded-xl px-4 py-3.5 text-left text-base font-semibold text-white transition-colors hover:bg-white/10'

  return (
    <>
      {/* Centro avvisi */}
      <NotificationBell />
      {/* Telefono: un solo pulsante ☰ */}
      <button
        type="button"
        onClick={() => setMenuOpen(true)}
        aria-label={hubT('menuOpen')}
        aria-expanded={menuOpen}
        className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white sm:hidden"
      >
        <Menu className="h-5 w-5" />
        {statusDot && <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--ink)] ${statusDot}`} />}
      </button>

      {menuOpen && (
        <div className="fixed inset-0 z-[70] sm:hidden" role="dialog" aria-modal="true" aria-label={hubT('menuTitle')}>
          <div className="absolute inset-0 bg-black/60" onClick={() => setMenuOpen(false)} />
          <div className="absolute inset-x-0 top-0 rounded-b-3xl border-b border-[var(--gold)]/30 bg-[var(--ink)] px-3 pb-4 pt-[calc(0.75rem+env(safe-area-inset-top))] shadow-2xl">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-sm font-bold uppercase tracking-[0.15em] text-[var(--gold-bright)]">{hubT('menuTitle')}</span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={hubT('menuClose')}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-white hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                setIsProfileModalOpen(true)
              }}
              className={menuItem}
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-sm font-bold text-white">
                {userInitial.toUpperCase()}
                {statusDot && <span className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[var(--ink)] ${statusDot}`} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block">{t('profileButton')}</span>
                {profileIncomplete && <span className="block text-xs font-semibold text-amber-400">{t('completeProfileShort')}</span>}
                {!profileIncomplete && unseenOutcome === 'approved' && <span className="block text-xs font-semibold text-emerald-400">{lockT('approvedShort')}</span>}
                {!profileIncomplete && unseenOutcome === 'rejected' && <span className="block text-xs font-semibold text-red-400">{lockT('rejectedShort')}</span>}
              </span>
              <ChevronRight className="h-4 w-4 text-white/40" />
            </button>
            <Link href="/documenti" onClick={() => setMenuOpen(false)} className={menuItem}>
              <FolderOpen className="h-5 w-5 text-[var(--gold-bright)]" /> <span className="flex-1">{docsT('title')}</span>
              <ChevronRight className="h-4 w-4 text-white/40" />
            </Link>
            <Link href="/scheda-attivita" onClick={() => setMenuOpen(false)} className={menuItem}>
              <Building2 className="h-5 w-5 text-[var(--gold-bright)]" /> <span className="flex-1">{bpT('menuLink')}</span>
              <ChevronRight className="h-4 w-4 text-white/40" />
            </Link>
            <Link href="/wallet" onClick={() => setMenuOpen(false)} className={menuItem}>
              <Wallet className="h-5 w-5 text-[var(--gold-bright)]" /> <span className="flex-1">{t('myWallet')}</span>
              <ChevronRight className="h-4 w-4 text-white/40" />
            </Link>
            <InstallAppLink className={`${menuItem} w-full text-left`}>
              <Smartphone className="h-5 w-5 text-[var(--gold-bright)]" /> <span className="flex-1">{tInstall('menuLink')}</span>
              <ChevronRight className="h-4 w-4 text-white/40" />
            </InstallAppLink>
            {isAdmin && (
              <Link href="/admin" onClick={() => setMenuOpen(false)} className={menuItem}>
                <Settings className="h-5 w-5 text-red-400" /> <span className="flex-1">{t('adminPanel')}</span>
                <ChevronRight className="h-4 w-4 text-white/40" />
              </Link>
            )}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="text-base font-semibold text-white">{hubT('menuLanguage')}</span>
              <LanguageSwitcher dark />
            </div>
            <form action={logoutAction} className="mt-1 border-t border-white/10 pt-2">
              <button type="submit" className={`${menuItem} text-red-400`}>
                <LogOut className="h-5 w-5" /> {t('logoutLabel')}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="hidden items-center gap-4 sm:flex">
        {/* Icona Profilo e Nome */}
        <button
          data-profile-button
          onClick={() => setIsProfileModalOpen(true)}
          className="flex items-center gap-2 px-1.5 py-1.5 sm:px-3 rounded-lg hover:bg-white/10 transition-colors group"
          title={profileIncomplete ? t('completeProfileShort') : unseenOutcome ? lockT('outcomeDot') : t('editProfileTitle')}
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
            <span className="block text-xs font-bold uppercase tracking-[0.12em] text-[var(--gold-bright)]">{t('profileButton')}</span>
            {profileIncomplete && <span className="block text-[10px] font-semibold text-amber-400">{t('completeProfileShort')}</span>}
            {!profileIncomplete && unseenOutcome === 'approved' && (
              <span className="block text-[10px] font-semibold text-emerald-400">{lockT('approvedShort')}</span>
            )}
            {!profileIncomplete && unseenOutcome === 'rejected' && (
              <span className="block text-[10px] font-semibold text-red-400">{lockT('rejectedShort')}</span>
            )}
          </span>
        </button>

        {/* Pulsante Documenti */}
        <Link
          href="/documenti"
          className="text-sm text-[var(--ink)] border border-[var(--gold)]/60 bg-white hover:bg-[var(--gold-pale)] font-bold transition-all flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md shadow-sm"
          aria-label={docsT('title')}
        >
          <FolderOpen className="w-4 h-4" />
          <span className="hidden sm:inline">{docsT('title')}</span>
        </Link>

        {/* Pulsante My Wallet */}
        <Link
          href="/wallet"
          className="text-sm text-[var(--ink)] bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] hover:brightness-110 font-bold transition-all flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md shadow-sm"
        >
          <Wallet className="w-4 h-4" />
          <span className="hidden sm:inline">{t('myWallet')}</span>
        </Link>

        {/* Pulsante Pannello Admin (Visibile solo agli admin) */}
        {isAdmin && (
          <Link
            href="/admin"
            className="text-sm text-white bg-red-600 hover:bg-red-700 font-medium transition-colors flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md shadow-sm"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">{t('adminPanel')}</span>
          </Link>
        )}

        {/* Pulsante di Logout */}
        <form action={logoutAction} className="inline">
          <button
            type="submit"
            className="text-sm text-red-600 hover:text-red-800 font-medium transition-colors flex items-center gap-1 hover:bg-red-50 px-2 sm:px-3 py-1.5 rounded-md"
            title="Esci"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">{t('logoutLabel')}</span>
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
