'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { Download, LoaderCircle, Ticket } from 'lucide-react'
import AdminUserPicker from '@/components/admin/AdminUserPicker'
import { adminCreatePassCodes, adminListPassCodes, type AdminPassCodeRow, type StaffUserHit } from '@/app/actions/admin'
import { notify } from '@/lib/adminNotify'

// Codici pass: attivano un solo servizio per un anno, senza abbonamento.
// Un lotto da vendere a un negozio, oppure un codice assegnato a un utente
// (lo trova tra i Coupon del Wallet, può attivarlo o regalarlo).
export default function PassCodesPanel() {
  const marketplaceT = useTranslations('marketplace')
  const tools = useMemo(() => getMarketplaceTools((key) => marketplaceT(key)).sort((a, b) => a.title.localeCompare(b.title)), [marketplaceT])
  const [tool, setTool] = useState(tools[0]?.toolName ?? '')
  const [quantity, setQuantity] = useState('10')
  const [label, setLabel] = useState('')
  const [user, setUser] = useState<StaffUserHit | null>(null)
  const [mode, setMode] = useState<'batch' | 'user'>('batch')
  const [busy, setBusy] = useState(false)
  const [lastCodes, setLastCodes] = useState<string[]>([])
  const [rows, setRows] = useState<AdminPassCodeRow[] | null>(null)

  const load = useCallback(async () => {
    const result = await adminListPassCodes()
    if (result.error) notify('Errore: ' + result.error)
    setRows(result.codes)
  }, [])

  useEffect(() => {
    // Caricamento dal server all'apertura (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const create = async () => {
    if (mode === 'user' && !user) {
      notify('Scegli l’utente a cui assegnare il codice.', 'error')
      return
    }
    setBusy(true)
    const result = await adminCreatePassCodes({ tool, quantity: Number(quantity), label, userId: mode === 'user' ? user?.id : null })
    setBusy(false)
    if (!result.success) {
      notify('Errore: ' + (result.error ?? ''))
      return
    }
    setLastCodes(result.codes)
    notify(mode === 'user' ? 'Codice pass assegnato: l’utente lo trova tra i Coupon del Wallet.' : `${result.codes.length} codici pass creati.`, 'success')
    await load()
  }

  const downloadCsv = (codes: string[]) => {
    const title = tools.find((item) => item.toolName === tool)?.title ?? tool
    const csv = ['codice;servizio;durata', ...codes.map((code) => `${code};${title};1 anno`)].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `pass-${tool}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-gray-900">
            <Ticket className="h-5 w-5 text-[var(--gold)]" /> Pass servizio
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            Un codice pass attiva <strong>un solo servizio per un anno</strong>, senza abbonamento. Chi lo riceve lo inserisce nella pagina
            del servizio (o lo attiva dal Wallet se gliel&apos;hai assegnato) e può anche regalarlo. Il pass non dà KU Points a chi ha
            invitato e non cambia il prezzo di Base e Pro. Il prezzo e la vendita con carta si impostano su ogni servizio in Marketplace.
          </p>
        </div>

        <div className="flex gap-2 text-sm">
          {(['batch', 'user'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-lg px-3 py-1.5 font-semibold ${mode === value ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-gray-100 text-gray-600'}`}
            >
              {value === 'batch' ? 'Lotto di codici (es. negozio)' : 'Assegna a un utente'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Servizio</span>
            <select value={tool} onChange={(e) => setTool(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {tools.map((item) => (
                <option key={item.toolName} value={item.toolName}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          {mode === 'batch' ? (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Quantità (max 500)</span>
              <input type="number" min={1} max={500} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
          ) : (
            <div className="md:col-span-1">
              <span className="mb-1 block text-xs font-medium text-gray-600">Utente</span>
              <AdminUserPicker scope="coupons" selected={user} onSelect={setUser} />
            </div>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Nota (negozio, promozione…)</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>

        <button
          type="button"
          onClick={create}
          disabled={busy || !tool}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {mode === 'batch' ? 'Crea i codici' : 'Crea e assegna'}
        </button>

        {lastCodes.length > 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-emerald-900">Codici appena creati ({lastCodes.length})</p>
              <button type="button" onClick={() => downloadCsv(lastCodes)} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            </div>
            <p className="break-words font-mono text-xs text-emerald-900">{lastCodes.join('  ·  ')}</p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {rows === null ? (
          <p className="p-6 text-sm text-gray-500">Caricamento…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">Nessun codice pass creato.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Codice</th>
                <th className="px-4 py-3 font-semibold">Servizio</th>
                <th className="px-4 py-3 font-semibold">Nota</th>
                <th className="px-4 py-3 font-semibold">Creato</th>
                <th className="px-4 py-3 font-semibold">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.code}>
                  <td className="px-4 py-2.5 font-mono text-xs">{row.code}</td>
                  <td className="px-4 py-2.5">{row.toolTitle}</td>
                  <td className="px-4 py-2.5 text-gray-500">{row.label ?? (row.assigned ? 'Assegnato a un utente' : '—')}</td>
                  <td className="px-4 py-2.5 text-gray-500">{new Date(row.created_at).toLocaleDateString('it-IT')}</td>
                  <td className="px-4 py-2.5">
                    {row.redeemed_at ? (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                        Usato il {new Date(row.redeemed_at).toLocaleDateString('it-IT')}
                      </span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Disponibile</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
