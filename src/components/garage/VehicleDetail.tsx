'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, CalendarClock, CarFront, Check, CheckCircle2, Gauge, KeyRound, LoaderCircle, Pencil, Plus, RotateCcw, Trash2, Wallet, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { addExpense, addReading, deleteDeadline, deleteExpense, deleteReading, deleteVehicle, payDeadline, saveDeadline } from '@/app/actions/garage'
import { daysBetween } from '@/lib/agenda'
import {
  DEADLINE_KINDS,
  DEADLINE_RECURRENCES,
  EXPENSE_KINDS,
  deadlineState,
  rentalReport,
  type DeadlineKind,
  type DeadlineRecurrence,
  type ExpenseKind,
  type GarageDeadline,
  type GarageExpense,
  type GarageReading,
  type GarageVehicle,
  type RentalReport,
} from '@/lib/garage'
import { defaultLocale } from '../../../i18n'

// Separatore delle migliaia anche con 4 cifre (in italiano «3.870 km», non «3870 km»)
const GROUP = 'always' as unknown as boolean

const input =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20'
const card = 'rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-[0_8px_24px_rgba(23,23,23,0.06)]'

function parseNumber(value: string): number | null {
  const clean = value.trim().replace(/\s/g, '')
  if (!clean) return null
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

function useFormat() {
  const locale = useLocale()
  return {
    km: (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: GROUP }).format(value),
    dec: (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value),
    pct: (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value) + '%',
    eur: (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', useGrouping: GROUP }).format(value),
    date: (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' }),
    signed: (value: number) => (value > 0 ? '+' : '') + new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: GROUP }).format(value),
  }
}

// Esegue un'azione del server e ricarica la pagina; l'errore come testo
function useAction() {
  const t = useTranslations('garage')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = (action: () => Promise<{ success: boolean; message?: string }>, after?: () => void) => {
    setError(null)
    startTransition(async () => {
      const result = await action()
      if (!result.success) {
        setError(t(`error_${result.message ?? 'saveError'}`))
        return
      }
      after?.()
      router.refresh()
    })
  }
  return { run, isPending, error }
}

export default function VehicleDetail({
  vehicle,
  readings,
  deadlines,
  expenses,
  today,
  spendlyAvailable,
}: {
  vehicle: GarageVehicle
  readings: GarageReading[]
  deadlines: GarageDeadline[]
  expenses: GarageExpense[]
  today: string
  spendlyAvailable: boolean
}) {
  const t = useTranslations('garage')
  const router = useRouter()
  const locale = useLocale()
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const { run, isPending } = useAction()
  const report = rentalReport(vehicle, readings, today)
  const lastKm = readings.length ? readings[readings.length - 1].km : vehicle.initial_km

  const remove = () => {
    if (!confirm(t('deleteVehicleConfirm', { name: vehicle.name }))) return
    run(() => deleteVehicle(vehicle.id), () => router.push(`${prefix}/marketplace/garage`))
  }

  return (
    <div className="space-y-5">
      <section className={card}>
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
            {vehicle.kind === 'rental' ? <KeyRound className="h-6 w-6" /> : <CarFront className="h-6 w-6" />}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold text-[var(--ink)]">{vehicle.name}</h1>
            <p className="text-sm text-[var(--muted)]">{[vehicle.model, vehicle.plate, t(`kind_${vehicle.kind}`)].filter(Boolean).join(' · ')}</p>
          </div>
          <div className="flex shrink-0 gap-1">
            <Link
              href={`/marketplace/garage/${vehicle.id}/edit`}
              aria-label={t('edit')}
              title={t('edit')}
              className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--gold-pale)] hover:text-[var(--ink)]"
            >
              <Pencil className="h-4.5 w-4.5" />
            </Link>
            <button type="button" onClick={remove} disabled={isPending} aria-label={t('delete')} title={t('delete')} className="rounded-lg p-2 text-[var(--muted)] hover:bg-red-50 hover:text-red-600">
              <Trash2 className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
        {vehicle.kind === 'rental' && report && <RentalSummary vehicle={vehicle} report={report} />}
      </section>

      <ReadingForm vehicleId={vehicle.id} today={today} lastKm={lastKm} />

      {report && <RentalReportView report={report} />}

      <ReadingHistory vehicle={vehicle} readings={readings} />

      <DeadlinesSection vehicle={vehicle} deadlines={deadlines} today={today} />

      <ExpensesSection vehicleId={vehicle.id} expenses={expenses} today={today} spendlyAvailable={spendlyAvailable} />
    </div>
  )
}

