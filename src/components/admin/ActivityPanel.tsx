'use client'

import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, LoaderCircle, Monitor, RefreshCw, Smartphone } from 'lucide-react'
import { adminDailyActivity } from '@/app/actions/adminActivity'

// Admin → Attività del giorno: chi si è collegato, per quanto tempo, quali
// servizi ha aperto, quanto ci è rimasto e quali ha usato davvero.

type Report = NonNullable<Awaited<ReturnType<typeof adminDailyActivity>>>

const romeToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
const shiftDay = (day: string, n: number) => new Date(Date.parse(`${day}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }) : '—')
const duration = (seconds: number) => {
  if (seconds < 60) return seconds > 0 ? 'meno di 1 min' : '—'
  const m = Math.round(seconds / 60)
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`
}

export default function ActivityPanel() {
  const [day, setDay] = useState(romeToday())
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDay = useCallback((d: string) => {
    adminDailyActivity(d)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false))
  }, [])
  const load = (d: string) => {
    setLoading(true)
    fetchDay(d)
  }
  const changeDay = (d: string) => {
    setLoading(true)
    setDay(d)
  }

  useEffect(() => {
    fetchDay(day)
  }, [day, fetchDay])

  const today = romeToday()
  const r = report
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attività del giorno</h2>
          <p className="mt-1 text-sm text-gray-500">Chi si è collegato, per quanto tempo e quali servizi ha usato. Il tempo conta solo con la pagina in primo piano; lo Staff è escluso.</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => changeDay(shiftDay(day, -1))} className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50" title="Giorno prima">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <input type="date" value={day} max={today} onChange={(e) => e.target.value && changeDay(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" />
          <button type="button" disabled={day >= today} onClick={() => changeDay(shiftDay(day, 1))} className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50 disabled:opacity-40" title="Giorno dopo">
            <ChevronRight className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => load(day)} className="rounded-lg border border-gray-300 p-2 text-gray-700 hover:bg-gray-50" title="Aggiorna">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !r ? (
        <div className="flex justify-center py-12">
          <LoaderCircle className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : !r ? (
        <p className="text-sm text-red-600">Non autorizzato.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Persone collegate', value: String(r.totals.people) },
              { label: 'Tempo totale', value: duration(r.totals.seconds) },
              { label: 'Nuovi iscritti collegati', value: String(r.totals.newToday) },
              { label: 'Dal telefono', value: `${r.totals.mobile} su ${r.totals.people}` },
            ].map((k) => (
              <div key={k.label} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-2xl font-bold text-gray-900">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="mb-3 font-bold text-gray-900">Persone</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Persona</th>
                    <th className="py-2 pr-3">Piano</th>
                    <th className="py-2 pr-3">Visite</th>
                    <th className="py-2 pr-3">Tempo</th>
                    <th className="py-2 pr-3">Orario</th>
                    <th className="py-2">Servizi (tempo · usato)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 align-top">
                  {r.people.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 pr-3">
                        <p className="flex items-center gap-1.5 font-semibold">
                          {p.devices.includes('mobile') ? <Smartphone className="h-3.5 w-3.5 text-gray-400" /> : <Monitor className="h-3.5 w-3.5 text-gray-400" />}
                          {p.name}
                          {p.newToday && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">NUOVO</span>}
                        </p>
                      </td>
                      <td className="py-2 pr-3">{p.plan}</td>
                      <td className="py-2 pr-3">{p.sessions || '—'}</td>
                      <td className="whitespace-nowrap py-2 pr-3 font-semibold">
                        {duration(p.seconds)}
                        {p.seconds > 2 * 3600 && p.tools.length === 0 && <span className="block text-xs font-normal text-amber-700">Forse pagina lasciata aperta</span>}
                      </td>
                      <td className="whitespace-nowrap py-2 pr-3 text-xs">{p.sessions ? `${clock(p.first)} – ${clock(p.last)}` : '—'}</td>
                      <td className="py-2">
                        {p.tools.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {p.tools.map((x) => (
                              <span key={x.tool} className={`rounded-full px-2 py-0.5 text-xs ${x.used ? 'bg-amber-100 font-semibold text-amber-900' : 'bg-gray-100 text-gray-700'}`} title={x.used ? 'Usato davvero (KU Karma)' : 'Solo aperto'}>
                                {x.title}
                                {x.seconds >= 60 ? ` · ${duration(x.seconds)}` : ''}
                                {x.used ? ' ✓' : ''}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Nessun servizio aperto</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {r.people.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-4 text-center text-gray-500">Nessuno collegato in questo giorno.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">In giallo con ✓ i servizi usati davvero (azione che dà i KU Karma); in grigio quelli solo aperti. Il tempo per servizio si misura dal 25/10/2026.</p>
          </div>

          {r.tools.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <h3 className="mb-3 font-bold text-gray-900">Servizi del giorno</h3>
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-gray-500">
                  <tr>
                    <th className="py-2 pr-3">Servizio</th>
                    <th className="py-2 pr-3 text-right">Persone</th>
                    <th className="py-2 pr-3 text-right">Usato davvero</th>
                    <th className="py-2 text-right">Tempo totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {r.tools.map((x) => (
                    <tr key={x.tool}>
                      <td className="py-2 pr-3 font-semibold">{x.title}</td>
                      <td className="py-2 pr-3 text-right">{x.people}</td>
                      <td className="py-2 pr-3 text-right">{x.used || '—'}</td>
                      <td className="py-2 text-right">{duration(x.seconds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
