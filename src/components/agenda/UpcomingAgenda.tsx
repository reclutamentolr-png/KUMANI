'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, Plus } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getAgendaRange } from '@/app/actions/agenda'
import { addDays, type AgendaEvent } from '@/lib/agenda'
import type { AgendaSources } from '@/lib/agenda-server'
import AgendaEventRow, { KIND_COLOR } from './AgendaEventRow'
import QuickAddMenu from './QuickAddMenu'

const MAX_ROWS = 6

// Dashboard → "I prossimi giorni": striscia dei 7 giorni con i pallini degli
// impegni e la lista (prima le cose scadute) dai tre strumenti, con le azioni
// rapide. Un giorno toccato filtra la lista; le frecce scorrono di una
// settimana (le altre settimane si caricano al volo, senza le cose scadute).
export default function UpcomingAgenda({ events, today, sources }: { events: AgendaEvent[]; today: string; sources: AgendaSources }) {
  const t = useTranslations('agenda')
  const locale = useLocale()
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [week, setWeek] = useState(0)
  const [otherWeek, setOtherWeek] = useState<AgendaEvent[] | null>(null)
  const [loading, setLoading] = useState(false)

  const start = addDays(today, week * 7)
  const end = addDays(start, 6)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))

  // Settimana diversa da quella attuale: si chiede al server solo quella.
  useEffect(() => {
    if (week === 0) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    getAgendaRange(start, end)
      .then((result) => {
        if (!cancelled) setOtherWeek(result.filter((e) => e.date >= start && e.date <= end))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [week, start, end])

  const weekEvents = week === 0 ? events : (otherWeek ?? [])
  const overdue = week === 0 ? events.filter((e) => e.date < today) : []
  const upcoming = weekEvents.filter((e) => e.date >= start)
  const list = selected ? weekEvents.filter((e) => e.date === selected) : [...overdue, ...upcoming]

  const moveWeek = (delta: number) => {
    setSelected(null)
    setOtherWeek(null)
    setWeek((w) => w + delta)
  }
  const rangeLabel = `${new Date(`${start}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })} – ${new Date(
    `${end}T12:00:00Z`
  ).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })}`
  // Mese (o mesi) della settimana mostrata, es. "Settembre 2026" oppure
  // "Settembre – Ottobre 2026": senza, dai soli numeri non si capisce il mese.
  const monthOf = (key: string, withYear: boolean) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { month: 'long', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
  const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
  const sameMonth = start.slice(0, 7) === end.slice(0, 7)
  const sameYear = start.slice(0, 4) === end.slice(0, 4)
  const monthLabel = sameMonth
    ? capitalize(monthOf(start, true))
    : `${capitalize(monthOf(start, !sameYear))} – ${capitalize(monthOf(end, true))}`
  const shown = list.slice(0, MAX_ROWS)

  return (
    <section className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)] p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
          <CalendarDays className="h-5 w-5 text-[var(--gold)]" /> {t('upcomingTitle')}
          {overdue.length > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{t('overdueCount', { count: overdue.length })}</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[var(--ink-soft)]"
        >
          <Plus className="h-4 w-4" /> {t('add')}
        </button>
      </div>

      {/* Navigazione per settimana */}
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => moveWeek(-1)} className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-gray-100 hover:text-[var(--ink)]" aria-label={t('previousWeek')}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center text-center">
          <span className="flex items-center gap-2 text-base font-bold text-[var(--ink)]">
            {loading && <LoaderCircle className="h-4 w-4 animate-spin text-[var(--gold)]" />}
            {monthLabel}
          </span>
          <span className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
            {week === 0 ? t('thisWeek') : rangeLabel}
            {week !== 0 && (
              <button type="button" onClick={() => moveWeek(-week)} className="font-semibold text-[var(--gold)] hover:underline">
                {t('goToday')}
              </button>
            )}
          </span>
        </div>
        <button type="button" onClick={() => moveWeek(1)} className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-gray-100 hover:text-[var(--ink)]" aria-label={t('nextWeek')}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Striscia dei 7 giorni */}
      <div className={`mb-4 grid grid-cols-7 gap-1.5 ${loading ? 'opacity-50' : ''}`}>
        {days.map((day) => {
          const dayEvents = weekEvents.filter((e) => e.date === day)
          const kinds = [...new Set(dayEvents.map((e) => e.kind))]
          const isToday = day === today
          const isSelected = day === selected
          const d = new Date(`${day}T12:00:00Z`)
          return (
            <button
              key={day}
              type="button"
              onClick={() => setSelected(isSelected ? null : day)}
              className={`flex flex-col items-center rounded-xl border py-2 transition-colors ${
                isSelected ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : isToday ? 'border-[var(--gold)] bg-[var(--gold-pale)]' : 'border-gray-100 bg-white hover:border-[var(--gold)]/50'
              }`}
            >
              <span className={`text-[10px] font-semibold uppercase ${isSelected ? 'text-white/70' : 'text-[var(--muted)]'}`}>
                {d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })}
              </span>
              <span className="text-base font-bold">{d.getUTCDate()}</span>
              {/* Primo giorno di un nuovo mese dentro la settimana: sigla del mese */}
              {d.getUTCDate() === 1 && (
                <span className={`-mt-0.5 text-[9px] font-bold uppercase ${isSelected ? 'text-[var(--gold-bright)]' : 'text-[var(--gold)]'}`}>
                  {d.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })}
                </span>
              )}
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {kinds.map((kind) => (
                  <span key={kind} className={`h-1.5 w-1.5 rounded-full ${KIND_COLOR[kind]}`} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {shown.length === 0 ? (
        <div className="rounded-xl bg-white px-4 py-6 text-center">
          <p className="text-sm text-[var(--muted)]">{selected ? t('nothingThatDay') : t('nothingUpcoming')}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((event) => (
            <AgendaEventRow
              key={event.key}
              event={event}
              today={today}
              onChanged={() => {
                router.refresh()
                if (week !== 0) getAgendaRange(start, end).then((result) => setOtherWeek(result.filter((e) => e.date >= start && e.date <= end)))
              }}
              compact
            />
          ))}
        </ul>
      )}

      {sources.memolife && (
        <Link href="/marketplace/memolife" className="mt-4 flex items-center justify-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
          {list.length > MAX_ROWS ? t('seeAllCount', { count: list.length }) : t('openCalendar')} <ArrowRight className="h-4 w-4" />
        </Link>
      )}

      {adding && <QuickAddMenu sources={sources} onClose={() => setAdding(false)} />}
    </section>
  )
}
