'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import ProfileCompleter from '@/components/ProfileCompleter'
import { getIncompleteProfile } from '@/app/actions/profileReminder'

// Promemoria "completa il profilo": popup dopo 15 minuti di permanenza sulla
// piattaforma (il conteggio continua cambiando pagina), "Più tardi" lo
// ripropone dopo altri 15 minuti, al massimo 2 volte per accesso. Lo stato
// vive nella sessione del browser: a ogni nuovo accesso si ricomincia.
const STORAGE_KEY = 'kumani_profile_reminder'
// Profilo già completo in questa sessione: nessuna nuova richiesta al server.
const COMPLETE_KEY = 'kumani_profile_complete'
const DELAY_MS = 15 * 60 * 1000
const MAX_PER_SESSION = 2

// Pagine pubbliche (menù, tessere, pagine condivise): mai il popup.
const PUBLIC_PREFIXES = ['/m/', '/f/', '/strumenti/', '/affinity/duo/', '/veritas/', '/convivio/', '/cv/', '/o/', '/q/']

type ReminderState = { next: number; shown: number }

function readState(): ReminderState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ReminderState
      if (typeof parsed.next === 'number' && typeof parsed.shown === 'number') return parsed
    }
  } catch {
    // sessionStorage non disponibile: si riparte da zero.
  }
  const fresh = { next: Date.now() + DELAY_MS, shown: 0 }
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
  const isPublicPage = PUBLIC_PREFIXES.some((prefix) => pathname.replace(/^\/(it|en|fr|es|pt|de|ru)(?=\/)/, '').startsWith(prefix))

  // Si chiede al server a ogni cambio pagina finché non si sa che il profilo
  // è completo (così funziona anche subito dopo il login, senza ricaricare).
  useEffect(() => {
    if (isPublicPage || profile) return
    try {
      if (sessionStorage.getItem(COMPLETE_KEY)) return
    } catch {
      // Ignorato.
    }
    let cancelled = false
    getIncompleteProfile()
      .then((result) => {
        if (cancelled) return
        if (result.status === 'incomplete') setProfile(result.profile)
        if (result.status === 'complete') {
          try {
            sessionStorage.setItem(COMPLETE_KEY, '1')
          } catch {
            // Ignorato.
          }
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [isPublicPage, profile, pathname])

  useEffect(() => {
    if (isPublicPage || !profile) return
    const state = readState()
    if (state.shown >= MAX_PER_SESSION) return
    // Allo scadere si ricontrolla: il profilo può essere stato completato nel
    // frattempo dal menu del profilo.
    const timer = setTimeout(() => {
      getIncompleteProfile()
        .then((result) => {
          if (result.status === 'incomplete') {
            setOpen(true)
            return
          }
          setProfile(null)
          try {
            sessionStorage.setItem(COMPLETE_KEY, '1')
          } catch {
            // Ignorato.
          }
        })
        .catch(() => {})
    }, Math.max(0, state.next - Date.now()))
    return () => clearTimeout(timer)
  }, [isPublicPage, open, profile])

  if (!open || isPublicPage || !profile) return null

  const later = () => {
    const state = readState()
    writeState({ next: Date.now() + DELAY_MS, shown: state.shown + 1 })
    setOpen(false)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <ProfileCompleter
          initialData={profile}
          onDismiss={later}
          onSaved={() => {
            writeState({ next: Number.MAX_SAFE_INTEGER, shown: MAX_PER_SESSION })
            setOpen(false)
            setProfile(null)
            try {
              sessionStorage.setItem(COMPLETE_KEY, '1')
            } catch {
              // Ignorato.
            }
          }}
        />
      </div>
    </div>
  )
}
