'use client'

import { useCallback, useEffect, useState } from 'react'
import { LoaderCircle, RefreshCw, Search } from 'lucide-react'
import { adminNeedMisses, type NeedMissRow } from '@/app/actions/needSearch'

// Admin → Ricerche senza risultato: cosa scrivono le persone in «Scrivi cosa
// ti serve» quando non trovano un servizio. Serve a migliorare le frasi della
// ricerca (src/lib/needSearch/phrases.ts) e a scoprire servizi da creare.

const when = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function NeedMissesPanel() {
  const [rows, setRows] = useState<NeedMissRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await adminNeedMisses()
    setRows(r.rows)
    setTotal(r.total)
    setError(r.error ?? null)
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento dal server all'apertura
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
            <Search className="h-5 w-5 text-[var(--gold)]" /> Ricerche senza risultato
          </h2>
          <p className="text-sm text-gray-600">
            Cosa hanno scritto le persone in «Scrivi cosa ti serve» senza trovare un servizio, negli ultimi 90 giorni ({total} ricerche). Solo il testo: nessun dato della persona.
          </p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          <RefreshCw className="h-3.5 w-3.5" /> Aggiorna
        </button>
      </div>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Caricamento…
        </p>
      ) : error ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">Errore: {error}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">Nessuna ricerca senza risultato: le persone trovano quello che cercano.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2">Cosa hanno scritto</th>
                <th className="px-4 py-2">Volte</th>
                <th className="px-4 py-2">Lingua</th>
                <th className="px-4 py-2">Ultima volta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.query + r.last} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-semibold text-gray-900">{r.query}</td>
                  <td className="px-4 py-2 text-gray-700">{r.count}</td>
                  <td className="px-4 py-2 uppercase text-gray-500">{r.locales.join(', ') || '—'}</td>
                  <td className="px-4 py-2 text-gray-500">{when(r.last)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">Le richieste più frequenti diventano nuove frasi della ricerca o idee per nuovi servizi.</p>
        </div>
      )}
    </div>
  )
}