// Riga sotto il nome: durata, km, rata e cosa è compreso nel noleggio
function RentalSummary({ vehicle, report }: { vehicle: GarageVehicle; report: RentalReport }) {
  const t = useTranslations('garage')
  const f = useFormat()
  const parts = [
    t('contractLine', { months: report.months, km: f.km(report.kmIncluded), yearly: f.km(report.yearlyBudget), monthly: f.km(report.monthlyBudget) }),
    vehicle.rental_monthly_fee !== null ? t('feeLine', { fee: f.eur(vehicle.rental_monthly_fee) }) : null,
  ].filter(Boolean)
  return (
    <div className="mt-4 space-y-1.5 border-t border-gray-100 pt-3 text-sm text-[var(--muted)]">
      <p>{parts.join(' · ')}</p>
      <p>
        {f.date(report.start)} → {f.date(report.end)}
        {report.totalCost !== null && <> · {t('totalCost', { amount: f.eur(report.totalCost) })}</>}
      </p>
      <p className="flex flex-wrap gap-2 pt-1">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${vehicle.rental_includes_tax ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
          {vehicle.rental_includes_tax ? t('taxIncluded') : t('taxExcluded')}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${vehicle.rental_includes_insurance ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>
          {vehicle.rental_includes_insurance ? t('insuranceIncluded') : t('insuranceExcluded')}
        </span>
      </p>
    </div>
  )
}

function ReadingForm({ vehicleId, today, lastKm }: { vehicleId: string; today: string; lastKm: number }) {
  const t = useTranslations('garage')
  const f = useFormat()
  const { run, isPending, error } = useAction()
  const [km, setKm] = useState('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = parseNumber(km)
    if (value === null) return
    run(() => addReading(vehicleId, { km: value, readOn: date, note }), () => {
      setKm('')
      setNote('')
    })
  }

  return (
    <form onSubmit={submit} className={card}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
        <Gauge className="h-5 w-5 text-[var(--gold)]" /> {t('updateKm')}
      </h2>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{t('lastKm', { km: f.km(lastKm) })}</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input inputMode="numeric" required value={km} onChange={(e) => setKm(e.target.value)} placeholder={t('currentKm')} aria-label={t('currentKm')} className={input} />
        <input type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('readingDate')} className={input} />
        <button type="submit" disabled={isPending} className="flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-2.5 font-bold text-white hover:bg-[var(--ink-soft)] disabled:opacity-60">
          {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t('saveReading')}
        </button>
        <input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder={t('readingNote')} aria-label={t('readingNote')} className={`${input} sm:col-span-3`} />
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
    </form>
  )
}

const STATUS_BANNER = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  over: 'border-red-200 bg-red-50 text-red-800',
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-[#fbfaf7] p-3.5">
      <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-xl font-extrabold ${tone === 'bad' ? 'text-red-600' : tone === 'good' ? 'text-emerald-700' : 'text-[var(--ink)]'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p>}
    </div>
  )
}

