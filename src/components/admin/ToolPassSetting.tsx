'use client'

import { useState } from 'react'
import { LoaderCircle, Ticket } from 'lucide-react'
import { adminUpdateToolPass } from '@/app/actions/admin'
import { notify } from '@/lib/adminNotify'

// Su ogni servizio a pagamento: vendibile anche da solo (pass di un anno)
// e a che prezzo. Vale subito per schede, dashboard e pagina del pass.
export default function ToolPassSetting({
  toolName,
  enabled,
  priceCents,
  kuPoints,
  onSaved,
}: {
  toolName: string
  enabled: boolean
  priceCents: number
  kuPoints: number
  onSaved: () => void
}) {
  const [on, setOn] = useState(enabled)
  const [price, setPrice] = useState(String((priceCents || 1000) / 100))
  const [points, setPoints] = useState(String(kuPoints || 0))
  const [busy, setBusy] = useState(false)
  const dirty = on !== enabled || Number(price.replace(',', '.')) * 100 !== priceCents || Number(points) !== kuPoints

  const save = async () => {
    setBusy(true)
    const result = await adminUpdateToolPass(toolName, on, Number(price.replace(',', '.')), Number(points) || 0)
    setBusy(false)
    if (!result.success) {
      notify('Errore: ' + (result.error ?? ''))
      return
    }
    notify(
      on
        ? `Pass attivo: il servizio si può acquistare da solo a ${price} € per un anno${Number(points) > 0 ? `; chi ha invitato l'acquirente riceve ${points} KU Points` : ''}.`
        : 'Pass disattivato per questo servizio.',
      'success'
    )
    onSaved()
  }

  return (
    <div className="mb-4 rounded-lg border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase text-gray-600">
          <input type="checkbox" checked={on} onChange={(e) => setOn(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
          <Ticket className="h-3.5 w-3.5 text-[var(--gold)]" /> Vendibile da solo (pass 1 anno)
        </label>
        <label className="flex items-center gap-1 text-sm">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            inputMode="decimal"
            disabled={!on}
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm disabled:bg-gray-100"
          />
          €
        </label>
        <label className="flex items-center gap-1 text-sm" title="KU Points a chi ha invitato l'acquirente, al primo acquisto del Pass (0 = nessuno)">
          <input
            value={points}
            onChange={(e) => setPoints(e.target.value.replace(/[^\d]/g, ''))}
            inputMode="numeric"
            disabled={!on}
            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-right text-sm disabled:bg-gray-100"
          />
          KU Points
        </label>
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-[var(--ink)] px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
        >
          {busy && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
          Salva
        </button>
      </div>
    </div>
  )
}
