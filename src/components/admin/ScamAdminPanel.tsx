'use client'

import { notify } from '@/lib/adminNotify'
import { useCallback, useEffect, useState } from 'react'
import { Check, ExternalLink, Eye, LoaderCircle, MessageSquareWarning, ShieldAlert, Undo2, X } from 'lucide-react'
import { adminScamContestReject, adminScamDecide, adminScamEvidence, adminScamQueue, type AdminScamTarget } from '@/app/actions/scamNet'

type View = 'pending' | 'confirmed' | 'contests'
const VIEWS: { id: View; label: string }[] = [
  { id: 'pending', label: 'Da controllare' },
  { id: 'confirmed', label: 'Confermate' },
  { id: 'contests', label: 'Contestazioni' },
]
const KIND: Record<string, string> = { phone: 'Telefono', site: 'Sito', iban: 'IBAN', email: 'Email', social: 'Profilo social', qr: 'QR code' }
const CATEGORY: Record<string, string> = {
  courier: 'Falso corriere',
  bank: 'Falso operatore della banca',
  investment: 'Investimenti miracolosi',
  romance: 'Truffa sentimentale',
  rental: 'Affitto inesistente',
  marketplace: 'Compravendita online',
  job: 'Falso lavoro',
  support: 'Falsa assistenza tecnica',
  prize: 'Falsa vincita o regalo',
  phishing: 'Furto di dati (phishing)',
  other: 'Altro',
}
const PHONE_TYPE: Record<string, string> = { MOBILE: 'cellulare', FIXED_LINE: 'fisso', FIXED_LINE_OR_MOBILE: 'fisso o cellulare', PREMIUM_RATE: 'A PAGAMENTO', SHARED_COST: 'costo ripartito', TOLL_FREE: 'numero verde', VOIP: 'VoIP', UAN: 'numero unico', PERSONAL_NUMBER: 'personale' }
const when = (iso: string) => new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(iso))
const btn = 'inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold disabled:opacity-50'

function checkLink(row: AdminScamTarget): string | null {
  if (row.kind === 'site') return `/marketplace/svat?url=${encodeURIComponent(row.value)}`
  if (row.kind === 'iban') return `/marketplace/verifica-iban?iban=${encodeURIComponent(row.value)}`
  if (row.kind === 'email') return `/marketplace/checkmail?sender=${encodeURIComponent(row.value)}`
  return null
}

