'use client'

import { useEffect, useState } from 'react'
import { Gift, Loader2 } from 'lucide-react'
import { adminGetSurpriseKinds, adminSaveSystemSettings } from '@/app/actions/admin'
import { SURPRISE_KINDS, type SurpriseKind } from '@/lib/surprise'
import { notify } from '@/lib/adminNotify'

const LABEL: Record<SurpriseKind, string> = {
  voucher: 'Buono regalo',
  journey3: 'Percorso 3 giorni',
  journey7: 'Percorso 7 giorni',
}

// Admin → Strumenti e interruttori: quali tipi di KUMANI Sorpresa si possono
// creare. Quelli spenti spariscono da prezzi, modelli e editor; le sorprese
// già create restano com'erano. Almeno uno resta acceso.
export default function SurpriseKindsPanel() {
  const [kinds, setKinds] = useState<SurpriseKind[] | null>(null)
  const [busy, setBusy] = useState<SurpriseKind | null>(null)

  useEffect(() => {
    adminGetSurpriseKinds().then((k) => setKinds(k ?? ['voucher']))
  }, [])

  const toggle = async (kind: SurpriseKind) => {
    if (!kinds) return
    const next = kinds.includes(kind) ? kinds.filter((k) => k !== kind) : SURPRISE_KINDS.filter((k) => k === kind || kinds.includes(k))
    if (!next.length) return notify('Lascia acceso almeno un tipo di sorpresa.', 'error')
    setBusy(kind)
    const res = await adminSaveSystemSettings({ surprise_kinds_enabled: next })
    setBusy(null)
    if (!res.success) return notify(res.error ?? 'Salvataggio non riuscito', 'error')
    setKinds(next)
    notify(`${LABEL[kind]}: ${next.includes(kind) ? 'acceso' : 'spento'}`, 'success')
  }

  return (
    <div className="rounded-xl border border-pink-200 bg-pink-50/60 p-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
          <Gift className="h-4 w-4 text-pink-700" />
          KUMANI Sorpresa · tipi disponibili
        </p>
        {!kinds ? (
          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {SURPRISE_KINDS.map((kind) => {
              const on = kinds.includes(kind)
              return (
                <button
                  key={kind}
                  type="button"
                  disabled={busy !== null}
                  onClick={() => toggle(kind)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition disabled:opacity-60 ${
                    on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white text-gray-500'
                  }`}
                >
                  {busy === kind && <Loader2 className="h-3 w-3 animate-spin" />}
                  {LABEL[kind]} · {on ? 'acceso' : 'spento'}
                </button>
              )
            })}
          </div>
        )}
      </div>
      <p className="mt-1.5 text-xs text-gray-600">I tipi spenti non si possono più creare (spariscono da prezzi, modelli ed editor). Le sorprese già create restano come sono.</p>
    </div>
  )
}
