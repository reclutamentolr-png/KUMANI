'use client'

import { useEffect, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, CalendarCheck, LoaderCircle, Repeat, TrendingUp, UserPlus, Users } from 'lucide-react'
import { adminRealUsage, type RealUsage } from '@/app/actions/adminReports'
import LivePresenceBox from './LivePresenceBox'

// Admin → «Uso reale»: quante persone usano davvero KUMANI, quanto spesso
// tornano, quali servizi si aprono e quali no, quanti diventano paganti. Ogni
// riquadro spiega in una riga cosa vuol dire il numero. Staff, ospiti in prova
// e account bloccati non sono contati.

const PERIODS = [7, 30, 90] as const
const nf = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 })
const pct = (part: number, total: number) => (total ? Math.round((part / total) * 100) : 0)
const dayLabel = (iso: string) => new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
const monthLabel = (iso: string) => new Intl.DateTimeFormat('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))
const PLAN_STYLE: Record<string, string> = { free: 'text-emerald-700', base: 'text-orange-600', pro: 'text-blue-700' }

function Trend({ now, before }: { now: number; before: number }) {
  if (!before) return <span className="text-xs text-gray-400">nessun dato nel periodo prima</span>
  const diff = now - before
  const up = diff >= 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${up ? 'text-green-700' : 'text-red-700'}`}>
      <Icon className="h-3.5 w-3.5" />
      {up ? '+' : ''}
      {Math.round((diff / before) * 100)}% <span className="font-normal text-gray-500">vs periodo prima ({nf.format(before)})</span>
    </span>
  )
}

function Card({ title, value, hint, children }: { title: string; value: string; hint: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-sm font-semibold text-gray-600">{title}</p>
      <p className="mt-1 text-3xl font-extrabold text-[var(--ink)]">{value}</p>
      {children}
      <p className="mt-1.5 text-xs leading-snug text-gray-500">{hint}</p>
    </div>
  )
}

function Section({ icon: Icon, title, hint, children }: { icon: typeof Users; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
        <Icon className="h-5 w-5 text-[var(--gold)]" aria-hidden /> {title}
      </h3>
      <p className="mt-0.5 text-sm text-gray-500">{hint}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Bar({ value, max, className = 'bg-[var(--gold)]' }: { value: number; max: number; className?: string }) {
  return (
    <div className="h-2 w-full rounded-full bg-gray-100">
      <div className={`h-2 rounded-full ${className}`} style={{ width: `${max ? Math.max(value ? 3 : 0, (value / max) * 100) : 0}%` }} />
    </div>
  )
}

export default function RealUsagePanel() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30)
  const [data, setData] = useState<RealUsage | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null)
    adminRealUsage(days).then((result) => {
      if (cancelled) return
      if ('error' in result) setError(result.error)
      else {
        setError(null)
        setData(result)
      }
    })
    return () => {
      cancelled = true
    }
  }, [days])

  if (error) return <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>

  const periodPicker = (
    <div className="flex gap-1.5" role="group" aria-label="Periodo">
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => setDays(p)}
          aria-pressed={days === p}
          className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${days === p ? 'bg-[var(--ink)] text-white' : 'bg-white text-[var(--ink)] ring-1 ring-gray-200 hover:ring-[var(--gold)]'}`}
        >
          {p} giorni
        </button>
      ))}
    </div>
  )

  if (!data)
    return (
      <div className="space-y-4">
        {periodPicker}
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Calcolo in corso…
        </p>
      </div>
    )

  const { totals, active, frequency, daily, cohorts, tools, conversion } = data
  const maxDaily = Math.max(1, ...daily.map((d) => Math.max(d.active, d.signups)))
  const used = tools.filter((t) => t.enabled && t.users > 0)
  const unused = tools.filter((t) => t.enabled && t.users === 0)
  const maxUsers = Math.max(1, ...used.map((t) => t.users))
  const freqTotal = frequency.one + frequency.two_three + frequency.four_nine + frequency.ten_plus
  const stickiness = active.d30 ? Math.round((active.avg_daily30 / active.d30) * 100) : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[var(--ink)]">Uso reale</h2>
          <p className="text-sm text-gray-500">
            Chi usa davvero KUMANI, quanto spesso torna, cosa apre e quanti diventano paganti. Staff, ospiti in prova e account bloccati non sono contati.
            {data.data_since && <> Dati di attività dal {dayLabel(data.data_since)}.</>}
          </p>
        </div>
        {periodPicker}
      </div>

      <LivePresenceBox />

      {/* Attivi */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Attivi oggi" value={nf.format(active.d1)} hint="Persone che oggi hanno aperto KUMANI." />
        <Card title="Attivi negli ultimi 7 giorni" value={nf.format(active.d7)} hint="Persone diverse che hanno usato KUMANI in settimana.">
          <Trend now={active.d7} before={active.prev7} />
        </Card>
        <Card title="Attivi negli ultimi 30 giorni" value={nf.format(active.d30)} hint={`Il ${pct(active.d30, totals.registered)}% degli iscritti (${nf.format(totals.registered)}).`}>
          <Trend now={active.d30} before={active.prev30} />
        </Card>
        <Card title="Abitudine" value={`${stickiness}%`} hint={`In media ${nf.format(active.avg_daily30)} attivi al giorno su ${nf.format(active.d30)} del mese: più è alto, più KUMANI è un’abitudine quotidiana.`} />
      </div>

      {/* Giorno per giorno */}
      <Section icon={TrendingUp} title="Giorno per giorno" hint="Persone attive (barra oro) e nuovi iscritti (barra scura) in ogni giorno del periodo.">
        <div className="flex h-36 items-end gap-[3px]" role="img" aria-label="Attivi e nuovi iscritti per giorno">
          {daily.map((d) => (
            <div key={d.day} className="group relative flex h-full flex-1 items-end gap-[1px]" title={`${dayLabel(d.day)}: ${d.active} attivi, ${d.signups} iscritti`}>
              <div className="flex-1 rounded-t bg-[var(--gold)]/80" style={{ height: `${(d.active / maxDaily) * 100}%` }} />
              <div className="flex-1 rounded-t bg-[var(--ink)]" style={{ height: `${(d.signups / maxDaily) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-gray-400">
          <span>{dayLabel(daily[0]?.day ?? data.today)}</span>
          <span>{dayLabel(data.today)}</span>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Quanto spesso tornano */}
        <Section icon={Repeat} title="Quanto spesso tornano" hint="Gli attivi degli ultimi 30 giorni, divisi per quanti giorni hanno usato KUMANI.">
          <div className="space-y-3">
            {[
              ['Solo 1 giorno', frequency.one],
              ['2 – 3 giorni', frequency.two_three],
              ['4 – 9 giorni', frequency.four_nine],
              ['10 giorni o più', frequency.ten_plus],
            ].map(([label, n]) => (
              <div key={label as string}>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">{label}</span>
                  <span className="font-semibold text-[var(--ink)]">
                    {nf.format(n as number)} <span className="font-normal text-gray-400">({pct(n as number, freqTotal)}%)</span>
                  </span>
                </div>
                <Bar value={n as number} max={freqTotal} />
              </div>
            ))}
          </div>
        </Section>

        {/* Piani e conversione */}
        <Section icon={UserPlus} title="Piani e conversione" hint="Chi paga oggi e quanti nuovi iscritti diventano Base o Pro.">
          <div className="grid grid-cols-3 gap-2 text-center">
            {(['free', 'base', 'pro'] as const).map((p) => (
              <div key={p} className="rounded-xl bg-gray-50 p-3">
                <p className={`text-xs font-extrabold uppercase tracking-wider ${PLAN_STYLE[p]}`}>{p}</p>
                <p className="text-2xl font-extrabold text-[var(--ink)]">{nf.format(totals[p])}</p>
                <p className="text-xs text-gray-500">{pct(totals[p], totals.registered)}%</p>
              </div>
            ))}
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-gray-700">
            <li>
              Iscritti negli ultimi 90 giorni: <strong>{nf.format(conversion.signups90)}</strong>, di cui paganti oggi <strong>{nf.format(conversion.paying_from_signups90)}</strong> ({pct(conversion.paying_from_signups90, conversion.signups90)}%).
            </li>
            {conversion.avg_days_to_pay !== null && (
              <li>
                In media passano a pagamento dopo <strong>{nf.format(conversion.avg_days_to_pay)} giorni</strong> dall’iscrizione.
              </li>
            )}
          </ul>
          {conversion.checkouts_by_month.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Abbonamenti avviati (anche passaggi a Pro)</p>
              <ul className="mt-1.5 space-y-1 text-sm">
                {conversion.checkouts_by_month.map((m) => (
                  <li key={m.month} className="flex justify-between">
                    <span className="capitalize text-gray-700">{monthLabel(m.month)}</span>
                    <span>
                      <span className={PLAN_STYLE.base}>Base {m.base}</span> · <span className={PLAN_STYLE.pro}>Pro {m.pro}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </div>

      {/* Coorti */}
      <Section icon={CalendarCheck} title="Tornano dopo la prima settimana?" hint="Iscritti per settimana: quanti hanno usato KUMANI nella prima settimana, quanti sono tornati tra l’8° e il 30° giorno, quanti sono attivi oggi.">
        {cohorts.length === 0 ? (
          <p className="text-sm text-gray-500">Nessun nuovo iscritto nelle ultime 12 settimane.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                  <th className="py-2 pr-3 font-semibold">Settimana del</th>
                  <th className="py-2 pr-3 text-right font-semibold">Iscritti</th>
                  <th className="py-2 pr-3 text-right font-semibold">Usato nella 1ª settimana</th>
                  <th className="py-2 pr-3 text-right font-semibold">Tornati (8°–30° giorno)</th>
                  <th className="py-2 text-right font-semibold">Attivi oggi (30 gg)</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.week} className="border-t border-gray-100">
                    <td className="py-2 pr-3 text-gray-700">{dayLabel(c.week)}</td>
                    <td className="py-2 pr-3 text-right font-semibold">{c.signups}</td>
                    <td className="py-2 pr-3 text-right">
                      {c.first_week} <span className="text-gray-400">({pct(c.first_week, c.signups)}%)</span>
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {c.came_back} <span className="text-gray-400">({pct(c.came_back, c.signups)}%)</span>
                      {!c.mature && <span className="ml-1 text-xs text-amber-600">in corso</span>}
                    </td>
                    <td className="py-2 text-right">
                      {c.active_now} <span className="text-gray-400">({pct(c.active_now, c.signups)}%)</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-gray-500">«In corso»: non sono ancora passati 30 giorni dall’iscrizione, il numero può ancora salire.</p>
      </Section>

      {/* Servizi */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Section icon={Users} title={`Servizi più usati (${days} giorni)`} hint="Persone diverse che hanno aperto il servizio nel periodo, e quante volte (giorni d’uso).">
          {used.length === 0 ? (
            <p className="text-sm text-gray-500">Nessun servizio aperto nel periodo.</p>
          ) : (
            <ul className="space-y-2.5">
              {used.map((t) => (
                <li key={t.tool}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate text-gray-800">
                      {t.title} <span className={`text-[10px] font-extrabold uppercase ${PLAN_STYLE[t.plan] ?? ''}`}>{t.plan}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-[var(--ink)]">
                      {t.users} <span className="font-normal text-gray-400">pers. · {t.use_days} gg</span>
                      {t.prev_users > 0 && <span className={`ml-1 text-xs ${t.users >= t.prev_users ? 'text-green-700' : 'text-red-700'}`}>(prima {t.prev_users})</span>}
                    </span>
                  </div>
                  <Bar value={t.users} max={maxUsers} />
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section icon={Users} title={`Mai aperti nel periodo (${unused.length})`} hint="Servizi accesi che nessuno ha aperto: da far conoscere meglio, unire ad altri o mettere da parte.">
          {unused.length === 0 ? (
            <p className="text-sm text-gray-500">Tutti i servizi accesi sono stati aperti almeno una volta.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {unused.map((t) => (
                <li key={t.tool} className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700">
                  {t.title} <span className={`text-[10px] font-extrabold uppercase ${PLAN_STYLE[t.plan] ?? ''}`}>{t.plan}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  )
}