function Bar({ label, used, time, usedLabel, timeLabel }: { label: string; used: number; time?: number; usedLabel: string; timeLabel?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span className="font-bold text-[var(--ink)]">{label}</span>
        <span className="text-xs text-[var(--muted)]">
          {usedLabel}
          {timeLabel && <> · {timeLabel}</>}
        </span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${time !== undefined && used > time ? 'bg-amber-500' : 'bg-emerald-500'} ${used >= 100 ? '!bg-red-500' : ''}`} style={{ width: `${Math.min(used, 100)}%` }} />
        {time !== undefined && <div className="absolute inset-y-0 w-0.5 bg-[var(--ink)]" style={{ left: `${time}%` }} />}
      </div>
    </div>
  )
}

function RentalReportView({ report: r }: { report: RentalReport }) {
  const t = useTranslations('garage')
  const f = useFormat()
  const statusText =
    r.status === 'over'
      ? t('bannerOver', { km: f.km(r.overMonthEnd) })
      : r.status === 'warning'
        ? t('bannerWarning', { km: f.km(r.deviation), monthEnd: f.km(r.budgetMonthEnd - r.kmDriven) })
        : t('bannerOk', { km: f.km(-r.deviation) })

  return (
    <section className={card}>
      <h2 className="text-lg font-bold text-[var(--ink)]">{t('kmCheckTitle')}</h2>
      <div className={`mt-3 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm font-semibold ${STATUS_BANNER[r.status]}`}>
        {r.status === 'ok' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
        <span>
          <span className="font-extrabold">{t(`status_${r.status}`)}:</span> {statusText}
          {r.ended && <span className="mt-1 block font-normal">{t('contractEnded')}</span>}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('statDriven')} value={`${f.km(r.kmDriven)} km`} hint={t('statReadOn', { date: f.date(r.readOn) })} />
        <Stat label={t('statLeft')} value={`${f.km(r.kmLeft)} km`} hint={t('statOfTotal', { km: f.km(r.kmIncluded) })} tone={r.kmLeft < 0 ? 'bad' : undefined} />
        <Stat label={t('statYearLeft')} value={`${f.km(r.yearLeft)} km`} hint={`${f.date(r.yearFrom)} → ${f.date(r.yearTo)}`} tone={r.yearLeft < 0 ? 'bad' : undefined} />
        <Stat label={t('statDaily')} value={r.dailyAvailable !== null ? f.dec(r.dailyAvailable) : '—'} hint={t('statDailyHint')} />
      </div>

      <div className="mt-5 space-y-4">
        <Bar
          label={t('barContract')}
          used={r.usedPercent}
          time={r.timePercent}
          usedLabel={t('barUsed', { pct: f.pct(r.usedPercent) })}
          timeLabel={t('barTime', { pct: f.pct(r.timePercent) })}
        />
        <Bar label={t('barYear', { n: r.contractYear })} used={r.yearPercent} usedLabel={t('barYearUsed', { pct: f.pct(r.yearPercent), km: f.km(r.yearlyBudget) })} />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('statMonth')} value={`${r.contractMonth} / ${r.months}`} hint={`${f.date(r.monthFrom)} → ${f.date(r.monthTo)}`} />
        <Stat label={t('statMonthlyBudget')} value={`${f.km(r.monthlyBudget)} km`} hint={t('statMonthlyBudgetHint')} />
        <Stat label={t('statBudgetToDate')} value={`${f.km(r.budgetToDate)} km`} hint={t('statBudgetToDateHint')} />
        <Stat
          label={t('statDeviation')}
          value={`${f.signed(r.deviation)} km`}
          hint={r.deviation > 0 ? t('statDeviationOver') : t('statDeviationUnder')}
          tone={r.deviation > 0 ? 'bad' : 'good'}
        />
      </div>

      <h3 className="mt-6 text-base font-bold text-[var(--ink)]">{t('forecastTitle')}</h3>
      {r.realMonthly === null ? (
        <p className="mt-1 text-sm text-[var(--muted)]">{t('forecastWait')}</p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={t('statRealMonthly')} value={`${f.km(r.realMonthly)} km`} hint={t('statRealMonthlyHint')} />
          <Stat label={t('statProjection12')} value={`${f.km(r.projection12 ?? 0)} km`} hint={t('statProjection12Hint')} />
          <Stat label={t('statProjectionEnd')} value={`${f.km(r.projectionEnd ?? 0)} km`} hint={t('statOfLimit', { km: f.km(r.kmIncluded) })} />
          <Stat
            label={t('statFinalMargin')}
            value={`${f.signed(r.finalMargin ?? 0)} km`}
            hint={t('statFinalMarginHint')}
            tone={(r.finalMargin ?? 0) < 0 ? 'bad' : 'good'}
          />
        </div>
      )}
      {r.extraCost !== null && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">{t('extraCost', { amount: f.eur(r.extraCost) })}</p>
      )}
      {r.refund !== null && <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{t('refund', { amount: f.eur(r.refund) })}</p>}
    </section>
  )
}

// Storico delle rilevazioni; per il noleggio anche lo scostamento dal budget
// maturato a ogni data
function ReadingHistory({ vehicle, readings }: { vehicle: GarageVehicle; readings: GarageReading[] }) {
  const t = useTranslations('garage')
  const f = useFormat()
  const { run, isPending } = useAction()
  const rental = vehicle.kind === 'rental' && vehicle.rental_start && vehicle.rental_months && vehicle.rental_km_included
  const deviationAt = (km: number, date: string) => {
    if (!rental) return null
    const report = rentalReport(vehicle, [{ id: '', vehicle_id: vehicle.id, km, read_on: date, note: null }], date)
    return report?.deviation ?? null
  }
  const rows = [...readings].reverse()

  return (
    <section className={card}>
      <h2 className="text-lg font-bold text-[var(--ink)]">{t('historyTitle')}</h2>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              <th className="py-2 pr-3">{t('colDate')}</th>
              <th className="py-2 pr-3">{t('colKm')}</th>
              <th className="py-2 pr-3">{t('colNote')}</th>
              {rental && <th className="py-2 pr-3">{t('colDeviation')}</th>}
              <th className="py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((reading) => {
              const deviation = deviationAt(reading.km, reading.read_on)
              return (
                <tr key={reading.id} className="border-b border-gray-50">
                  <td className="py-2.5 pr-3">{f.date(reading.read_on)}</td>
                  <td className="py-2.5 pr-3 font-bold text-[var(--ink)]">{f.km(reading.km)} km</td>
                  <td className="py-2.5 pr-3 text-[var(--muted)]">{reading.note || t('noteUpdate')}</td>
                  {rental && <td className={`py-2.5 pr-3 font-semibold ${deviation !== null && deviation > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{deviation !== null ? `${f.signed(deviation)} km` : '—'}</td>}
                  <td className="py-2.5 text-right">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => confirm(t('deleteReadingConfirm')) && run(() => deleteReading(reading.id))}
                      aria-label={t('delete')}
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
            <tr>
              <td className="py-2.5 pr-3">{vehicle.rental_start ? f.date(vehicle.rental_start) : f.date(vehicle.created_at.slice(0, 10))}</td>
              <td className="py-2.5 pr-3 font-bold text-[var(--ink)]">{f.km(vehicle.initial_km)} km</td>
              <td className="py-2.5 pr-3 text-[var(--muted)]">{vehicle.kind === 'rental' ? t('notePickup') : t('noteStart')}</td>
              {rental && <td className="py-2.5 pr-3 text-[var(--muted)]">0 km</td>}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      {rental && <p className="mt-3 text-xs text-[var(--muted)]">{t('historyHint')}</p>}
    </section>
  )
}

