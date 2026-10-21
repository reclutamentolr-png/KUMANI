'use client'

import { useEffect, useState } from 'react'
import { BellRing } from 'lucide-react'
import { adminGetSignupAlerts, adminSetSignupAlerts } from '@/app/actions/adminSignupAlerts'

// Admin → Panoramica: interruttore personale «Avvisami a ogni nuova
// iscrizione» (notifica sul telefono e nella campanella)
export default function SignupAlertsToggle() {
  const [state, setState] = useState<{ on: boolean; devices: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminGetSignupAlerts().then((r) => {
      if (!('error' in r)) setState(r)
    })
  }, [])

  if (!state) return null
  const toggle = async () => {
    setBusy(true)
    const r = await adminSetSignupAlerts(!state.on)
    setBusy(false)
    if (r.success) setState({ ...state, on: !state.on })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/50 px-4 py-3">
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
        <div>
          <p className="text-sm font-bold text-gray-900">Avvisami a ogni nuova iscrizione</p>
          <p className="text-xs text-gray-600">
            Solo per te: notifica sul telefono e nella campanella con nome, invito e posto tra i primi 50.{' '}
            {state.devices > 0
              ? `Notifiche attive su ${state.devices} ${state.devices === 1 ? 'dispositivo' : 'dispositivi'}.`
              : 'Nessun telefono collegato: dal telefono apri KUMANI, vai in Profilo e attiva le notifiche.'}
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={state.on}
        disabled={busy}
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${state.on ? 'bg-emerald-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${state.on ? 'left-[1.375rem]' : 'left-0.5'}`} />
        <span className="sr-only">Avvisami a ogni nuova iscrizione</span>
      </button>
    </div>
  )
}
