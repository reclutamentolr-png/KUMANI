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
    <section className="overflow-hidden rounded-2xl border border-[var(--gold)]/40 bg-white shadow-[0_14px_40px_rgba(23,23,23,0.12)]">
      {/* Parte alta scura: titolo, settimana e giorni */}
      <div className="bg-gradient-to-br from-[#26221c] to-[var(--ink)] px-4 pb-5 pt-5 text-white sm:px-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-white sm:text-xl">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--gold)]/20">
            <CalendarDays className="h-5 w-5 text-[var(--gold-bright)]" />
          </span>
          {t('upcomingTitle')}
          {overdue.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{t('overdueCount', { count: overdue.length })}</span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-3 py-1.5 text-sm font-bold text-[var(--ink)] shadow hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> {t('add')}
        </button>
      </div>

      {/* Navigazione per settimana */}
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => moveWeek(-1)} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label={t('previousWeek')}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center text-center">
          <span className="flex items-center gap-2 text-base font-bold text-white sm:text-lg">
            {loading && <LoaderCircle className="h-4 w-4 animate-spin text-[var(--gold-bright)]" />}
            {monthLabel}
          </span>
          <span className="flex items-center gap-2 text-xs font-medium text-white/60">
            {week === 0 ? t('thisWeek') : rangeLabel}
            {week !== 0 && (
              <button type="button" onClick={() => moveWeek(-week)} className="font-semibold text-[var(--gold-bright)] hover:underline">
                {t('goToday')}
              </button>
            )}
          </span>
        </div>
        <button type="button" onClick={() => moveWeek(1)} className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white" aria-label={t('nextWeek')}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Striscia dei 7 giorni */}
      <div className={`grid grid-cols-7 gap-1 sm:gap-1.5 ${loading ? 'opacity-50' : ''}`}>
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
              className={`flex flex-col items-center rounded-xl border py-2 transition-colors sm:py-2.5 ${
                isSelected
                  ? 'border-white bg-white text-[var(--ink)] shadow-lg'
                  : isToday
                    ? 'border-[var(--gold-bright)] bg-gradient-to-b from-[var(--gold-bright)] to-[var(--gold)] text-[var(--ink)] shadow-[0_6px_18px_rgba(199,154,59,0.45)]'
                    : 'border-white/10 bg-white/[0.06] text-white hover:border-[var(--gold)]/60 hover:bg-white/10'
              }`}
            >
              <span className={`text-[10px] font-semibold uppercase ${isSelected || isToday ? 'text-[var(--ink)]/70' : 'text-white/60'}`}>
                {d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })}
              </span>
              <span className="text-lg font-extrabold leading-tight sm:text-xl">{d.getUTCDate()}</span>
              {/* Primo giorno di un nuovo mese dentro la settimana: sigla del mese */}
              {d.getUTCDate() === 1 && (
                <span className={`-mt-0.5 text-[9px] font-bold uppercase ${isSelected || isToday ? 'text-[var(--ink)]' : 'text-[var(--gold-bright)]'}`}>
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
      </div>

      {/* Parte bassa chiara: impegni */}
      <div className="px-4 py-5 sm:px-5">
      {shown.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/50 px-4 py-6 text-center">
          <CalendarDays className="h-7 w-7 text-[var(--gold)]" />
          <p className="text-sm font-medium text-[var(--ink)]">{selected ? t('nothingThatDay') : t('nothingUpcoming')}</p>
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
        <Link
          href="/marketplace/memolife"
          className="mx-auto mt-4 flex w-fit items-center justify-center gap-1.5 rounded-lg border border-[var(--gold)] px-4 py-2 text-sm font-bold text-[var(--ink)] transition-colors hover:bg-[var(--gold)] hover:text-white"
        >
          {list.length > MAX_ROWS ? t('seeAllCount', { count: list.length }) : t('openCalendar')} <ArrowRight className="h-4 w-4" />
        </Link>
      )}
      </div>

      {adding && <QuickAddMenu sources={sources} onClose={() => setAdding(false)} />}
    </section>
  )
}