function DeadlinesSection({ vehicle, deadlines, today }: { vehicle: GarageVehicle; deadlines: GarageDeadline[]; today: string }) {
  const t = useTranslations('garage')
  const [editing, setEditing] = useState<GarageDeadline | 'new' | null>(null)
  const hints = vehicle.kind === 'rental' ? [vehicle.rental_includes_tax ? null : t('hintTax'), vehicle.rental_includes_insurance ? null : t('hintInsurance')].filter(Boolean) : []

  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
          <CalendarClock className="h-5 w-5 text-[var(--gold)]" /> {t('deadlinesTitle')}
        </h2>
        {editing === null && (
          <button type="button" onClick={() => setEditing('new')} className="inline-flex items-center gap-1 rounded-lg bg-[var(--gold-pale)] px-3 py-1.5 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold)]/25">
            <Plus className="h-4 w-4" /> {t('addDeadline')}
          </button>
        )}
      </div>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{vehicle.kind === 'rental' ? t('deadlinesHintRental') : t('deadlinesHint')}</p>
      {hints.length > 0 && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{hints.join(' ')}</p>}

      {editing !== null && <DeadlineForm vehicleId={vehicle.id} deadline={editing === 'new' ? null : editing} today={today} onClose={() => setEditing(null)} />}

      {deadlines.length === 0 && editing === null ? (
        <p className="mt-4 text-sm text-[var(--muted)]">{t('noDeadlines')}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {deadlines.map((deadline) => (
            <DeadlineRow key={deadline.id} deadline={deadline} today={today} onEdit={() => setEditing(deadline)} />
          ))}
        </ul>
      )}
    </section>
  )
}

