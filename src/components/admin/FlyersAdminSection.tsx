'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, Eye, EyeOff, Megaphone } from 'lucide-react'
import { adminListFlyers, adminSetFlyers } from '@/app/actions/adminDocuments'
import { notify } from '@/lib/adminNotify'

// Admin → Documenti KUMANI → Volantini dei servizi: quali volantini vedono
// gli iscritti. Il volantino si crea al momento del download con i testi
// dell'Area Traduttori e il QR di invito di chi lo scarica.

const STYLE_NAMES: Record<string, string> = { photo: 'Foto', phone: 'Telefono', light: 'Chiaro' }

type Row = { tool: string; title: string; style: string; published: boolean }

export default function FlyersAdminSection() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const apply = useCallback((r: Awaited<ReturnType<typeof adminListFlyers>>) => {
    if (!r.success) setError(r.error)
    else {
      setError(null)
      setRows(r.flyers)
    }
  }, [])
  useEffect(() => {
    adminListFlyers().then(apply)
  }, [apply])

  const set = async (tools: string[], published: boolean) => {
    setBusy(true)
    const r = await adminSetFlyers(tools, published)
    setBusy(false)
    if (!r.success) return notify('Errore: ' + r.error)
    adminListFlyers().then(apply)
  }

  const on = rows?.filter((r) => r.published).length ?? 0

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Megaphone className="h-5 w-5" /> Volantini dei servizi
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Ogni volantino si crea al momento del download, nella lingua dell’utente e con il QR del suo link di invito. I testi si correggono dall’Area Traduttori (sezione “flyers”). Attivi: {on} su {rows?.length ?? 0}.
          </p>
        </div>
        {rows && (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => set(rows.map((r) => r.tool), true)} className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50">
              Attiva tutti
            </button>
            <button type="button" disabled={busy} onClick={() => set(rows.map((r) => r.tool), false)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Disattiva tutti
            </button>
          </div>
        )}
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(rows ?? []).map((r) => (
          <div key={r.tool} className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{r.title}</p>
              <p className="text-xs text-gray-500">Stile {STYLE_NAMES[r.style] ?? r.style}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a href={`/documenti/volantino/${r.tool}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-800" aria-label="Anteprima">
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => set([r.tool], !r.published)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${r.published ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-gray-100 text-gray-600'}`}
              >
                {r.published ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} {r.published ? 'Attivo' : 'Spento'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
