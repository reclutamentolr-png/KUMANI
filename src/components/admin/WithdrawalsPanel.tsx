'use client'

import { useCallback, useEffect, useState } from 'react'
import { LoaderCircle, RefreshCw, Undo2 } from 'lucide-react'
import { adminListWithdrawals, adminRefundWithdrawal, adminRejectWithdrawal, type AdminWithdrawal } from '@/app/actions/withdrawals'

type Tab = 'pending' | 'handled'

const STATUS_LABEL: Record<AdminWithdrawal['status'], { label: string; className: string }> = {
  pending: { label: 'In attesa', className: 'bg-amber-100 text-amber-800' },
  refunded: { label: 'Rimborsato', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Rifiutato', className: 'bg-gray-100 text-gray-700' },
}

const fullName = (u: AdminWithdrawal['user']) => (u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email || '—' : '—')
const when = (iso: string | null | undefined) =>
  iso ? new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)) : '—'
const euro = (cents: number | null | undefined) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((cents ?? 0) / 100)
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)

// Admin → Recessi: richieste di recesso (14 giorni) inviate dai clienti da
// /billing. Il rimborso va fatto entro 14 giorni dalla richiesta: Stripe
// rimborsa sulla carta, l'abbonamento si chiude subito e il profilo torna
// gratuito. Chi al pagamento ha chiesto l'avvio immediato ha diritto al
// rimborso della sola parte non usata (art. 57 Codice del Consumo).
export default function WithdrawalsPanel({ onChanged }: { onChanged?: () => void }) {
  const [tab, setTab] = useState<Tab>('pending')
  const [items, setItems] = useState<AdminWithdrawal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})

  const load = useCallback(async (current: Tab) => {
    setError(null)
    setItems(null)
    const result = await adminListWithdrawals(current)
    setItems(result.items)
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento dal server a ogni cambio di scheda (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
  }, [load, tab])

  const refund = async (item: AdminWithdrawal, mode: 'full' | 'proportional') => {
    const amount = mode === 'full' ? item.refundFullCents : item.refundProportionalCents
    const ok = confirm(
      `Rimborsare ${euro(amount)} a ${fullName(item.user)}?\n\n` +
        `• rimborso sulla carta tramite Stripe (${mode === 'full' ? 'importo totale' : 'parte non usata'})\n` +
        `• abbonamento chiuso subito, profilo riportato al piano gratuito\n` +
        `• l'eventuale provvigione dell'agente viene annullata\n\nNon si può annullare.`
    )
    if (!ok) return
    setWorking(item.id)
    try {
      const result = await adminRefundWithdrawal(item.id, mode, notes[item.id] ?? '')
      if (!result.success) alert('Errore: ' + (result.error ?? ''))
    } catch (err) {
      alert('Errore: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setWorking(null)
    }
    await load(tab)
    onChanged?.()
  }

  const reject = async (item: AdminWithdrawal) => {
    const note = (notes[item.id] ?? '').trim()
    if (!note) {
      alert('Scrivi nella nota il motivo del rifiuto: il cliente lo vedrà nella pagina Abbonamento.')
      return
    }
    if (!confirm(`Rifiutare la richiesta di recesso di ${fullName(item.user)}? L'abbonamento resterà attivo.`)) return
    setWorking(item.id)
    try {
      const result = await adminRejectWithdrawal(item.id, note)
      if (!result.success) alert('Errore: ' + (result.error ?? ''))
    } finally {
      setWorking(null)
    }
    await load(tab)
    onChanged?.()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <Undo2 className="h-6 w-6" /> Recessi
        </h2>
        <p className="mt-1 text-gray-600">
          Richieste di recesso inviate dai clienti entro 14 giorni dal pagamento. Il rimborso va eseguito entro 14 giorni dalla richiesta. Se il
          cliente al pagamento ha chiesto l&apos;avvio immediato (consenso registrato), gli spetta il rimborso della parte non usata; altrimenti
          l&apos;importo totale. Rifiuta solo con un motivo valido (es. richiesta fuori termine): il cliente vedrà la nota.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'pending', label: 'In attesa' },
            { key: 'handled', label: 'Gestite' },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t.key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700'}`}
          >
            {t.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => load(tab)}
          className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
        >
          <RefreshCw className="h-4 w-4" /> Aggiorna
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {items === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          {tab === 'pending' ? 'Nessuna richiesta in attesa.' : 'Nessuna richiesta gestita.'}
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const pending = item.status === 'pending'
            const status = STATUS_LABEL[item.status]
            const age = daysSince(item.requested_at)
            const busy = working === item.id
            const suggested = item.consent_at ? 'proportional' : 'full'
            return (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-gray-900">{fullName(item.user)}</p>
                    <p className="text-xs text-gray-500">{item.user?.email ?? '— (account non più presente)'}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Piano {item.user?.subscription_plan === 'pro' ? 'Pro' : 'Base'} · pagato {euro(item.amount_cents)} negli ultimi 14 giorni
                    </p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${status.className}`}>{status.label}</span>
                    <p className="mt-1">Richiesta il {when(item.requested_at)}</p>
                    {pending && (
                      <p className={age >= 10 ? 'font-semibold text-red-600' : ''}>
                        {age >= 14 ? 'Termine di 14 giorni superato!' : `Rimborsare entro ${14 - age} giorni`}
                      </p>
                    )}
                    {!pending && <p>Gestita il {when(item.handled_at)}</p>}
                  </div>
                </div>

                <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  {item.consent_at
                    ? `Consenso all'avvio immediato dato il ${when(item.consent_at)}: spetta il rimborso della parte non usata.`
                    : 'Nessun consenso all’avvio immediato registrato: spetta il rimborso totale.'}
                </p>
                {item.reason && <p className="mt-2 text-sm text-gray-700">Motivo del cliente: “{item.reason}”</p>}

                {!pending && (
                  <p className="mt-2 text-sm text-gray-700">
                    {item.status === 'refunded'
                      ? `Rimborsati ${euro(item.refunded_cents)} (${item.refund_mode === 'full' ? 'totale' : 'parte non usata'}).`
                      : 'Richiesta rifiutata.'}
                    {item.admin_note && ` Nota: ${item.admin_note}`}
                  </p>
                )}

                {pending && (
                  <div className="mt-3 space-y-3">
                    <textarea
                      value={notes[item.id] ?? ''}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                      maxLength={1000}
                      rows={2}
                      placeholder="Nota (visibile al cliente; obbligatoria per rifiutare)"
                      className="w-full rounded-lg border border-gray-300 p-2 text-sm"
                    />
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {(['proportional', 'full'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          disabled={busy || (mode === 'full' ? item.refundFullCents : item.refundProportionalCents) === undefined}
                          onClick={() => refund(item, mode)}
                          className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                            mode === suggested ? 'bg-green-600 text-white hover:bg-green-700' : 'border border-green-600 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          {mode === 'full'
                            ? `Rimborso totale ${euro(item.refundFullCents)}`
                            : `Rimborso parte non usata ${euro(item.refundProportionalCents)}`}
                          {mode === suggested && ' (consigliato)'}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => reject(item)}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Rifiuta
                      </button>
                      {busy && <LoaderCircle className="h-5 w-5 animate-spin self-center text-gray-400" />}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
