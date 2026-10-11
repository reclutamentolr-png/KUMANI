'use client'

import { notify } from '@/lib/adminNotify'
import { useCallback, useEffect, useState } from 'react'
import { Check, ExternalLink, Flag, LoaderCircle, MessageSquareText, Pencil, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { adminCloseProposalReports, adminListProposals, adminSetProposal, type AdminProposal } from '@/app/actions/proposals'
import type { ProposalStatus } from '@/lib/proposals'

type Tab = 'pending' | 'reported' | 'published'

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Da controllare' },
  { id: 'reported', label: 'Segnalate' },
  { id: 'published', label: 'Pubblicate' },
]
const STATUS_LABEL: Record<ProposalStatus, string> = {
  pending: 'Da controllare',
  changes: 'Modifica chiesta',
  rejected: 'Rifiutata',
  open: 'Nuova',
  review: 'In valutazione',
  planned: 'Pianificata',
  done: 'Realizzata',
  declined: 'Non ora',
}
const PUBLIC_STATUSES: ProposalStatus[] = ['open', 'review', 'planned', 'done', 'declined']
const TOPIC_LABEL: Record<string, string> = { existing: 'Servizio esistente', new: 'Servizio nuovo', app: 'App in generale' }
const REASON_LABEL: Record<string, string> = {
  politics: 'Politica',
  against: 'Contro persone o aziende',
  ads: 'Pubblicità',
  offensive: 'Offensiva',
  duplicate: 'Doppione',
  other: 'Altro',
}
const when = (iso: string) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(iso))
const btn = 'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50'

// Admin → Proposte della community: controllo prima della pubblicazione,
// segnalazioni, stato e risposta pubblica dello Staff.
export default function ProposalsAdminPanel() {
  const [tab, setTab] = useState<Tab>('pending')
  const [rows, setRows] = useState<AdminProposal[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  // Testi in scrittura per proposta: risposta pubblica, nota all'autore, stato scelto
  const [reply, setReply] = useState<Record<string, string>>({})
  const [note, setNote] = useState<Record<string, string>>({})
  const [nextStatus, setNextStatus] = useState<Record<string, ProposalStatus>>({})

  const load = useCallback(async (current: Tab) => {
    setRows(null)
    setError(null)
    const result = await adminListProposals(current)
    setRows(result.rows)
    setError(result.error)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
  }, [load, tab])

  const setStatus = async (row: AdminProposal, status: ProposalStatus) => {
    setWorking(row.id)
    const result = await adminSetProposal(row.id, status, reply[row.id] ?? row.staff_reply ?? null, note[row.id] ?? null)
    setWorking(null)
    if (!result.success) {
      notify('Errore: ' + (result.error ?? ''))
      return
    }
    notify(status === 'done' ? '✅ Segnata come realizzata: l’autore riceve i KU Karma e una notifica' : '✅ Salvato: l’autore riceve una notifica')
    await load(tab)
  }

  const closeReports = async (row: AdminProposal) => {
    setWorking(row.id)
    const result = await adminCloseProposalReports(row.id)
    setWorking(null)
    if (!result.success) notify('Errore: ' + (result.error ?? ''))
    await load(tab)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Proposte della community</h2>
        <p className="mt-1 text-sm text-gray-600">
          Le proposte compaiono solo dopo il controllo. Regole: niente politica, niente campagne contro persone o aziende, niente pubblicità. La risposta dello
          Staff è pubblica; la nota a chi propone la vede solo l’autore.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-h-10 rounded-full px-4 text-sm font-semibold ${tab === t.id ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {rows === null ? (
        <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">Niente da gestire qui.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => {
            const busy = working === row.id
            const chosen = nextStatus[row.id] ?? (PUBLIC_STATUSES.includes(row.status) ? row.status : 'open')
            return (
              <li key={row.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-800">{STATUS_LABEL[row.status]}</span>
                  <span>{TOPIC_LABEL[row.topic] ?? row.topic}{row.tool_name ? ` · ${row.tool_name}` : ''}</span>
                  <span>· {row.votes_count} sostegni</span>
                  <span>· {when(row.created_at)}</span>
                  <span>· {row.author_name || '—'} {row.author_email ? `(${row.author_email})` : ''}</span>
                </div>
                <div>
                  <p className="text-base font-bold text-gray-900">{row.title}</p>
                  <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{row.body}</p>
                </div>

                {row.reports.length > 0 && (
                  <div className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Flag className="h-4 w-4" /> {row.reports.length} segnalazioni aperte
                    </p>
                    <ul className="mt-1 list-inside list-disc">
                      {row.reports.map((r, i) => (
                        <li key={i}>
                          {REASON_LABEL[r.reason] ?? r.reason}
                          {r.note ? ` — «${r.note}»` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {tab !== 'pending' && (
                  <Link href={`/community/proposte/${row.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:underline">
                    Apri la proposta <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <MessageSquareText className="h-4 w-4" /> Risposta pubblica dello Staff
                    </span>
                    <textarea
                      rows={3}
                      maxLength={1000}
                      value={reply[row.id] ?? row.staff_reply ?? ''}
                      onChange={(e) => setReply((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="Es. Bella idea: la mettiamo in programma per l’inverno."
                      className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-medium text-gray-700">
                    <span className="flex items-center gap-1.5">
                      <Pencil className="h-4 w-4" /> Nota per l’autore (per modifica o rifiuto)
                    </span>
                    <textarea
                      rows={3}
                      maxLength={300}
                      value={note[row.id] ?? ''}
                      onChange={(e) => setNote((prev) => ({ ...prev, [row.id]: e.target.value }))}
                      placeholder="Es. Togli il riferimento al partito: le proposte non sono politiche."
                      className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-sm"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {tab === 'pending' ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => setStatus(row, 'open')} className={`${btn} bg-gray-900 text-white`}>
                        <Check className="h-4 w-4" /> Pubblica
                      </button>
                      <button type="button" disabled={busy} onClick={() => setStatus(row, 'changes')} className={`${btn} border border-gray-300 bg-white text-gray-800`}>
                        <Pencil className="h-4 w-4" /> Chiedi modifica
                      </button>
                      <button type="button" disabled={busy} onClick={() => setStatus(row, 'rejected')} className={`${btn} border border-red-200 bg-white text-red-700`}>
                        <X className="h-4 w-4" /> Rifiuta
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        Stato
                        <select
                          value={chosen}
                          onChange={(e) => setNextStatus((prev) => ({ ...prev, [row.id]: e.target.value as ProposalStatus }))}
                          className="min-h-10 rounded-lg border border-gray-300 bg-white px-2 text-sm"
                        >
                          {PUBLIC_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="button" disabled={busy} onClick={() => setStatus(row, chosen)} className={`${btn} bg-gray-900 text-white`}>
                        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salva stato e risposta
                      </button>
                      {row.reports.length > 0 && (
                        <button type="button" disabled={busy} onClick={() => closeReports(row)} className={`${btn} border border-gray-300 bg-white text-gray-800`}>
                          Segnalazioni gestite
                        </button>
                      )}
                      <button type="button" disabled={busy} onClick={() => setStatus(row, 'rejected')} className={`${btn} border border-red-200 bg-white text-red-700`}>
                        <X className="h-4 w-4" /> Ritira
                      </button>
                    </>
                  )}
                </div>
                {chosen === 'done' && tab === 'published' && row.status !== 'done' && (
                  <p className="text-xs text-gray-600">Segnandola «Realizzata» l’autore riceve i KU Karma previsti in Gestione KU («Proposta della community realizzata») e chi l’ha sostenuta riceve una notifica.</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
