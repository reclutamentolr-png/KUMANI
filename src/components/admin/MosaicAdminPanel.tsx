'use client'

import { notify } from '@/lib/adminNotify'
import { useCallback, useEffect, useState } from 'react'
import { Check, Eraser, Flag, Grid3x3, LoaderCircle, Pencil, Plus, Trash2, Users } from 'lucide-react'
import {
  adminClearMosaicUser,
  adminCloseMosaicReport,
  adminDeleteMosaicSeason,
  adminListMosaicReports,
  adminListMosaicContributors,
  adminListMosaicSeasons,
  adminSaveMosaicSeason,
  type MosaicAdminReport,
  type MosaicAdminSeason,
} from '@/app/actions/admin'
import MosaicAdminEditor from './MosaicAdminEditor'
import { askConfirm } from '@/lib/confirm'

const REASON: Record<string, string> = { offensive: 'Offensiva', advertising: 'Pubblicità', other: 'Altro' }

type Form = { title: string; theme: string; width: number; height: number; startsAt: string; endsAt: string }

const when = (iso: string) =>
  new Intl.DateTimeFormat('it-IT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Rome' }).format(new Date(iso))
// datetime-local lavora in ora locale del browser (lo Staff è in Italia)
const toLocalInput = (iso: string) => {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

const emptyForm = (): Form => {
  const start = new Date()
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  return { title: '', theme: '', width: 64, height: 64, startsAt: toLocalInput(start.toISOString()), endsAt: toLocalInput(end.toISOString()) }
}

// Admin → Mosaic: stagioni (titolo, tema, dimensione, date) e moderazione.
// Tessere al giorno, bonus e giorni di accesso minimi sono in Impostazioni.
export default function MosaicAdminPanel() {
  const [seasons, setSeasons] = useState<MosaicAdminSeason[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null)
  const [saving, setSaving] = useState(false)
  const [people, setPeople] = useState<{ seasonId: string; rows: Record<string, unknown>[] | null } | null>(null)
  const [reports, setReports] = useState<MosaicAdminReport[]>([])
  const [showClosed, setShowClosed] = useState(false)
  const [canvasFor, setCanvasFor] = useState<{ seasonId: string; focus: { x: number; y: number; w: number; h: number } | null; key: number } | null>(null)

  const load = useCallback(async () => {
    const [result, list] = await Promise.all([adminListMosaicSeasons(), adminListMosaicReports()])
    setSeasons(result.seasons)
    setReports(list.reports)
    setError(result.error ?? list.error)
  }, [])

  const closeReport = async (id: string) => {
    const result = await adminCloseMosaicReport(id)
    if (!result.success) return notify('Errore: ' + (result.error ?? ''))
    await load()
  }

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const save = async () => {
    if (!editing) return
    setSaving(true)
    const { form } = editing
    const result = await adminSaveMosaicSeason(editing.id, {
      ...form,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: new Date(form.endsAt).toISOString(),
    })
    setSaving(false)
    if (!result.success) return notify('Errore: ' + (result.error ?? ''))
    setEditing(null)
    await load()
  }

  const showPeople = async (seasonId: string) => {
    setPeople({ seasonId, rows: null })
    const result = await adminListMosaicContributors(seasonId)
    setPeople({ seasonId, rows: result.rows })
  }

  const clearUser = async (seasonId: string, userId: string, label: string) => {
    if (!(await askConfirm(`Togliere tutte le tessere di ${label} da questa stagione? Le caselle tornano libere.`))) return
    const result = await adminClearMosaicUser(seasonId, userId)
    if (!result.success) return notify('Errore: ' + (result.error ?? ''))
    await Promise.all([showPeople(seasonId), load()])
  }

  const remove = async (season: MosaicAdminSeason) => {
    if (!(await askConfirm(`Eliminare la stagione "${season.title}"${season.filled ? ` e le sue ${season.filled} tessere` : ''}? Non si può annullare.`))) return
    const result = await adminDeleteMosaicSeason(season.id)
    if (!result.success) return notify('Errore: ' + (result.error ?? ''))
    await load()
  }

  const input = 'mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--gold)]'
  const set = (key: keyof Form, value: string | number) => setEditing((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">KUMANI Mosaic</h2>
          <p className="mt-1 max-w-2xl text-gray-600">
            Opera collettiva a stagioni: ogni Kumano piazza qualche tessera al giorno e una tessera piazzata non si copre più.
            Qui crei le stagioni e, in caso di vandalismo, togli le tessere di una persona. Tessere al giorno, bonus e giorni di
            accesso minimi sono in Impostazioni.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing({ id: null, form: emptyForm() })}
          className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" /> Nuova stagione
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="flex items-center gap-2 font-semibold text-gray-900">
            <Flag className="h-4 w-4 text-red-600" /> Segnalazioni ({reports.filter((r) => r.status === 'open').length} aperte)
          </p>
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Mostra anche le chiuse
          </label>
        </div>
        {reports.filter((r) => showClosed || r.status === 'open').length === 0 ? (
          <p className="text-sm text-gray-500">Nessuna segnalazione aperta.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {reports
              .filter((r) => showClosed || r.status === 'open')
              .map((report) => (
                <li key={report.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">
                      {REASON[report.reason] ?? report.reason} · {report.season_title}
                      {report.status === 'closed' && <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">Chiusa</span>}
                    </p>
                    {report.note && <p className="text-gray-700">“{report.note}”</p>}
                    <p className="text-xs text-gray-500">
                      Area ({report.x + 1}, {report.y + 1}) {report.w}×{report.h} · da {report.reporter_name} · {when(report.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCanvasFor({ seasonId: report.season_id, focus: { x: report.x, y: report.y, w: report.w, h: report.h }, key: Date.now() })
                      }
                      className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700"
                    >
                      <Grid3x3 className="h-3.5 w-3.5" /> Apri sulla tela
                    </button>
                    {report.status === 'open' && (
                      <button
                        type="button"
                        onClick={() => closeReport(report.id)}
                        className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white"
                      >
                        <Check className="h-3.5 w-3.5" /> Chiudi
                      </button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        )}
      </div>

      {editing && (
        <div className="space-y-3 rounded-xl border border-[var(--gold)]/40 bg-white p-4">
          <p className="font-semibold text-gray-900">{editing.id ? 'Modifica stagione' : 'Nuova stagione'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-gray-600">
              Titolo
              <input className={input} maxLength={80} value={editing.form.title} onChange={(e) => set('title', e.target.value)} />
            </label>
            <label className="text-xs text-gray-600">
              Tema (facoltativo)
              <input className={input} maxLength={200} value={editing.form.theme} onChange={(e) => set('theme', e.target.value)} />
            </label>
            <label className="text-xs text-gray-600">
              Larghezza (caselle)
              <input type="number" min={16} max={256} className={input} value={editing.form.width} onChange={(e) => set('width', parseInt(e.target.value, 10) || 16)} />
            </label>
            <label className="text-xs text-gray-600">
              Altezza (caselle)
              <input type="number" min={16} max={256} className={input} value={editing.form.height} onChange={(e) => set('height', parseInt(e.target.value, 10) || 16)} />
            </label>
            <label className="text-xs text-gray-600">
              Inizio
              <input type="datetime-local" className={input} value={editing.form.startsAt} onChange={(e) => set('startsAt', e.target.value)} />
            </label>
            <label className="text-xs text-gray-600">
              Fine
              <input type="datetime-local" className={input} value={editing.form.endsAt} onChange={(e) => set('endsAt', e.target.value)} />
            </label>
          </div>
          <p className="text-xs text-gray-500">
            {editing.form.width * editing.form.height} caselle. Per partire consigliamo 64×64; la dimensione non si cambia più dopo la prima tessera.
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={save} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {saving && <LoaderCircle className="h-4 w-4 animate-spin" />} Salva
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">
              Annulla
            </button>
          </div>
        </div>
      )}

      {seasons === null ? (
        <p className="text-sm text-gray-400">Caricamento…</p>
      ) : seasons.length === 0 ? (
        <p className="text-sm text-gray-500">Nessuna stagione: creane una per aprire il Mosaic.</p>
      ) : (
        <div className="space-y-3">
          {seasons.map((season) => {
            const total = season.width * season.height
            const ended = new Date(season.ends_at) <= new Date()
            const future = new Date(season.starts_at) > new Date()
            return (
              <div key={season.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {season.title}{' '}
                      <span
                        className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          season.current ? 'bg-emerald-100 text-emerald-800' : future ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {season.current ? 'In corso' : future ? 'Programmata' : ended ? 'Conclusa' : '—'}
                      </span>
                    </p>
                    {season.theme && <p className="text-sm text-gray-600">{season.theme}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      {season.width}×{season.height} · {when(season.starts_at)} → {when(season.ends_at)}
                    </p>
                    <p className="mt-1 text-xs text-gray-700">
                      {season.filled} / {total} tessere ({Math.floor((season.filled / total) * 100)}%) · {season.contributors} partecipanti
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setCanvasFor(canvasFor?.seasonId === season.id ? null : { seasonId: season.id, focus: null, key: Date.now() })}
                      className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      <Grid3x3 className="h-3.5 w-3.5" /> Tela
                    </button>
                    <button
                      type="button"
                      onClick={() => showPeople(season.id)}
                      className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700"
                    >
                      <Users className="h-3.5 w-3.5" /> Partecipanti
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          id: season.id,
                          form: {
                            title: season.title,
                            theme: season.theme ?? '',
                            width: season.width,
                            height: season.height,
                            startsAt: toLocalInput(season.starts_at),
                            endsAt: toLocalInput(season.ends_at),
                          },
                        })
                      }
                      className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Modifica
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(season)}
                      className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Elimina
                    </button>
                  </div>
                </div>

                {canvasFor?.seasonId === season.id && (
                  <MosaicAdminEditor key={canvasFor.key} season={season} focus={canvasFor.focus} onClose={() => setCanvasFor(null)} onChanged={load} />
                )}

                {people?.seasonId === season.id && (
                  <div className="mt-4 border-t border-gray-100 pt-3">
                    {people.rows === null ? (
                      <p className="text-xs text-gray-400">Caricamento…</p>
                    ) : people.rows.length === 0 ? (
                      <p className="text-xs text-gray-500">Ancora nessuna tessera.</p>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase text-gray-500">
                          <tr>
                            <th className="py-1">Persona</th>
                            <th className="py-1 text-right">Tessere</th>
                            <th className="py-1">Ultima</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {people.rows.map((row) => {
                            const label = String(row.name || row.email || row.user_id)
                            return (
                              <tr key={String(row.user_id)}>
                                <td className="py-1.5">
                                  <p className="font-medium text-gray-900">{label}</p>
                                  {row.email ? <p className="text-xs text-gray-500">{String(row.email)}</p> : null}
                                </td>
                                <td className="py-1.5 text-right font-semibold">{String(row.pixels)}</td>
                                <td className="py-1.5 text-xs text-gray-500">{when(String(row.last_at))}</td>
                                <td className="py-1.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => clearUser(season.id, String(row.user_id), label)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600"
                                  >
                                    <Eraser className="h-3.5 w-3.5" /> Togli tessere
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    )}
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
