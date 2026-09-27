'use client'

import { useCallback, useEffect, useState } from 'react'
import { ExternalLink, LoaderCircle, Percent } from 'lucide-react'
import { prettyVat, registryLookupUrl } from '@/lib/vat'
import { adminGetConvivioFeePercent, adminListConvivioFees, adminSetConvivioFeePercent, adminWaiveConvivioFee } from '@/app/actions/admin'

type AdminConvivioFee = Awaited<ReturnType<typeof adminListConvivioFees>>['fees'][number]
type Person = AdminConvivioFee['supplier']

const name = (p: Person) => (p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || '—' : '—')
const money = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v))
const when = (iso: string) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

// Admin → Commissioni Kordata: percentuale trattenuta da KUMANI sulle Kordate
// con fornitore Pro, elenco delle commissioni e condono.
export default function ConvivioFeesPanel({ locale }: { locale: string }) {
  const [fees, setFees] = useState<AdminConvivioFee[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [percent, setPercent] = useState('')
  const [percentSaved, setPercentSaved] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setFees(null)
    const result = await adminListConvivioFees()
    setFees(result.fees)
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento dal server (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    adminGetConvivioFeePercent().then((result) => {
      if (result.percent !== null) setPercent(String(result.percent))
    })
  }, [load])

  const waive = async (fee: AdminConvivioFee) => {
    if (!confirm(`Condonare la commissione di ${money(fee.amount)} per "${fee.group?.title ?? '—'}"?`)) return
    setWorking(fee.id)
    const result = await adminWaiveConvivioFee(fee.id)
    setWorking(null)
    if (!result.success) alert('Errore: ' + (result.error ?? ''))
    await load()
  }

  const savePercent = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = Number(percent.replace(',', '.'))
    const result = await adminSetConvivioFeePercent(value)
    setPercentSaved(result.success ? 'Salvato' : `Errore: ${result.error}`)
  }

  const dueTotal = (fees ?? []).filter((f) => f.status === 'due').reduce((sum, f) => sum + Number(f.amount), 0)
  const paidTotal = (fees ?? []).filter((f) => f.status === 'paid').reduce((sum, f) => sum + Number(f.amount), 0)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Commissioni Kordata</h2>
        <p className="mt-1 text-gray-600">
          Quando una Kordata con fornitore Pro diventa &quot;ordinata&quot;, KUMANI calcola la commissione a carico del fornitore (quantità × prezzo di
          gruppo × percentuale). Il fornitore la paga con carta dall&apos;Area fornitore; da 0,50 € in su non può accettare nuove Kordate finché non
          la salda.
        </p>
      </div>

      <form onSubmit={savePercent} className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700">Commissione KUMANI (%)</label>
          <div className="flex items-center gap-2">
            <input
              value={percent}
              onChange={(e) => {
                setPercent(e.target.value.replace(/[^0-9.,]/g, ''))
                setPercentSaved(null)
              }}
              inputMode="decimal"
              className="w-24 rounded-lg border border-gray-300 px-3 py-2"
            />
            <Percent className="h-4 w-4 text-gray-400" />
          </div>
        </div>
        <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          Salva
        </button>
        <p className="text-xs text-gray-500">Da 0 a 30. Si fissa su ogni Kordata quando il fornitore la conferma (le Kordate già confermate non cambiano).</p>
        {percentSaved && <p className="w-full text-sm font-semibold text-gray-700">{percentSaved}</p>}
      </form>

      {fees && fees.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-semibold uppercase text-amber-700">Da incassare</p>
            <p className="text-2xl font-bold text-amber-900">{money(dueTotal)}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Incassate</p>
            <p className="text-2xl font-bold text-emerald-900">{money(paidTotal)}</p>
          </div>
        </div>
      )}

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {fees === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : fees.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Nessuna commissione.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Kordata</th>
                <th className="px-3 py-2">Fornitore</th>
                <th className="px-3 py-2">Calcolo</th>
                <th className="px-3 py-2">Importo</th>
                <th className="px-3 py-2">Stato</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {fees.map((fee) => (
                <tr key={fee.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    <span className="flex items-center gap-1.5">
                      {fee.group?.title ?? '—'}
                      {fee.group && (
                        <a href={`/${locale}/marketplace/convivio/${fee.group.id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </span>
                    <span className="block text-xs font-normal text-gray-500">{when(fee.created_at)}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {name(fee.supplier)}
                    <span className="block text-xs text-gray-400">{fee.supplier?.email ?? ''}</span>
                    {fee.business && (
                      <span className="mt-1 block text-xs">
                        <span className="font-medium text-gray-700">{fee.business.business_name}</span>{' '}
                        <span className="font-mono text-gray-500">{prettyVat(fee.business.vat_number)}</span>{' '}
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-semibold ${
                            fee.business.vat_status === 'valid'
                              ? 'bg-emerald-100 text-emerald-700'
                              : fee.business.vat_status === 'invalid'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {fee.business.vat_status === 'valid' ? 'VIES ok' : fee.business.vat_status === 'invalid' ? 'VIES non valida' : 'Da verificare'}
                        </span>
                        {fee.business.vat_registered_name && (
                          <span className="block text-gray-500">Registrata a: {fee.business.vat_registered_name}</span>
                        )}
                        {registryLookupUrl(fee.business.vat_number) && (
                          <a
                            href={registryLookupUrl(fee.business.vat_number)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 font-semibold text-amber-700 hover:underline"
                          >
                            Cerca su Ufficio Camerale <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {fee.quantity} × {money(fee.price)} × {Number(fee.percent)}%
                  </td>
                  <td className="px-3 py-2 font-semibold">{money(fee.amount)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        fee.status === 'due' ? 'bg-amber-100 text-amber-800' : fee.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {fee.status === 'due' ? 'Da pagare' : fee.status === 'paid' ? `Pagata${fee.paid_at ? ' ' + when(fee.paid_at) : ''}` : 'Condonata'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fee.status === 'due' && (
                      <button
                        type="button"
                        disabled={working === fee.id}
                        onClick={() => waive(fee)}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Condona
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