function DeadlineRow({ deadline, today, onEdit }: { deadline: GarageDeadline; today: string; onEdit: () => void }) {
  const t = useTranslations('garage')
  const f = useFormat()
  const { run, isPending, error } = useAction()
  const [paying, setPaying] = useState(false)
  const [amount, setAmount] = useState(deadline.amount !== null ? String(deadline.amount).replace('.', ',') : '')
  const [paidOn, setPaidOn] = useState(today)
  const state = deadlineState(deadline.due_date, today)
  const days = daysBetween(today, deadline.due_date)
  const when = days < 0 ? t('overdueDays', { count: -days }) : days === 0 ? t('dueToday') : t('dueInDays', { count: days })

  return (
    <li className={`rounded-xl border px-3.5 py-3 ${state === 'overdue' ? 'border-red-200 bg-red-50/60' : state === 'soon' ? 'border-amber-200 bg-amber-50/60' : 'border-gray-100 bg-white'}`}>
      {/* Sul telefono i pulsanti vanno sotto il testo */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="min-w-[12rem] flex-1">
          <p className="truncate font-bold text-[var(--ink)]">{deadline.title || t(`deadline_${deadline.kind}`)}</p>
          <p className={`text-xs ${state === 'overdue' ? 'font-semibold text-red-600' : 'text-[var(--muted)]'}`}>
            {f.date(deadline.due_date)} · {when}
            {deadline.amount !== null && <> · {f.eur(deadline.amount)}</>}
            {deadline.recurrence !== 'none' && <> · {t(`recurrence_${deadline.recurrence}`)}</>}
          </p>
        </div>
        {!paying && (
          <div className="flex shrink-0 items-center gap-1">
            <button type="button" onClick={() => setPaying(true)} className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
              {deadline.recurrence !== 'none' ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} {t('markPaid')}
            </button>
            <button type="button" onClick={onEdit} aria-label={t('edit')} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-[var(--ink)]">
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => confirm(t('deleteDeadlineConfirm')) && run(() => deleteDeadline(deadline.id))}
              aria-label={t('delete')}
              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
      {paying && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('amountPaid')} aria-label={t('amountPaid')} className={input} />
          <input type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} aria-label={t('paidOn')} className={input} />
          <button
            type="button"
            disabled={isPending}
            onClick={() => run(() => payDeadline(deadline.id, { amount: parseNumber(amount) ?? 0, paidOn }), () => setPaying(false))}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t('confirmPaid')}
          </button>
          <button type="button" onClick={() => setPaying(false)} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-gray-100">
            {t('cancel')}
          </button>
          <p className="text-xs text-[var(--muted)] sm:col-span-4">{deadline.recurrence !== 'none' ? t('payHintRecurring') : t('payHintOnce')}</p>
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
    </li>
  )
}

