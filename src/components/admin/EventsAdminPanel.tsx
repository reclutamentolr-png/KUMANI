'use client'

import { notify } from '@/lib/adminNotify'
import { useCallback, useEffect, useState } from 'react'
import { Ban, Check, ExternalLink, Flag, LoaderCircle, Percent, RotateCcw, Star, Trash2, X } from 'lucide-react'
import {
  adminBanEvent,
  adminDeleteEventReview,
  adminGetEventsFeePercent,
  adminGetEventsFreeFee,
  adminListEventFees,
  adminListEventReports,
  adminListEventReviews,
  adminListEvents,
  adminResolveEventReport,
  adminReviewEvent,
  adminSetEventsFeePercent,
  adminSetEventsFreeFee,
  adminUnbanEvent,
  adminWaiveEventFee,
} from '@/app/actions/admin'

type Person = { first_name: string | null; last_name: string | null; email: string | null } | null
type AdminEvent = Awaited<ReturnType<typeof adminListEvents>>['events'][number] & { organizer: Person }
type AdminReport = Awaited<ReturnType<typeof adminListEventReports>>['reports'][number]
type AdminFee = Awaited<ReturnType<typeof adminListEventFees>>['fees'][number]
type AdminReview = Awaited<ReturnType<typeof adminListEventReviews>>['reviews'][number]
type Tab = 'pending' | 'published' | 'closed' | 'reports' | 'reviews' | 'fees'

const name = (p: Person) => (p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.email || '—' : '—')
const money = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(v))
const when = (iso: string, tz = 'Europe/Rome') =>
  new Intl.DateTimeFormat('it-IT', { timeZone: tz, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))

