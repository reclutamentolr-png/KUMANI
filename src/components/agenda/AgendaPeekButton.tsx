'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, CalendarDays, LoaderCircle, Plus, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getAgendaPeek } from '@/app/actions/agenda'
import { agendaStatus, type AgendaEvent } from '@/lib/agenda'
import type { AgendaSources } from '@/lib/agenda-server'
import { KIND_COLOR } from './AgendaEventRow'
import QuickAddMenu from './QuickAddMenu'

// Icona calendario in alto, accanto alla campanella, su tutte le pagine: il
// numero è quello che c'è da fare oggi (più le cose da recuperare) e,
// toccandola, si vedono oggi e i prossimi giorni senza tornare in Home.
// I dati restano in memoria per qualche minuto: cambiando pagina non si
// rileggono ogni volta.

type Peek = { today: string; events: AgendaEvent[]; sources: AgendaSources }

const CACHE_KEY = 'kumani_agenda_peek'
const CACHE_MS = 3 * 60_000
const NEXT_ROWS = 4

function readCache(): { at: number; data: Peek | null } | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Dopo una modifica all'agenda (es. «Fatto» nella dashboard): si rilegge
export function forgetAgendaPeek() {
  try {
    sessionStorage.removeItem(CACHE_KEY)
  } catch {
    // niente da togliere
  }
}

function writeCache(data: Peek | null) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }))
  } catch {
    // memoria del browser non disponibile: si rilegge la prossima volta
  }
}

export default function AgendaPeekButton() {
  const t = useTranslations('agenda')
  const locale = useLocale()
  const [peek, setPeek] = useState<Peek | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const load = useCallback(async (force: boolean) => {
    const cached = readCache()
    if (!force && cached && Date.now() - cached.at < CACHE_MS) {
      setPeek(cached.data)
      return
    }
    if (cached) setPeek(cached.data)
    setLoading(true)
    try {
      const data = await getAgendaPeek()
      setPeek(data)
      writeCache(data)
    } catch {
      // resta quello che c'era
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(false)
    const onVisible = () => document.visibilityState === 'visible' && load(false)
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [load])

  // Chiusura con Esc o toccando fuori (computer)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])

  if (!peek) return null

  const { today, events, sources } = peek
  const overdue = events.filter((e) => e.date < today && agendaStatus(e, today) === 'overdue')
  const todayEvents = events.filter((e) => e.date === today)
  const next = events.filter((e) => e.date > today)
  const count = overdue.length + todayEvents.filter((e) => !e.done).length
  const calendarHref = sources.memolife ? '/marketplace/memolife' : sources.lifeCalendar ? '/marketplace/life-calendar' : '/dashboard'
  const dateLabel = (key: string, long: boolean) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { weekday: long ? 'long' : 'short', day: 'numeric', ...(long ? { month: 'long' } : {}), timeZone: 'UTC' })

  // Scadute: giorno e mese (possono essere di settimane fa)
  const overdueLabel = (key: string) => new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' })

  const toggle = () => {
    if (!open) load(true)
    setOpen(!open)
  }

  const row = (event: AgendaEvent, label: string, late = false) => (
    <li key={event.key}>
      <Link
        href={calendarHref}
        onClick={() => setOpen(false)}
        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 transition-colors ${late ? 'bg-rose-50 hover:bg-rose-100' : 'bg-[var(--gold-pale)]/60 hover:bg-[var(--gold-pale)]'}`}
      >
        <span className={`w-14 shrink-0 text-xs font-extrabold ${late ? 'text-rose-700' : 'text-[var(--gold)]'}`}>{label}</span>
        <span className={`h-2 w-2 shrink-0 rounded-full ${KIND_COLOR[event.kind]}`} />
        <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${event.done ? 'text-gray-400 line-through' : 'text-[var(--ink)]'}`}>{event.title}</span>
      </Link>
    </li>
  )

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t('peekLabel', { n: count })}
        aria-expanded={open}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <CalendarDays className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--ink)] bg-[var(--gold-bright)] px-1 text-[11px] font-bold leading-none text-[var(--ink)]">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[69] bg-black/50 sm:hidden" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label={t('sectionToday')}
            className="fixed inset-x-0 top-0 z-[70] max-h-[85vh] overflow-y-auto rounded-b-3xl bg-white text-[var(--ink)] shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:max-h-[70vh] sm:w-[380px] sm:rounded-2xl sm:border sm:border-[var(--gold)]/25"
          >
            <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-3">
              <span className="flex items-center gap-2 text-base font-bold">
                {t('sectionToday')} · {dateLabel(today, true)}
                {loading && <LoaderCircle className="h-4 w-4 animate-spin text-[var(--gold)]" />}
              </span>
              <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 px-4 pb-4 pt-2">
              {overdue.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-rose-700">{t('sectionOverdue')}</p>
                  <ul className="space-y-1.5">{overdue.slice(0, 3).map((e) => row(e, overdueLabel(e.date), true))}</ul>
                </div>
              )}
              {todayEvents.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/40 px-3 py-3 text-center text-sm font-medium">{t('emptyToday')}</p>
              ) : (
                <ul className="space-y-1.5">{todayEvents.map((e) => row(e, e.time ?? '•'))}</ul>
              )}
              {next.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.15em] text-gray-500">{t('sectionNextDays')}</p>
                  <ul className="space-y-1.5">{next.slice(0, NEXT_ROWS).map((e) => row(e, dateLabel(e.date, false)))}</ul>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {(sources.memolife || sources.spendly || sources.lifeCalendar) && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false)
                      setAdding(true)
                    }}
                    className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[var(--ink)] px-3 text-sm font-bold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]"
                  >
                    <Plus className="h-4 w-4" /> {t('add')}
                  </button>
                )}
                <Link
                  href={calendarHref}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-[var(--ink)] px-3 text-sm font-bold text-[var(--ink)] hover:bg-gray-50"
                >
                  {t('openCalendar')} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </>
      )}

      {adding && <QuickAddMenu sources={sources} onClose={() => setAdding(false)} />}
    </div>
  )
}
