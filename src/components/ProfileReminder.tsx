'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import ProfileCompleter from '@/components/ProfileCompleter'
import { getIncompleteProfile } from '@/app/actions/profileReminder'
import { dismissProfileReminder } from '@/app/actions/profileChanges'

// Promemoria "completa il profilo":
// - piano Gratis: per i primi 7 giorni dall'iscrizione niente; dopo, il popup
//   compare alla prima visita. Se lo si chiude senza completare, il database
//   lo registra (profile_reminder_dismissed_at) e dalla pagina successiva la
//   richiesta diventa obbligatoria: una finestra che copre l'app e non si
//   chiude finché i dati non sono completi (o si esce);
// - piano Base o Pro attivo (pagato, con un codice o in prova Pro): subito e
//   obbligatoria, perché i dati servono.
// Il server dice quale caso (getIncompleteProfile: paid, dueAt).
const STORAGE_KEY = 'kumani_profile_reminder'
// Profilo già completo in questa sessione: nessuna nuova richiesta al server.
const COMPLETE_KEY = 'kumani_profile_complete'
// Nei primi 7 giorni (Gratis) si ricontrolla al massimo ogni minuto cambiando
// pagina: se nel frattempo si attiva un piano, la richiesta parte subito
const RECHECK_MS = 60 * 1000

// Pagine pubbliche (menù, tessere, pagine condivise): mai il popup.
const PUBLIC_PREFIXES = ['/m/', '/p/', '/f/', '/strumenti/', '/affinity/duo/', '/veritas/', '/convivio/', '/cv/', '/o/', '/q/', '/ref/', '/i/', '/v/', '/viaggi/invito/', '/events/']
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

function markComplete() {
  try {
    sessionStorage.setItem(COMPLETE_KEY, '1')
  } catch {
    // Ignorato.
  }
}

// Nessun cookie di sessione di Supabase (sb-…, leggibili dal browser): chi
// non ha fatto l'accesso non viene chiesto al server a ogni cambio pagina.
// Appena entra il cookie c'è e il controllo riparte da solo.
function mayBeSignedIn() {
  try {
    return document.cookie.split(';').some((c) => c.trim().startsWith('sb-'))
  } catch {
    return true
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
  // Base o Pro attivo: richiesta subito obbligatoria
  const [paid, setPaid] = useState(false)
  // Gratis: da quando chiederlo (7 giorni dopo l'iscrizione)
  const [dueAt, setDueAt] = useState<number | null>(null)
  const [due, setDue] = useState(false)
  const [lastCheck, setLastCheck] = useState(0)
  // Chiuso adesso: il blocco parte dalla prossima pagina visitata.
  const [dismissedOnPath, setDismissedOnPath] = useState<string | null>(null)
  const isExempt = isExemptPath(pathname)
  const blocking = !!profile && !isExempt && (paid || (due && (dismissed || (dismissedOnPath !== null && dismissedOnPath !== pathname))))

  // Si chiede al server cambiando pagina finché non si sa se il profilo è
  // completo (così funziona anche subito dopo il login, senza ricaricare).
  // Completo: segnato nella sessione, non si chiede più. Incompleto ma non
  // ancora da chiedere (Gratis, primi 7 giorni): si ricontrolla al massimo
  // ogni minuto, nel caso venga attivato un piano. Senza sessione niente.
  useEffect(() => {
    if (isExempt || paid || due) return
    try {
      if (sessionStorage.getItem(COMPLETE_KEY)) return
    } catch {
      // Ignorato.
    }
    if (!mayBeSignedIn()) return
    if (profile && Date.now() - lastCheck < RECHECK_MS) return
    let cancelled = false
    getIncompleteProfile()
      .then((result) => {
        if (cancelled) return
        setLastCheck(Date.now())
        if (result.status === 'incomplete') {
          setProfile(result.profile)
          setDismissed(result.dismissed)
          setPaid(result.paid)
          setDueAt(result.dueAt)
        }
        if (result.status === 'complete') {
          setProfile(null)
          markComplete()
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // lastCheck non fa ripartire il controllo: conta solo cambiando pagina
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExempt, profile, pathname, paid, due])

  // Gratis: la richiesta scatta allo scadere dei 7 giorni (anche a pagina aperta)
  useEffect(() => {
    if (paid || dueAt === null) return
    const wait = dueAt - Date.now()
    if (wait <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDue(true)
      return
    }
    if (wait > 2 ** 31 - 1) return
    const timer = setTimeout(() => setDue(true), wait)
    return () => clearTimeout(timer)
  }, [paid, dueAt])

  // Primo promemoria (Gratis, dopo 7 giorni): si può chiudere una volta
  useEffect(() => {
    if (isExempt || !profile || paid || !due || dismissed || dismissedOnPath !== null || open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true)
  }, [isExempt, open, profile, paid, due, dismissed, dismissedOnPath])

  if (!profile || isExempt) return null

  const onSaved = () => {
    setOpen(false)
    setProfile(null)
    markComplete()
  }

  if (blocking) {
    return (
      <div role="dialog" aria-modal="true" data-profile-required className="fixed inset-0 z-[80] flex items-end justify-center bg-black/80 backdrop-blur-sm p-0 sm:items-center sm:p-4">
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