// Admin → Eventi: approvazione dei primi eventi dei nuovi organizzatori,
// eventi pubblicati (blocco), segnalazioni e commissioni KUMANI.
export default function EventsAdminPanel({
  locale,
  canReadSettings = true,
  canWrite = true,
}: {
  locale: string
  // Percentuali: servono i permessi delle Impostazioni
  canReadSettings?: boolean
  canWrite?: boolean
}) {
  const [tab, setTab] = useState<Tab>('pending')
  const [events, setEvents] = useState<AdminEvent[] | null>(null)
  const [reports, setReports] = useState<AdminReport[] | null>(null)
  const [fees, setFees] = useState<AdminFee[] | null>(null)
  const [reviews, setReviews] = useState<AdminReview[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [working, setWorking] = useState<string | null>(null)
  const [percent, setPercent] = useState('')
  const [superPercent, setSuperPercent] = useState('')
  const [freeFee, setFreeFee] = useState('')
  const [percentSaved, setPercentSaved] = useState<string | null>(null)

  const load = useCallback(async (current: Tab) => {
    setError(null)
    if (current === 'pending' || current === 'published' || current === 'closed') {
      setEvents(null)
      const result = await adminListEvents(current)
      setEvents(result.events as AdminEvent[])
      setError(result.error)
    } else if (current === 'reports') {
      setReports(null)
      const result = await adminListEventReports()
      setReports(result.reports)
      setError(result.error)
    } else if (current === 'reviews') {
      setReviews(null)
      const result = await adminListEventReviews()
      setReviews(result.reviews)
      setError(result.error)
    } else {
      setFees(null)
      const result = await adminListEventFees()
      setFees(result.fees)
      setError(result.error)
    }
  }, [])

  useEffect(() => {
    // Caricamento dal server a ogni cambio di scheda (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(tab)
  }, [load, tab])

  useEffect(() => {
    if (!canReadSettings) return
    adminGetEventsFeePercent('standard').then((result) => {
      if (result.percent !== null) setPercent(String(result.percent))
    })
    adminGetEventsFeePercent('super').then((result) => {
      if (result.percent !== null) setSuperPercent(String(result.percent))
    })
    adminGetEventsFreeFee().then((result) => {
      if (result.fee !== null) setFreeFee(String(result.fee))
    })
  }, [canReadSettings])

  const run = async (id: string, action: () => Promise<{ success: boolean; error?: string; warning?: string }>) => {
    setWorking(id)
    const result = await action()
    setWorking(null)
    if (!result.success) notify('Errore: ' + (result.error ?? ''))
    else if (result.warning) notify(result.warning)
    await load(tab)
  }

  const review = (event: AdminEvent, approve: boolean) => {
    const note = approve ? '' : prompt(`Motivo del rifiuto di "${event.title}" (lo vede l'organizzatore):`)
    if (!approve && !note?.trim()) return
    run(event.id, () => adminReviewEvent(event.id, approve, note ?? ''))
  }

  const ban = (event: Pick<AdminEvent, 'id' | 'title' | 'series_id'>) => {
    const note = prompt(`Bloccare "${event.title}"? Scrivi il motivo (lo vede l'organizzatore):`)
    if (note === null) return
    const wholeSeries = !!event.series_id && confirm('È una serie di date: bloccare anche tutte le date successive? (Annulla = solo questa data)')
    run(event.id, () => adminBanEvent(event.id, note, wholeSeries))
  }

  const savePercent = async (e: React.FormEvent) => {
    e.preventDefault()
    const freeText = freeFee.trim().replace(',', '.') || '0'
    if (!/^\d{1,2}(\.\d{1,2})?$/.test(freeText) || Number(freeText) > 50) {
      setPercentSaved('Errore: la quota per iscritto sugli eventi gratuiti va da 0 a 50 €, al massimo 2 decimali')
      return
    }
    const [standard, reduced, free] = await Promise.all([
      adminSetEventsFeePercent(Number(percent.replace(',', '.')), 'standard'),
      adminSetEventsFeePercent(Number(superPercent.replace(',', '.')), 'super'),
      adminSetEventsFreeFee(Number(freeText)),
    ])
    const failed = [standard, reduced, free].find((r) => !r.success)
    setPercentSaved(failed ? `Errore: ${failed.error}` : 'Salvato')
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'pending', label: 'Da approvare' },
    { key: 'published', label: 'Pubblicati' },
    { key: 'closed', label: 'Rifiutati / bloccati' },
    { key: 'reports', label: 'Segnalazioni' },
    { key: 'reviews', label: 'Recensioni' },
    { key: 'fees', label: 'Commissioni' },
  ]

  const spinner = (
    <div className="flex justify-center py-10">
      <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
    </div>
  )
  const empty = (text: string) => <p className="rounded-xl border border-gray-200 bg-white p-6 text-center text-sm text-gray-500">{text}</p>
  const eventLink = (id: string) => (
    <a href={`/${locale}/events/${id}`} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700">
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">KUMANI Events</h2>
        <p className="mt-1 text-gray-600">
          Gli eventi dei nuovi organizzatori (max 20 posti) vanno approvati qui; gli organizzatori fidati (almeno 2 eventi conclusi e buone recensioni) pubblicano da soli (max 100 posti), i Super Organizer fino a 300 posti con commissione ridotta.
          Il prezzo si paga all&apos;organizzatore sul posto: a evento concluso KUMANI calcola la commissione, pagata con carta.
        </p>
      </div>

      {canReadSettings && (
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
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700">Super Organizer (%)</label>
          <div className="flex items-center gap-2">
            <input
              value={superPercent}
              onChange={(e) => {
                setSuperPercent(e.target.value.replace(/[^0-9.,]/g, ''))
                setPercentSaved(null)
              }}
              inputMode="decimal"
              className="w-24 rounded-lg border border-gray-300 px-3 py-2"
            />
            <Percent className="h-4 w-4 text-gray-400" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700">Quota fissa per iscritto sugli eventi gratuiti (€)</label>
          <div className="flex items-center gap-2">
            <input
              value={freeFee}
              onChange={(e) => {
                setFreeFee(e.target.value.replace(/[^0-9.,]/g, ''))
                setPercentSaved(null)
              }}
              inputMode="decimal"
              className="w-24 rounded-lg border border-gray-300 px-3 py-2"
            />
            <span className="text-sm text-gray-400">€</span>
          </div>
        </div>
        <button type="submit" className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white">
          Salva
        </button>
        <p className="text-xs text-gray-500">
          Percentuali da 0 a 30, quota fissa da 0 a 50 € (0 = eventi gratuiti senza commissione). Valgono per i nuovi eventi: ogni evento conserva la
          percentuale o la quota con cui è stato salvato (dopo le prime iscrizioni non cambia più).
        </p>
        {percentSaved && <p className="w-full text-sm font-semibold text-gray-700">{percentSaved}</p>}
      </form>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {(tab === 'pending' || tab === 'published' || tab === 'closed') &&
        (events === null
          ? spinner
          : events.length === 0
            ? empty(tab === 'pending' ? 'Nessun evento da approvare.' : tab === 'closed' ? 'Nessun evento rifiutato, bloccato o annullato.' : 'Nessun evento pubblicato.')
            : (
              <div className="space-y-3">
                {events.map((event) => (
                  <div key={event.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="text-sm">
                        <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                          {event.title} {eventLink(event.id)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {when(event.starts_at, event.timezone)} ({event.timezone}) · {event.mode} · {event.city || 'online'} {event.country_code ?? ''}
                        </p>
                        <p className="text-xs text-gray-500">
                          Organizzatore {name(event.organizer)} · {event.people}/{event.capacity} iscritti · {Number(event.price) > 0 ? money(event.price) : 'gratuito'}
                          {Number(event.price) > 0
                            ? ''
                            : event.free_declared_at
                              ? ` (dichiarato «nessun pagamento» il ${when(event.free_declared_at)}${Number(event.free_fee_eur) > 0 ? `, quota ${money(event.free_fee_eur)} per iscritto` : ''})`
                              : ' (senza dichiarazione: evento creato prima della regola)'}
                          {event.is_18plus ? ' · 18+' : ''}
                          {event.fidelity_stamp ? ' · timbro Kumi Card' : ''}
                          {event.kids_friendly ? ' · adatto ai bambini' : ''}
                        </p>
                        {(event.venue_name || event.address) && (
                          <p className="text-xs text-gray-700">
                            Luogo: {[event.venue_name, event.address].filter(Boolean).join(' · ')}
                          </p>
                        )}
                        <p className="flex flex-wrap gap-3 text-xs">
                          {event.map_link && (
                            <a href={event.map_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-amber-700 hover:underline">
                              Mappa
                            </a>
                          )}
                          {event.online_link && (
                            <a href={event.online_link} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-amber-700 hover:underline">
                              Link online: {event.online_link}
                            </a>
                          )}
                          {event.ends_at && <span className="text-gray-500">Fine: {when(event.ends_at, event.timezone)}</span>}
                          {(event.languages ?? []).length > 0 && <span className="text-gray-500">Lingue: {(event.languages ?? []).join(', ')}</span>}
                        </p>
                        {tab === 'closed' && (
                          <p className="text-xs font-semibold text-gray-700">
                            Stato: {event.status === 'banned' ? 'bloccato' : event.status === 'rejected' ? 'rifiutato' : 'annullato'}
                            {event.review_note ? ` · Nota: ${event.review_note}` : ''}
                          </p>
                        )}
                        {event.series_id && tab === 'pending' && (
                          <p className="text-xs font-semibold text-amber-700">
                            Date ripetute: approvando o rifiutando questa data, la decisione vale per tutte le date della serie in attesa.
                          </p>
                        )}
                      </div>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">{event.type}</span>
                    </div>
                    <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">{event.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canWrite && tab === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={working === event.id}
                            onClick={() => review(event, true)}
                            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" /> Approva e pubblica
                          </button>
                          <button
                            type="button"
                            disabled={working === event.id}
                            onClick={() => review(event, false)}
                            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" /> Rifiuta con nota
                          </button>
                        </>
                      )}
                      {canWrite && tab !== 'closed' && (
                        <button
                          type="button"
                          disabled={working === event.id}
                          onClick={() => ban(event)}
                          className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <Ban className="h-3.5 w-3.5" /> Blocca
                        </button>
                      )}
                      {canWrite && tab === 'closed' && event.status === 'banned' && (
                        <button
                          type="button"
                          disabled={working === event.id}
                          onClick={() => confirm(`Sbloccare e ripubblicare "${event.title}"?`) && run(event.id, () => adminUnbanEvent(event.id))}
                          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Sblocca
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))}

      {tab === 'reports' &&
        (reports === null
          ? spinner
          : reports.length === 0
            ? empty('Nessuna segnalazione.')
            : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div
                    key={report.id}
                    className={`rounded-xl border bg-white p-4 shadow-sm ${
                      report.status === 'open' ? (report.kind === 'free_paid' ? 'border-2 border-red-500' : 'border-red-200') : 'border-gray-200 opacity-70'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="text-sm">
                        <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                          <Flag className="h-4 w-4 text-red-500" /> {report.event?.title ?? '—'} {report.event && eventLink(report.event.id)}
                        </p>
                        {report.kind === 'free_paid' && (
                          <p className="mt-1">
                            <span className="inline-flex rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
                              Pagamento chiesto per un evento dichiarato gratuito
                            </span>
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Organizzatore {name(report.organizer)} · stato {report.event?.status}
                        </p>
                        {report.event && Number(report.event.price) === 0 && (
                          <p className="text-xs text-gray-500">
                            {report.event.free_declared_at
                              ? `Evento gratuito: dichiarazione «nessun pagamento» del ${when(report.event.free_declared_at)}`
                              : 'Evento gratuito senza dichiarazione (creato prima della regola)'}
                          </p>
                        )}
                        <p className="text-xs text-gray-500">
                          Segnalato da {name(report.reporter)} · {when(report.created_at)}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${report.status === 'open' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                        {report.status === 'open' ? 'Da gestire' : 'Chiusa'}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">{report.reason}</p>
                    {report.status === 'open' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={working === report.id}
                          onClick={() => run(report.id, () => adminResolveEventReport(report.id))}
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Chiudi segnalazione
                        </button>
                        {report.event && report.event.status !== 'banned' && (
                          <button
                            type="button"
                            disabled={working === report.id}
                            onClick={() => {
                              const ev = report.event!
                              const note = prompt(`Bloccare "${ev.title}"? Scrivi il motivo (lo vede l'organizzatore):`)
                              if (note === null) return
                              run(report.id, async () => {
                                const banned = await adminBanEvent(ev.id, note)
                                if (!banned.success) return banned
                                return adminResolveEventReport(report.id)
                              })
                            }}
                            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            Chiudi e blocca l&apos;evento
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}

      {tab === 'reviews' &&
        (reviews === null
          ? spinner
          : reviews.length === 0
            ? empty('Nessuna recensione.')
            : (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <div key={review.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="text-sm">
                        <p className="flex items-center gap-1.5 font-semibold text-gray-900">
                          {review.event?.title ?? '—'} {review.event && eventLink(review.event.id)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Organizzatore {name(review.organizer)} · recensione di {name(review.reviewer)} · {when(review.created_at)}
                        </p>
                      </div>
                      <span className="flex items-center gap-0.5" aria-label={`${review.rating} stelle su 5`}>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-4 w-4 ${n <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                        ))}
                      </span>
                    </div>
                    {review.comment && <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">{review.comment}</p>}
                    <div className="mt-3">
                      <button
                        type="button"
                        disabled={working === review.id}
                        onClick={() => confirm("Eliminare questa recensione? La media dell'organizzatore verrà ricalcolata.") && run(review.id, () => adminDeleteEventReview(review.id))}
                        className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Elimina recensione
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}

      {tab === 'fees' &&
        (fees === null
          ? spinner
          : fees.length === 0
            ? empty('Nessuna commissione.')
            : (
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-3 py-2">Evento</th>
                      <th className="px-3 py-2">Organizzatore</th>
                      <th className="px-3 py-2">Calcolo</th>
                      <th className="px-3 py-2">Importo</th>
                      <th className="px-3 py-2">Stato</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fees.map((fee) => (
                      <tr key={fee.id}>
                        <td className="px-3 py-2 font-medium text-gray-900">{fee.event?.title ?? '—'}</td>
                        <td className="px-3 py-2 text-gray-600">{name(fee.organizer)}</td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {Number(fee.price) > 0
                            ? `${fee.participants} × ${money(fee.price)} × ${Number(fee.percent)}%`
                            : `${fee.participants} × ${money(fee.participants > 0 ? Number(fee.amount) / fee.participants : 0)} (evento gratuito, quota fissa)`}
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
                              onClick={() => confirm('Condonare questa commissione?') && run(fee.id, () => adminWaiveEventFee(fee.id))}
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
            ))}
    </div>
  )
}