function DeadlineForm({ vehicleId, deadline, today, onClose }: { vehicleId: string; deadline: GarageDeadline | null; today: string; onClose: () => void }) {
  const t = useTranslations('garage')
  const { run, isPending, error } = useAction()
  const [kind, setKind] = useState<DeadlineKind>(deadline?.kind ?? 'bollo')
  const [title, setTitle] = useState(deadline?.title ?? '')
  const [dueDate, setDueDate] = useState(deadline?.due_date ?? today)
  const [amount, setAmount] = useState(deadline?.amount !== null && deadline?.amount !== undefined ? String(deadline.amount).replace('.', ',') : '')
  const [recurrence, setRecurrence] = useState<DeadlineRecurrence>(deadline?.recurrence ?? 'yearly')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    run(() => saveDeadline(vehicleId, { kind, title, dueDate, amount: parseNumber(amount), recurrence }, deadline?.id), onClose)
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/40 p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select
          value={kind}
          onChange={(e) => {
            const next = e.target.value as DeadlineKind
            setKind(next)
            // La revisione si ripete ogni due anni, il resto ogni anno
            if (!deadline) setRecurrence(next === 'revisione' ? 'every_2_years' : next === 'altro' ? 'none' : 'yearly')
          }}
          aria-label={t('deadlineKind')}
          className={input}
        >
          {DEADLINE_KINDS.map((value) => (
            <option key={value} value={value}>
              {t(`deadline_${value}`)}
            </option>
          ))}
        </select>
        <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={t('deadlineTitlePlaceholder')} aria-label={t('deadlineTitle')} className={input} />
        <label className="text-sm font-semibold text-[var(--ink)]">
          {t('dueDate')}
          <input type="date" required value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={`${input} mt-1`} />
        </label>
        <label className="text-sm font-semibold text-[var(--ink)]">
          {t('expectedAmount')}
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" className={`${input} mt-1`} />
        </label>
        <label className="text-sm font-semibold text-[var(--ink)] sm:col-span-2">
          {t('repeats')}
          <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as DeadlineRecurrence)} className={`${input} mt-1`}>
            {DEADLINE_RECURRENCES.map((value) => (
              <option key={value} value={value}>
                {t(`recurrence_${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={isPending} className="flex items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--ink-soft)] disabled:opacity-60">
          {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {t('save')}
        </button>
        <button type="button" onClick={onClose} className="flex items-center gap-1 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-white">
          <X className="h-4 w-4" /> {t('cancel')}
        </button>
      </div>
    </form>
  )
}

function ExpensesSection({ vehicleId, expenses, today, spendlyAvailable }: { vehicleId: string; expenses: GarageExpense[]; today: string; spendlyAvailable: boolean }) {
  const t = useTranslations('garage')
  const f = useFormat()
  const { run, isPending, error } = useAction()
  const [kind, setKind] = useState<ExpenseKind>('carburante')
  const [amount, setAmount] = useState('')
  const [spentOn, setSpentOn] = useState(today)
  const [note, setNote] = useState('')
  const [showAll, setShowAll] = useState(false)

  const year = today.slice(0, 4)
  const month = today.slice(0, 7)
  const monthTotal = expenses.filter((e) => e.spent_on.startsWith(month)).reduce((sum, e) => sum + e.amount, 0)
  const yearTotal = expenses.filter((e) => e.spent_on.startsWith(year)).reduce((sum, e) => sum + e.amount, 0)
  const byKind = EXPENSE_KINDS.map((k) => ({ kind: k, total: expenses.filter((e) => e.kind === k && e.spent_on.startsWith(year)).reduce((sum, e) => sum + e.amount, 0) })).filter(
    (row) => row.total > 0
  )
  const shown = showAll ? expenses : expenses.slice(0, 10)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const value = parseNumber(amount)
    if (value === null) return
    run(() => addExpense(vehicleId, { kind, amount: value, spentOn, note }), () => {
      setAmount('')
      setNote('')
    })
  }

  return (
    <section className={card}>
      <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
        <Wallet className="h-5 w-5 text-[var(--gold)]" /> {t('expensesTitle')}
      </h2>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{spendlyAvailable ? t('expensesHintSpendly') : t('expensesHint')}</p>

      <form onSubmit={submit} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
        <select value={kind} onChange={(e) => setKind(e.target.value as ExpenseKind)} aria-label={t('expenseKind')} className={`${input} col-span-2 sm:col-span-1`}>
          {EXPENSE_KINDS.map((value) => (
            <option key={value} value={value}>
              {t(`expense_${value}`)}
            </option>
          ))}
        </select>
        <input inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t('amount')} aria-label={t('amount')} className={input} />
        <input type="date" required value={spentOn} max={today} onChange={(e) => setSpentOn(e.target.value)} aria-label={t('expenseDate')} className={input} />
        <button type="submit" disabled={isPending} className="col-span-2 flex items-center justify-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--ink-soft)] disabled:opacity-60 sm:col-span-1">
          {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t('addExpense')}
        </button>
        <input value={note} maxLength={120} onChange={(e) => setNote(e.target.value)} placeholder={t('expenseNote')} aria-label={t('expenseNote')} className={`${input} col-span-2 sm:col-span-4`} />
      </form>
      {error && <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>}

      <div className="mt-5 grid grid-cols-2 gap-3">
        <Stat label={t('monthTotal')} value={f.eur(monthTotal)} />
        <Stat label={t('yearTotal', { year })} value={f.eur(yearTotal)} />
      </div>
      {byKind.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {byKind.map((row) => (
            <span key={row.kind} className="rounded-full bg-[#f3f1ec] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
              {t(`expense_${row.kind}`)} · {f.eur(row.total)}
            </span>
          ))}
        </div>
      )}

      {expenses.length > 0 && (
        <ul className="mt-4 divide-y divide-gray-100">
          {shown.map((expense) => (
            <li key={expense.id} className="flex items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--ink)]">
                  {t(`expense_${expense.kind}`)}
                  {expense.note && <span className="font-normal text-[var(--muted)]"> · {expense.note}</span>}
                </p>
                <p className="text-xs text-[var(--muted)]">{f.date(expense.spent_on)}</p>
              </div>
              <span className="shrink-0 font-bold text-[var(--ink)]">{f.eur(expense.amount)}</span>
              <button
                type="button"
                disabled={isPending}
                onClick={() => confirm(t('deleteExpenseConfirm')) && run(() => deleteExpense(expense.id))}
                aria-label={t('delete')}
                className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {expenses.length > 10 && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-2 text-sm font-bold text-[var(--gold)] hover:text-[var(--ink)]">
          {showAll ? t('showLess') : t('showAll', { count: expenses.length })}
        </button>
      )}
    </section>
  )
}