// Admin → Rete Anti-Truffa: lo Staff conferma (l'avviso compare nei controlli),
// chiede prove o scarta; gestisce le contestazioni dei titolari.
export default function ScamAdminPanel() {
  const [view, setView] = useState<View>('pending')
  const [rows, setRows] = useState<AdminScamTarget[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})

  const load = useCallback(async (current: View) => {
    setRows(null)
    const result = await adminScamQueue(current)
    setRows(result.rows)
    setError(result.error)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(view)
  }, [load, view])

  const decide = async (row: AdminScamTarget, decision: 'confirm' | 'dismiss' | 'needs_info' | 'remove') => {
    setWorking(row.id)
    const result = await adminScamDecide(row.id, decision, note[row.id] ?? null)
    setWorking(null)
    if (!result.success) return notify('Errore: ' + (result.error ?? ''))
    notify(
      decision === 'confirm'
        ? '✅ Confermata: l’avviso compare nei controlli, chi ha segnalato riceve i KU Karma'
        : decision === 'needs_info'
          ? '✅ Chiesta una prova a chi ha segnalato'
          : decision === 'remove'
            ? '✅ Avviso ritirato'
            : '✅ Scartata'
    )
    await load(view)
  }

  const showEvidence = async (reportId: string) => {
    const url = await adminScamEvidence(reportId)
    if (url) window.open(url, '_blank', 'noopener')
    else notify('Prova non disponibile')
  }

  const rejectContest = async (id: string) => {
    if (await adminScamContestReject(id)) {
      notify('✅ Contestazione respinta: l’avviso resta')
      await load(view)
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          <ShieldAlert className="h-7 w-7" /> Rete Anti-Truffa
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Le segnalazioni dello stesso numero, sito o IBAN sono già unite. Conferma solo quando il racconto e le prove sono credibili: dopo la conferma chi controlla quel
          dato vede l’avviso e chi ha segnalato riceve i KU Karma. Le prove si cancellano da sole dopo la decisione. Mai nomi di persone private.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {VIEWS.map((v) => (
          <button key={v.id} type="button" onClick={() => setView(v.id)} className={`min-h-10 rounded-full px-4 text-sm font-semibold ${view === v.id ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50'}`}>
            {v.label}
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
            const link = checkLink(row)
            return (
              <li key={row.id} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 font-semibold text-gray-800">{KIND[row.kind] ?? row.kind}</span>
                  <span className="font-semibold text-red-700">
                    {row.reportsCount} segnalazioni{row.confirmedReports ? ` · ${row.confirmedReports} confermate` : ''}
                  </span>
                  <span>· {row.hits} controlli con avviso</span>
                  <span>· ultima {when(row.lastReportAt)}</span>
                </div>
                <p className="break-all text-lg font-bold text-gray-900">{row.value}</p>
                {row.phone && (
                  <p className="text-sm text-gray-600">
                    Numero {row.phone.country ?? '—'} · {PHONE_TYPE[row.phone.type ?? ''] ?? 'tipo sconosciuto'}
                    {row.phone.valid ? '' : ' · numero non valido'}
                  </p>
                )}
                {link && (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:underline">
                    Controlla con lo strumento <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <ul className="space-y-2">
                  {row.reports.map((r) => (
                    <li key={r.id} className="rounded-lg bg-gray-50 p-3 text-sm">
                      <p className="text-xs text-gray-500">
                        {CATEGORY[r.category] ?? r.category} · {r.reporter}
                        {r.city ? ` (${r.city})` : ''} · {when(r.createdAt)} · {r.status}
                      </p>
                      {r.description && <p className="mt-1 whitespace-pre-line text-gray-800">{r.description}</p>}
                      {r.hasEvidence && (
                        <button type="button" onClick={() => showEvidence(r.id)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:underline">
                          <Eye className="h-3.5 w-3.5" /> Vedi la prova
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                {row.contests.filter((c) => c.status === 'open').length > 0 && (
                  <div className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <MessageSquareWarning className="h-4 w-4" /> Contestazioni
                    </p>
                    {row.contests
                      .filter((c) => c.status === 'open')
                      .map((c) => (
                        <div key={c.id} className="space-y-1 rounded-lg bg-white p-2">
                          <p className="whitespace-pre-line">{c.message}</p>
                          <p className="text-xs text-gray-500">
                            {c.who} · {when(c.createdAt)}
                          </p>
                          <div className="flex gap-2">
                            <button type="button" disabled={busy} onClick={() => decide(row, 'remove')} className={`${btn} bg-gray-900 text-white`}>
                              <Undo2 className="h-4 w-4" /> Accogli: ritira l’avviso
                            </button>
                            <button type="button" disabled={busy} onClick={() => rejectContest(c.id)} className={`${btn} border border-gray-300 bg-white text-gray-800`}>
                              Respingi
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                <label className="block text-sm font-medium text-gray-700">
                  Nota per chi ha segnalato (per richiesta di prove o rifiuto)
                  <textarea rows={2} maxLength={300} value={note[row.id] ?? ''} onChange={(e) => setNote((p) => ({ ...p, [row.id]: e.target.value }))} className="mt-1 block w-full rounded-lg border border-gray-300 p-2 text-sm" placeholder="Es. Aggiungi lo screenshot dell’SMS ricevuto." />
                </label>
                <div className="flex flex-wrap gap-2">
                  {row.status !== 'confirmed' ? (
                    <>
                      <button type="button" disabled={busy} onClick={() => decide(row, 'confirm')} className={`${btn} bg-gray-900 text-white`}>
                        <Check className="h-4 w-4" /> Conferma e pubblica
                      </button>
                      <button type="button" disabled={busy} onClick={() => decide(row, 'needs_info')} className={`${btn} border border-gray-300 bg-white text-gray-800`}>
                        Chiedi prove
                      </button>
                      <button type="button" disabled={busy} onClick={() => decide(row, 'dismiss')} className={`${btn} border border-red-200 bg-white text-red-700`}>
                        <X className="h-4 w-4" /> Scarta
                      </button>
                    </>
                  ) : (
                    <>
                      {row.reports.some((r) => r.status === 'pending' || r.status === 'needs_info') && (
                        <button type="button" disabled={busy} onClick={() => decide(row, 'confirm')} className={`${btn} bg-gray-900 text-white`}>
                          <Check className="h-4 w-4" /> Conferma le nuove segnalazioni
                        </button>
                      )}
                      <button type="button" disabled={busy} onClick={() => decide(row, 'remove')} className={`${btn} border border-red-200 bg-white text-red-700`}>
                        <Undo2 className="h-4 w-4" /> Ritira l’avviso
                      </button>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
