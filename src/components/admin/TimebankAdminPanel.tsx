'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Flag, LoaderCircle, Trash2, X } from 'lucide-react'
import { adminCloseTimebankReport, adminListTimebank, adminRemoveTimebankPost, adminResolveTimebankDispute } from '@/app/actions/admin'

type Person = { first_name: string | null; last_name: string | null; email: string | null } | null
type Row = Record<string, unknown> & { id: string }
type Tab = 'disputes' | 'reports' | 'exchanges' | 'posts'

const name = (p: unknown) => {
  const person = p as Person
  return person ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || person.email || '—' : '—'
}
const when = (iso: unknown) =>
  typeof iso === 'string' ? new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(iso)) : ''
const title = (row: Row) => ((row.post as { title?: string } | null)?.title ?? '') as string

const STATUS: Record<string, string> = {
  proposed: 'Proposto',
  accepted: 'Da svolgere',
  completed: 'Completato',
  cancelled: 'Annullato',
  disputed: 'In contestazione',
}

// Admin → Time Bank: contestazioni da decidere, segnalazioni, scambi e annunci.
export default function TimebankAdminPanel() {
  const [tab, setTab] = useState<Tab>('disputes')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)

  const load = useCallback(async (current: Tab) => {
    setRows(null)
    setError(null)
    const result = await adminListTimebank(current)
    setRows(result.rows as Row[])
    setError(result.error)
  }, [])

  useEffect(() => {
    // Caricamento dal server a ogni cambio di scheda (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
  }, [load, tab])

  const run = async (id: string, action: () => Promise<{ success: boolean; error?: string }>) => {
    setWorking(id)
    const result = await action()
    setWorking(null)
    if (!result.success) alert('Errore: ' + (result.error ?? ''))
    await load(tab)
  }

  const resolve = (row: Row, complete: boolean) => {
    const note = prompt(
      complete
        ? 'Completare lo scambio (le ore passano a chi ha dato aiuto)? Nota per le due persone (facoltativa):'
        : 'Annullare lo scambio (nessuna ora trasferita)? Nota per le due persone (facoltativa):',
    )
    if (note === null) return
    run(row.id, () => adminResolveTimebankDispute(row.id, complete, note))
  }

  const tabs: [Tab, string][] = [
    ['disputes', 'Contestazioni'],
    ['reports', 'Segnalazioni'],
    ['exchanges', 'Tutti gli scambi'],
    ['posts', 'Annunci'],
  ]
  const button = 'flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">KUMANI Time Bank</h2>
        <p className="mt-1 text-gray-600">
          Banca del tempo della community: 1 ora = 1 ora. Qui si decidono le contestazioni (scambi in cui le due persone non sono d&apos;accordo),
          si gestiscono le segnalazioni e si possono rimuovere annunci non ammessi (consulenze professionali, lavori pericolosi, lavoro continuativo).
          I limiti (saldo, ore al giorno e a settimana) sono nelle impostazioni timebank_* del database.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-gray-900 text-white' : 'border border-gray-200 bg-white text-gray-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {rows === null ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">Niente da mostrare.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-xl border border-gray-200 bg-white p-4 text-sm shadow-sm">
              {tab === 'posts' ? (
                <>
                  <p className="font-semibold text-gray-900">
                    {String(row.kind) === 'request' ? 'Cerca aiuto' : 'Offre aiuto'} · {String(row.title)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {name(row.person)} · {String(row.category)} · {String(row.hours)} h · {String(row.mode)} {row.city ? `· ${String(row.city)}` : ''} · {String(row.status)} · {when(row.created_at)}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-gray-800">{String(row.description)}</p>
                  <button
                    type="button"
                    disabled={working === row.id}
                    onClick={() => confirm('Rimuovere questo annuncio dalla bacheca?') && run(row.id, () => adminRemoveTimebankPost(row.id))}
                    className={`${button} mt-3 border border-red-200 text-red-600 hover:bg-red-50`}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Rimuovi annuncio
                  </button>
                </>
              ) : tab === 'reports' ? (
                <>
                  <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                    <Flag className="h-4 w-4 text-red-500" /> Segnalata: {name(row.target_person)} {title(row) ? `· annuncio "${title(row)}"` : ''}
                  </p>
                  <p className="text-xs text-gray-500">
                    Da {name(row.reporter_person)} · {when(row.created_at)} · {String(row.status) === 'open' ? 'da gestire' : 'chiusa'}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-gray-800">{String(row.reason)}</p>
                  {String(row.status) === 'open' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={working === row.id} onClick={() => run(row.id, () => adminCloseTimebankReport(row.id))} className={`${button} border border-gray-300 text-gray-700`}>
                        Chiudi segnalazione
                      </button>
                      {typeof row.post_id === 'string' && (
                        <button
                          type="button"
                          disabled={working === row.id}
                          onClick={() =>
                            confirm('Rimuovere l’annuncio e chiudere la segnalazione?') &&
                            run(row.id, async () => {
                              const removed = await adminRemoveTimebankPost(row.post_id as string)
                              if (!removed.success) return removed
                              return adminCloseTimebankReport(row.id)
                            })
                          }
                          className={`${button} bg-red-600 text-white`}
                        >
                          Rimuovi annuncio e chiudi
                        </button>
                      )}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-400">Per bloccare la persona usa la sezione Utenti.</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-gray-900">{title(row) || 'Scambio'}</p>
                  <p className="text-xs text-gray-500">
                    Dà aiuto: {name(row.giver)} → riceve: {name(row.receiver)} · {String(row.hours)} h · {STATUS[String(row.status)] ?? String(row.status)} · {when(row.created_at)}
                  </p>
                  {typeof row.dispute_reason === 'string' && row.dispute_reason && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-red-50 px-3 py-2 text-red-800">
                      Contestazione ({row.dispute_by === row.giver_id ? 'di chi ha dato aiuto' : 'di chi ha ricevuto'}): {row.dispute_reason}
                    </p>
                  )}
                  {typeof row.staff_note === 'string' && row.staff_note && <p className="mt-1 text-xs text-gray-600">Nota Staff: {row.staff_note}</p>}
                  {String(row.status) === 'disputed' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" disabled={working === row.id} onClick={() => resolve(row, true)} className={`${button} bg-emerald-600 text-white`}>
                        <Check className="h-3.5 w-3.5" /> Completa (trasferisci le ore)
                      </button>
                      <button type="button" disabled={working === row.id} onClick={() => resolve(row, false)} className={`${button} border border-gray-300 text-gray-700`}>
                        <X className="h-3.5 w-3.5" /> Annulla scambio
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
