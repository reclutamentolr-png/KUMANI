'use client'

import { useEffect, useState } from 'react'
import { LifeBuoy } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { adminGetSolve, adminSetSolve } from '@/app/actions/solve'

// Admin → Panoramica: KUMANI Risolvi acceso per tutti o solo per lo Staff
// (anteprima), con quanti percorsi sono stati iniziati e conclusi
export default function SolveToggle() {
  const [state, setState] = useState<{ enabled: boolean; started: number; completed: number; solved: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    adminGetSolve().then((r) => {
      if (!('error' in r)) setState(r)
    })
  }, [])

  if (!state) return null
  const toggle = async () => {
    setBusy(true)
    const r = await adminSetSolve(!state.enabled)
    setBusy(false)
    if (r.success) setState({ ...state, enabled: !state.enabled })
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--gold)]/40 bg-white px-4 py-3">
      <div className="flex items-start gap-3">
        <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
        <div>
          <p className="text-sm font-bold text-gray-900">
            KUMANI Risolvi {state.enabled ? '· acceso per tutti' : '· solo Staff (anteprima)'}
          </p>
          <p className="text-xs text-gray-600">
            Guide passo passo per i problemi di tutti i giorni. Percorsi iniziati: {state.started} · conclusi: {state.completed} · «risolto»: {state.solved}.{' '}
            <Link href="/risolvi" className="font-semibold text-[var(--gold)] underline underline-offset-2">
              Apri le guide
            </Link>
          </p>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={state.enabled}
        disabled={busy}
        onClick={toggle}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${state.enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${state.enabled ? 'left-[1.375rem]' : 'left-0.5'}`} />
        <span className="sr-only">Accendi KUMANI Risolvi per tutti</span>
      </button>
    </div>
  )
}
