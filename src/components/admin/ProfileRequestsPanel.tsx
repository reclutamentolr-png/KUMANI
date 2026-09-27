'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Ban, Check, LoaderCircle, RefreshCw, UserPen, X } from 'lucide-react'
import {
  adminApproveProfileRequest,
  adminCancelProfileRequest,
  adminListProfileRequests,
  adminRejectProfileRequest,
  type AdminProfileRequest,
} from '@/app/actions/admin'

type Tab = 'pending' | 'handled'

const FIELD_LABEL: Record<string, string> = {
  first_name: 'Nome',
  last_name: 'Cognome',
  date_of_birth: 'Data di nascita',
  gender: 'Genere',
  phone: 'Telefono',
  country_code: 'Paese',
  city: 'Città',
  province: 'Provincia',
  address: 'Indirizzo',
  postal_code: 'CAP',
  occupation: 'Professione',
}
// Campi che compongono il codice fiscale
const TAX_CODE_FIELDS = ['first_name', 'last_name', 'date_of_birth']

const STATUS_LABEL: Record<AdminProfileRequest['status'], { label: string; className: string }> = {
  pending: { label: 'In attesa', className: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approvata', className: 'bg-emerald-100 text-emerald-800' },
  rejected: { label: 'Rifiutata', className: 'bg-red-100 text-red-800' },
  cancelled: { label: 'Annullata', className: 'bg-gray-100 text-gray-700' },
}

const fullName = (u: { first_name: string | null; last_name: string | null; email: string | null } | null) =>
  u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email || '—' : '—'
const when = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
const show = (v: string | null | undefined) => (v === null || v === undefined || v === '' ? '—' : v === '2000-01-01' ? '— (non indicata)' : v)
const isValidDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

// Admin → Richieste dati anagrafici: dopo il completamento del profilo
// l'utente non può più cambiare da solo i dati anagrafici; li chiede allo
// Staff con un motivo. Lo Staff può correggere i valori prima di applicarli.
export default function ProfileRequestsPanel({ onChanged }: { onChanged?: () => void }) {
  const [tab, setTab] = useState<Tab>('pending')
  const [items, setItems] = useState<AdminProfileRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [values, setValues] = useState<Record<string, Record<string, string>>>({})

  const load = useCallback(async (current: Tab) => {
    setError(null)
    setItems(null)
    const result = await adminListProfileRequests(current)
    setItems(result.items)
    setError(result.error)
    const initial: Record<string, Record<string, string>> = {}
    for (const item of result.items) {
      initial[item.id] = Object.fromEntries(Object.entries(item.requested).map(([k, v]) => [k, v ?? '']))
    }
    setValues(initial)
  }, [])

  useEffect(() => {
    // Caricamento dal server a ogni cambio di scheda (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
  }, [load, tab])

  const setValue = (id: string, field: string, value: string) =>
    setValues((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }))

  const afterAction = async (result: { success: boolean; error: string | null }) => {
    setWorking(null)
    if (!result.success) {
      alert('Errore: ' + (result.error ?? ''))
      return
    }
    await load(tab)
    onChanged?.()
  }

  const approve = async (item: AdminProfileRequest) => {
    const edited = values[item.id] ?? {}
    for (const [field, raw] of Object.entries(edited)) {
      if (!raw.trim()) {
        alert(`Il campo "${FIELD_LABEL[field] ?? field}" non può essere vuoto.`)
        return
      }
      if (field === 'date_of_birth' && !isValidDate(raw.trim())) {
        alert('Data di nascita non valida: usa il formato AAAA-MM-GG.')
        return
      }
    }
    if (!confirm(`Applicare le modifiche al profilo di ${fullName(item.user)}?`)) return
    setWorking(item.id)
    await afterAction(await adminApproveProfileRequest(item.id, edited, notes[item.id] ?? ''))
  }

  const reject = async (item: AdminProfileRequest) => {
    const note = (notes[item.id] ?? '').trim()
    if (!note) {
      alert("Scrivi il motivo del rifiuto (lo vede l'utente).")
      return
    }
    if (!confirm(`Rifiutare la richiesta di ${fullName(item.user)}?`)) return
    setWorking(item.id)
    await afterAction(await adminRejectProfileRequest(item.id, note))
  }

  const cancel = async (item: AdminProfileRequest) => {
    if (!confirm(`Annullare la richiesta di ${fullName(item.user)}? Nessun dato verrà modificato.`)) return
    setWorking(item.id)
    await afterAction(await adminCancelProfileRequest(item.id, notes[item.id] ?? ''))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <UserPen className="h-6 w-6" /> Richieste dati anagrafici
        </h2>
        <p className="mt-1 text-gray-600">
          Con il profilo completo i dati anagrafici sono bloccati: l&apos;utente chiede qui le modifiche indicando il motivo. Puoi correggere i
          valori richiesti prima di applicarli. Il rifiuto richiede una nota, che l&apos;utente vedrà.
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
            const fields = Object.keys(item.requested)
            const edited = values[item.id] ?? {}
            const touchesTaxCode =
              pending &&
              item.user?.has_tax_code &&
              fields.some((f) => TAX_CODE_FIELDS.includes(f) && (edited[f] ?? '').trim() !== (item.user?.current[f] ?? ''))
            const status = STATUS_LABEL[item.status]
            return (
              <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-base font-bold text-gray-900">{fullName(item.user)}</p>
                    <p className="text-xs text-gray-500">{item.user?.email ?? '—'}</p>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <span className={`inline-block rounded-full px-2 py-0.5 font-semibold ${status.className}`}>{status.label}</span>
                    <p className="mt-1">Richiesta il {when(item.created_at)}</p>
                    {item.reviewed_at && (
                      <p>
                        Gestita il {when(item.reviewed_at)}
                        {item.reviewer ? ` da ${fullName(item.reviewer)}` : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
                  <p className="text-xs font-semibold uppercase text-gray-500">Motivo</p>
                  <p className="mt-1 whitespace-pre-line">{item.reason}</p>
                </div>

                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">Campo</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">Valore attuale</th>
                        <th className="px-3 py-2 text-xs font-semibold uppercase text-gray-500">Valore richiesto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {fields.map((field) => {
                        const previous = item.previous[field] ?? null
                        const live = item.user?.current[field] ?? null
                        return (
                          <tr key={field}>
                            <td className="px-3 py-2 font-medium text-gray-900">{FIELD_LABEL[field] ?? field}</td>
                            <td className="px-3 py-2 text-gray-700">
                              {show(previous)}
                              {pending && live !== previous && (
                                <span className="block text-xs text-amber-700">Ora nel profilo: {show(live)}</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {pending ? (
                                <input
                                  type={field === 'date_of_birth' ? 'date' : 'text'}
                                  value={edited[field] ?? ''}
                                  onChange={(e) => setValue(item.id, field, e.target.value)}
                                  maxLength={200}
                                  className="w-full min-w-[10rem] rounded-lg border border-gray-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                                />
                              ) : (
                                <span className="font-semibold text-gray-900">{show(item.requested[field])}</span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {touchesTaxCode && (
                  <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    L&apos;utente ha un codice fiscale verificato: cambiando nome, cognome o data di nascita verifica che il codice fiscale resti
                    coerente.
                  </p>
                )}

                {pending ? (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={notes[item.id] ?? ''}
                      onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                      rows={2}
                      maxLength={1000}
                      placeholder="Nota per l'utente (obbligatoria se rifiuti, facoltativa negli altri casi)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={working === item.id}
                        onClick={() => approve(item)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {working === item.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approva e
                        applica
                      </button>
                      <button
                        type="button"
                        disabled={working === item.id}
                        onClick={() => reject(item)}
                        className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" /> Rifiuta
                      </button>
                      <button
                        type="button"
                        disabled={working === item.id}
                        onClick={() => cancel(item)}
                        className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <Ban className="h-3.5 w-3.5" /> Annulla richiesta
                      </button>
                    </div>
                  </div>
                ) : (
                  item.staff_note && (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
                      <span className="font-semibold">Nota dello Staff:</span> {item.staff_note}
                    </p>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
