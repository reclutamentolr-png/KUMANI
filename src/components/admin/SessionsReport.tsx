'use client'

import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Clock, LoaderCircle, Monitor, Smartphone, Timer, Users } from 'lucide-react'
import { adminReportSessions, type SessionStats } from '@/app/actions/adminReports'

const PERIODS = [7, 30, 90] as const

// Durata leggibile: «4 min 20 s», «1 h 05 min»
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  if (s < 60) return `${s} s`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`
  return r ? `${m} min ${String(r).padStart(2, '0')} s` : `${m} min`
}

const nf = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 })
const dayLabel = (iso: string) => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

function Trend({ now, before, unit }: { now: number; before: number; unit?: 'time' }) {
  if (!before) return <span className="text-xs text-gray-400">nessun dato nel periodo precedente</span>
  const diff = now - before
  const pct = Math.round((diff / before) * 100)
  const up = diff >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-green-700' : 'text-red-700'}`}>
      <Icon className="h-3.5 w-3.5" />
      {up ? '+' : ''}
      {pct}% <span className="font-normal text-gray-500">vs periodo prima ({unit === 'time' ? formatDuration(before) : nf.format(before)})</span>
    </span>
  )
}

const BUCKETS: { key: string; label: string }[] = [
  { key: 'lt10s', label: 'Meno di 10 s (solo un’occhiata)' },
  { key: 'lt1m', label: '10 s – 1 min' },
  { key: 'lt5m', label: '1 – 5 min' },
  { key: 'lt15m', label: '5 – 15 min' },
  { key: 'gte15m', label: 'Più di 15 min' },
]

// Sessioni e tempo medio per sessione: quanto la piattaforma viene usata davvero.
export default function SessionsReport() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStats(null)
    adminReportSessions(days).then((result) => {
      if (cancelled) return
      if ('error' in result) setError(result.error)
      else {
        setError(null)
        setStats(result)
      }
    })
    return () => {
      cancelled = true
    }
  }, [days])

  const perUser = stats && stats.users ? stats.sessions / stats.users : 0
  const prevPerUser = stats && stats.prev_users ? stats.prev_sessions / stats.prev_users : 0
  const maxDaily = Math.max(1, ...(stats?.daily ?? []).map((d) => d.sessions))
  const maxAvg = Math.max(1, ...(stats?.daily ?? []).map((d) => d.avg_seconds))
  const card = 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-600">
          Una sessione è una visita di un utente collegato: finisce dopo 30 minuti senza attività (10 utenti che entrano 6 volte = 60 sessioni). Si conta solo il
          tempo con la pagina in primo piano; lo Staff non è incluso.
        </p>
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1" role="group" aria-label="Periodo">
          {PERIODS.map((p) => (
            <button key={p} type="button" onClick={() => setDays(p)} aria-pressed={days === p} className={`min-h-9 rounded-md px-3 text-sm font-semibold ${days === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
              {p} giorni
            </button>
          ))}
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {!stats && !error && (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Caricamento…
        </p>
      )}

      {stats && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-[var(--ink)] p-5 text-white shadow-sm md:row-span-2">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)]">
                <Timer className="h-4 w-4" /> Tempo medio per sessione
              </p>
              <p className="mt-3 text-5xl font-extrabold tabular-nums">{formatDuration(stats.avg_seconds)}</p>
              <div className="mt-2 [&_span]:!text-white/80">
                <Trend now={stats.avg_seconds} before={stats.prev_avg_seconds} unit="time" />
              </div>
              <p className="mt-4 text-sm text-white/70">
                Metà delle sessioni dura meno di <strong className="text-white">{formatDuration(stats.median_seconds)}</strong> (mediana).
              </p>
              <p className="mt-1 text-sm text-white/70">
                Tempo totale d’uso: <strong className="text-white">{formatDuration(stats.total_seconds)}</strong>
              </p>
            </div>
            <div className={card}>
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                <Clock className="h-4 w-4" /> Sessioni
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{nf.format(stats.sessions)}</p>
              <Trend now={stats.sessions} before={stats.prev_sessions} />
            </div>
            <div className={card}>
              <p className="flex items-center gap-2 text-sm font-semibold text-gray-600">
                <Users className="h-4 w-4" /> Utenti unici
              </p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{nf.format(stats.users)}</p>
              <Trend now={stats.users} before={stats.prev_users} />
            </div>
            <div className={card}>
              <p className="text-sm font-semibold text-gray-600">Sessioni per utente</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-gray-900">{nf.format(perUser)}</p>
              <Trend now={perUser} before={prevPerUser} />
            </div>
            <div className={card}>
              <p className="text-sm font-semibold text-gray-600">Telefono / computer</p>
              <div className="mt-2 space-y-1.5 text-sm">
                <p className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <Smartphone className="h-4 w-4" /> {stats.sessions ? Math.round((stats.mobile_sessions / stats.sessions) * 100) : 0}% sessioni
                  </span>
                  <span className="tabular-nums text-gray-900">media {formatDuration(stats.mobile_avg_seconds)}</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-gray-700">
                    <Monitor className="h-4 w-4" /> {stats.sessions ? 100 - Math.round((stats.mobile_sessions / stats.sessions) * 100) : 0}% sessioni
                  </span>
                  <span className="tabular-nums text-gray-900">media {formatDuration(stats.desktop_avg_seconds)}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className={card}>
              <h3 className="font-bold text-gray-900">Quanto durano le sessioni</h3>
              <div className="mt-3 space-y-2">
                {BUCKETS.map(({ key, label }) => {
                  const n = stats.buckets[key] ?? 0
                  const pct = stats.sessions ? Math.round((n / stats.sessions) * 100) : 0
                  return (
                    <div key={key}>
                      <p className="flex justify-between text-sm">
                        <span className="text-gray-700">{label}</span>
                        <span className="tabular-nums text-gray-900">
                          {pct}% <span className="text-gray-500">({n})</span>
                        </span>
                      </p>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className={card}>
              <h3 className="font-bold text-gray-900">Giorno per giorno</h3>
              {stats.daily.length === 0 ? (
                <p className="mt-3 text-sm text-gray-500">Ancora nessuna sessione in questo periodo.</p>
              ) : (
                <>
                  <div className="mt-3 flex h-32 items-end gap-[2px]" aria-label="Sessioni al giorno">
                    {stats.daily.map((d) => (
                      <div key={d.day} className="group relative max-w-10 flex-1" title={`${dayLabel(d.day)}: ${d.sessions} sessioni, ${d.users} utenti, media ${formatDuration(d.avg_seconds)}`}>
                        <div className="w-full rounded-t bg-[var(--gold)]/80" style={{ height: `${Math.max(4, (d.sessions / maxDaily) * 120)}px` }} />
                        <div className="absolute inset-x-0 rounded-full bg-[var(--ink)]" style={{ bottom: `${(d.avg_seconds / maxAvg) * 120}px`, height: 3 }} />
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 flex flex-wrap gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--gold)]" /> sessioni
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1 w-3 rounded-full bg-[var(--ink)]" /> tempo medio
                    </span>
                    <span>
                      {dayLabel(stats.daily[0].day)} → {dayLabel(stats.daily[stats.daily.length - 1].day)} · passa sopra una barra per i numeri
                    </span>
                  </p>
                </>
              )}
            </div>
          </div>
          {stats.first_session && (
            <p className="text-xs text-gray-500">
              Dati raccolti dal {new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeZone: 'Europe/Rome' }).format(new Date(stats.first_session))}: i confronti con il periodo
              precedente diventano affidabili dopo il primo mese.
            </p>
          )}
        </>
      )}
    </div>
  )
}
