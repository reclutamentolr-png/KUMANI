'use client'

import { useLocale, useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { KIND_COLOR } from '@/components/agenda/AgendaEventRow'
import type { AgendaEvent } from '@/lib/agenda'

// Griglia del mese (lunedì → domenica) con i pallini colorati per tipo;
// il giorno scelto si evidenzia e la lista sotto la gestisce MemoLifeApp.
export default function MemoLifeCalendar({
  year,
  month,
  today,
  selected,
  events,
  loading,
  onSelect,
  onMove,
}: {
  year: number
  month: number
  today: string
  selected: string
  events: AgendaEvent[]
  loading: boolean
  onSelect: (day: string) => void
  onMove: (delta: number | 'today') => void
}) {
  const t = useTranslations('agenda')
  const locale = useLocale()
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  // 0 = lunedì
  const firstWeekday = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const title = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(locale, { weekday: 'narrow', timeZone: 'UTC' })
  )
  const key = (day: number) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return (
    <div className={`rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm ${loading ? 'opacity-60' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => onMove(-1)} className="rounded-lg p-2 hover:bg-gray-100" aria-label={t('previous')}>
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-bold capitalize text-[var(--ink)]">{title}</p>
          <button type="button" onClick={() => onMove('today')} className="text-xs font-semibold text-[var(--gold)] hover:underline">
            {t('goToday')}
          </button>
        </div>
        <button type="button" onClick={() => onMove(1)} className="rounded-lg p-2 hover:bg-gray-100" aria-label={t('next')}>
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-[var(--muted)]">
        {weekdays.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: firstWeekday }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = key(i + 1)
          const dayEvents = events.filter((e) => e.date === day)
          const kinds = [...new Set(dayEvents.filter((e) => !e.done).map((e) => e.kind))]
          const hasOverdue = day < today && dayEvents.some((e) => !e.done && e.kind !== 'appointment')
          const isSelected = day === selected
          const isToday = day === today
          return (
            <button
              key={day}
              type="button"
              onClick={() => onSelect(day)}
              className={`flex aspect-square flex-col items-center justify-center rounded-xl text-sm transition-colors ${
                isSelected
                  ? 'bg-[var(--ink)] font-bold text-white'
                  : isToday
                    ? 'bg-[var(--gold-pale)] font-bold text-[var(--ink)] ring-1 ring-[var(--gold)]'
                    : hasOverdue
                      ? 'bg-red-50 text-red-700'
                      : 'hover:bg-gray-100'
              }`}
            >
              {i + 1}
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {kinds.slice(0, 4).map((kind) => (
                  <span key={kind} className={`h-1.5 w-1.5 rounded-full ${KIND_COLOR[kind]}`} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
        {(['appointment', 'task', 'bill', 'deadline'] as const).map((kind) => (
          <span key={kind} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${KIND_COLOR[kind]}`} /> {t(`legend_${kind}`)}
          </span>
        ))}
      </div>
    </div>
  )
}
