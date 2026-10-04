import { getLocale, getTranslations } from 'next-intl/server'
import { AlertTriangle, CalendarClock, CarFront, ChevronRight, Gauge, KeyRound, Plus, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { loadGarage } from '@/lib/garage-server'
import { deadlineState, rentalReport } from '@/lib/garage'
import { todayKey } from '@/lib/agenda'

// Separatore delle migliaia anche con 4 cifre (in italiano «3.870 km», non «3870 km»)
const GROUP = 'always' as unknown as boolean

export const dynamic = 'force-dynamic'

const STATUS_STYLE = {
  ok: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  over: 'bg-red-100 text-red-700',
}

// Kumani Garage: le proprie auto con stato dei km (noleggio), prossima
// scadenza e spese del mese.
export default async function GaragePage() {
  const locale = await getLocale()
  const t = await getTranslations('garage')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { vehicles, readings, deadlines, expenses } = await loadGarage(supabase, user!.id)
  const today = todayKey()
  const month = today.slice(0, 7)
  const eur = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, useGrouping: GROUP }).format(value)
  const km = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 0, useGrouping: GROUP }).format(value)
  const date = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
        <div className="relative max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
            <Sparkles className="h-4 w-4" /> {t('eyebrow')}
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h1>
          <p className="mt-3 text-white/75">{t('heroText')}</p>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-[var(--ink)]">{t('yourVehicles')}</h2>
        <Link
          href="/marketplace/garage/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] shadow-sm hover:brightness-105"
        >
          <Plus className="h-4 w-4" /> {t('addVehicle')}
        </Link>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-[var(--gold)]/40 bg-white px-6 py-10 text-center">
          <CarFront className="mx-auto h-10 w-10 text-[var(--gold)]" />
          <p className="mt-3 font-bold text-[var(--ink)]">{t('emptyTitle')}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">{t('emptyText')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {vehicles.map((vehicle) => {
            const own = readings.filter((r) => r.vehicle_id === vehicle.id)
            const report = rentalReport(vehicle, own, today)
            const lastKm = own.length ? own[own.length - 1].km : vehicle.initial_km
            const next = deadlines.find((d) => d.vehicle_id === vehicle.id)
            const monthSpent = expenses.filter((e) => e.vehicle_id === vehicle.id && e.spent_on.startsWith(month)).reduce((sum, e) => sum + e.amount, 0)
            return (
              <Link
                key={vehicle.id}
                href={`/marketplace/garage/${vehicle.id}`}
                className="group flex flex-col rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-[0_8px_24px_rgba(23,23,23,0.06)] transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                    {vehicle.kind === 'rental' ? <KeyRound className="h-5 w-5" /> : <CarFront className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-[var(--ink)]">{vehicle.name}</p>
                    <p className="truncate text-sm text-[var(--muted)]">
                      {[vehicle.model, vehicle.plate, t(`kind_${vehicle.kind}`)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
                </div>

                {report ? (
                  <div className="mt-4">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_STYLE[report.status]}`}>{t(`status_${report.status}`)}</span>
                      <span className="text-[var(--muted)]">
                        {km(report.kmDriven)} / {km(report.kmIncluded)} km
                      </span>
                    </div>
                    <div className="relative mt-2 h-2.5 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={`h-full rounded-full ${report.status === 'over' ? 'bg-red-500' : report.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${report.usedPercent}%` }}
                      />
                      <div className="absolute inset-y-0 w-0.5 bg-[var(--ink)]" style={{ left: `${report.timePercent}%` }} title={t('timeMarker')} />
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 flex items-center gap-1.5 text-sm text-[var(--muted)]">
                    <Gauge className="h-4 w-4" /> {km(lastKm)} km
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t border-gray-100 pt-3 text-xs text-[var(--muted)]">
                  {next ? (
                    <span className={`flex items-center gap-1 ${deadlineState(next.due_date, today) === 'overdue' ? 'font-bold text-red-600' : ''}`}>
                      {deadlineState(next.due_date, today) === 'overdue' ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                      {next.title || t(`deadline_${next.kind}`)} · {date(next.due_date)}
                    </span>
                  ) : (
                    <span>{t('noDeadlines')}</span>
                  )}
                  <span>{t('monthSpent', { amount: eur(monthSpent) })}</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
