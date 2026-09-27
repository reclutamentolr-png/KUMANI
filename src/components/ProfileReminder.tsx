'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import ProfileCompleter from '@/components/ProfileCompleter'
import { getIncompleteProfile } from '@/app/actions/profileReminder'
import { dismissProfileReminder } from '@/app/actions/profileChanges'

// Promemoria "completa il profilo": popup dopo 15 minuti di permanenza sulla
// piattaforma (il conteggio continua cambiando pagina). Se l'utente lo chiude
// senza completare, il database lo registra (profile_reminder_dismissed_at) e
// dalla pagina successiva la richiesta diventa obbligatoria: una finestra che
// copre l'app e non si chiude, finché i dati non sono completi (o si esce).
const STORAGE_KEY = 'kumani_profile_reminder'
// Profilo già completo in questa sessione: nessuna nuova richiesta al server.
const COMPLETE_KEY = 'kumani_profile_complete'
const DELAY_MS = 15 * 60 * 1000

// Pagine pubbliche (menù, tessere, pagine condivise): mai il popup.
const PUBLIC_PREFIXES = ['/m/', '/f/', '/strumenti/', '/affinity/duo/', '/veritas/', '/convivio/', '/cv/', '/o/', '/q/', '/ref/', '/viaggi/invito/', '/events/']
// Accesso, regole e contatti: sempre raggiungibili, anche col blocco.
// Pannello Admin: lo Staff deve poter lavorare comunque.
const EXEMPT_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password', '/auth', '/terms', '/privacy', '/contact', '/chi-siamo', '/admin', '/events']

function isExemptPath(pathname: string) {
  const path = pathname.replace(/^\/(it|en|fr|es|pt|de|ru)(?=\/|$)/, '') || '/'
  // Home pubblica: vetrina per tutti, niente blocco.
  if (path === '/') return true
  if (PUBLIC_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  return EXEMPT_ROUTES.some((route) => path === route || path.startsWith(`${route}/`))
}

type ReminderState = { next: number }

function readState(): ReminderState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ReminderState
      if (typeof parsed.next === 'number') return parsed
    }
  } catch {
    // sessionStorage non disponibile: si riparte da zero.
  }
  const fresh = { next: Date.now() + DELAY_MS }
  writeState(fresh)
  return fresh
}

function writeState(state: ReminderState) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignorato.
  }
}

function markComplete() {
  try {
    sessionStorage.setItem(COMPLETE_KEY, '1')
  } catch {
    // Ignorato.
  }
}

export function resetProfileReminder() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
    sessionStorage.removeItem(COMPLETE_KEY)
  } catch {
    // Ignorato.
  }
}

export default function ProfileReminder() {
  const pathname = usePathname() ?? ''
  const [open, setOpen] = useState(false)
  // Profilo incompleto dell'utente collegato (null = niente da proporre)
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  // Promemoria già chiuso una volta (dal server): richiesta obbligatoria.
  const [dismissed, setDismissed] = useState(false)
  // Chiuso adesso: il blocco parte dalla prossima pagina visitata.
  const [dismissedOnPath, setDismissedOnPath] = useState<string | null>(null)
  const isExempt = isExemptPath(pathname)
  const blocking = !!profile && !isExempt && (dismissed || (dismissedOnPath !== null && dismissedOnPath !== pathname))

  // Si chiede al server a ogni cambio pagina finché non si sa che il profilo
  // è completo (così funziona anche subito dopo il login, senza ricaricare).
  useEffect(() => {
    if (isExempt || profile) return
    try {
      if (sessionStorage.getItem(COMPLETE_KEY)) return
    } catch {
      // Ignorato.
    }
    let cancelled = false
    getIncompleteProfile()
      .then((result) => {
        if (cancelled) return
        if (result.status === 'incomplete') {
          setProfile(result.profile)
          setDismissed(result.dismissed)
        }
        if (result.status === 'complete') markComplete()
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isExempt, profile, pathname])

  // Primo promemoria (non obbligatorio) dopo 15 minuti.
  useEffect(() => {
    if (isExempt || !profile || dismissed || dismissedOnPath !== null || open) return
    const state = readState()
    // Allo scadere si ricontrolla: il profilo può essere stato completato nel
    // frattempo dal menu del profilo.
    const timer = setTimeout(() => {
      getIncompleteProfile()
        .then((result) => {
          if (result.status === 'incomplete') {
            setProfile(result.profile)
            if (result.dismissed) setDismissed(true)
            else setOpen(true)
            return
          }
          setProfile(null)
          markComplete()
        })
        .catch(() => {})
    }, Math.max(0, state.next - Date.now()))
    return () => clearTimeout(timer)
  }, [isExempt, open, profile, dismissed, dismissedOnPath])

  if (!profile || isExempt) return null

  const onSaved = () => {
    writeState({ next: Number.MAX_SAFE_INTEGER })
    setOpen(false)
    setProfile(null)
    markComplete()
  }

  if (blocking) {
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
        <div className="max-h-[96vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white">
          <ProfileCompleter key="blocking" initialData={profile} blocking onSaved={onSaved} />
        </div>
      </div>
    )
  }

  if (!open) return null

  // Chiuso senza completare: registrato sul server, dalla prossima pagina è obbligatorio.
  const later = () => {
    setOpen(false)
    setDismissedOnPath(pathname)
    dismissProfileReminder().catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <ProfileCompleter initialData={profile} onDismiss={later} onSaved={onSaved} />
      </div>
    </div>
  )
}
