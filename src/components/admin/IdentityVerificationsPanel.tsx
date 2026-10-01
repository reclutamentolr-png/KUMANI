'use client'

import { notify } from '@/lib/adminNotify'
import { useCallback, useEffect, useState } from 'react'
import { Check, ExternalLink, FileText, LoaderCircle, RefreshCw, ScanFace, X } from 'lucide-react'
import { adminListIdentityVerifications, adminReviewIdentity, type AdminIdentityVerification } from '@/app/actions/admin'

type Tab = 'pending' | 'reviewed'

const DOC_LABEL: Record<AdminIdentityVerification['doc_type'], string> = {
  passport: 'Passaporto',
  id_card: "Carta d'identità",
  driving_license: 'Patente di guida',
  residence_permit: 'Permesso di soggiorno',
}

const fullName = (u: AdminIdentityVerification['user'] | AdminIdentityVerification['reviewer']) =>
  u ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() || u.email || '—' : '—'
const when = (iso: string) => new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
const birth = (date: string | null) =>
  date && date !== '2000-01-01' ? new Intl.DateTimeFormat('it-IT', { timeZone: 'UTC', dateStyle: 'long' }).format(new Date(`${date}T00:00:00Z`)) : 'non indicata'

// Admin → Verifica identità: documenti caricati da chi non ha il codice
// fiscale italiano. Lo Staff confronta nome e data di nascita del profilo con
// il documento, approva o rifiuta con una nota; dopo la decisione il file
// viene cancellato e resta solo l'esito.
export default function IdentityVerificationsPanel() {
  const [tab, setTab] = useState<Tab>('pending')
  const [items, setItems] = useState<AdminIdentityVerification[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [rejecting, setRejecting] = useState<string | null>(null)

  const load = useCallback(async (current: Tab) => {
    setError(null)
    setItems(null)
    const result = await adminListIdentityVerifications(current)
    setItems(result.items)
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento dal server a ogni cambio di scheda (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
  }, [load, tab])

  const decide = async (item: AdminIdentityVerification, approve: boolean) => {
    const note = (notes[item.id] ?? '').trim()
    if (!approve && !note) {
      notify('Scrivi il motivo del rifiuto (lo vede l\'utente).')
      return
    }
    if (approve && !confirm(`Approvare il documento di ${fullName(item.user)}? Il file verrà cancellato.`)) return
    setWorking(item.id)
    const result = await adminReviewIdentity(item.id, approve, note)
    setWorking(null)
    if (!result.success) notify('Errore: ' + (result.error ?? ''))
    else if (result.warning) notify(result.warning)
    setRejecting(null)
    await load(tab)
  }

  const spinner = (
    <div className="flex justify-center py-10">
      <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ScanFace className="h-6 w-6" /> Verifica identità
        </h2>
        <p className="mt-1 text-gray-600">
          Documenti di chi non ha il codice fiscale italiano (Kumano Verificato per Kordata ed Events). Controlla che nome, cognome e data di
          nascita coincidano con il profilo e che il documento sia valido e leggibile. Dopo la decisione il file viene cancellato: resta solo
          l&apos;esito. I link alle immagini valgono 10 minuti (usa &quot;Aggiorna&quot; se scadono).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'pending', label: 'Da verificare' },
            { key: 'reviewed', label: 'Decisioni recenti' },
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
        <button type="button" onClick={() => load(tab)} className="ml-auto flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <RefreshCw className="h-4 w-4" /> Aggiorna
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {items === null ? (
        spinner
      ) : items.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">
          {tab === 'pending' ? 'Nessun documento da verificare.' : 'Nessuna decisione.'}
        </p>
      ) : tab === 'pending' ? (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
                <div className="space-y-2 text-sm">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs font-semibold uppercase text-gray-500">Profilo da confrontare</p>
                    <p className="mt-1 text-base font-bold text-gray-900">{fullName(item.user)}</p>
                    <p className="text-gray-700">
                      Nato/a il <span className="font-semibold">{birth(item.user?.date_of_birth ?? null)}</span>
                    </p>
                    <p className="text-xs text-gray-500">{item.user?.email ?? '—'}</p>
                  </div>
                  <p className="text-gray-700">
                    <span className="font-semibold">{DOC_LABEL[item.doc_type] ?? item.doc_type}</span> · Paese {item.country_code}
                  </p>
                  <p className="text-xs text-gray-500">Caricato il {when(item.created_at)}</p>
                  <textarea
                    value={notes[item.id] ?? ''}
                    onChange={(e) => setNotes({ ...notes, [item.id]: e.target.value })}
                    rows={rejecting === item.id ? 3 : 2}
                    maxLength={1000}
                    placeholder="Nota (obbligatoria se rifiuti: la vede l'utente, es. foto illeggibile, dati diversi dal profilo…)"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={working === item.id}
                      onClick={() => decide(item, true)}
                      className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {working === item.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approva
                    </button>
                    <button
                      type="button"
                      disabled={working === item.id}
                      onClick={() => {
                        if ((notes[item.id] ?? '').trim()) decide(item, false)
                        else setRejecting(item.id)
                      }}
                      className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Rifiuta con nota
                    </button>
                  </div>
                  {rejecting === item.id && !(notes[item.id] ?? '').trim() && (
                    <p className="text-xs font-semibold text-red-700">Scrivi il motivo del rifiuto nella nota, poi premi di nuovo &quot;Rifiuta&quot;.</p>
                  )}
                </div>

                <div className="min-h-48 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
                  {!item.signed_url ? (
                    <p className="p-6 text-center text-sm text-gray-500">{item.has_file ? 'Anteprima non disponibile: premi "Aggiorna".' : 'Nessun file.'}</p>
                  ) : item.is_pdf ? (
                    <div className="flex h-full flex-col">
                      <iframe src={item.signed_url} title="Documento" className="h-96 w-full bg-white" />
                      <a href={item.signed_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-gray-700 hover:underline">
                        <FileText className="h-3.5 w-3.5" /> Apri il PDF <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <a href={item.signed_url} target="_blank" rel="noopener noreferrer" title="Apri a tutta grandezza">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.signed_url} alt="Documento d'identità" className="max-h-[28rem] w-full object-contain" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Utente</th>
                <th className="px-3 py-2">Documento</th>
                <th className="px-3 py-2">Esito</th>
                <th className="px-3 py-2">Nota</th>
                <th className="px-3 py-2">Deciso da</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900">{fullName(item.user)}</p>
                    <p className="text-xs text-gray-500">{item.user?.email ?? ''}</p>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {DOC_LABEL[item.doc_type] ?? item.doc_type} · {item.country_code}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {item.status === 'approved' ? 'Approvato' : 'Rifiutato'}
                    </span>
                  </td>
                  <td className="max-w-xs px-3 py-2 text-xs text-gray-600">{item.review_note ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {fullName(item.reviewer)}
                    {item.reviewed_at ? <span className="block">{when(item.reviewed_at)}</span> : null}
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
