'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import {
  BookUser,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileBadge,
  Mail,
  MessageCircle,
  NotebookPen,
  Phone,
  Plus,
  Receipt,
  Search,
  Sun,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import AgendaEventRow from '@/components/agenda/AgendaEventRow'
import { getAgendaRange } from '@/app/actions/agenda'
import { setTaskDone } from '@/app/actions/agenda'
import { addDays, monthRange, type AgendaEvent } from '@/lib/agenda'
import type { AgendaSources } from '@/lib/agenda-server'
import MemoLifeCalendar from './MemoLifeCalendar'
import {
  AppointmentForm,
  ContactForm,
  NoteForm,
  Sheet,
  TaskForm,
  type AppointmentDraft,
  type ContactDraft,
  type NoteDraft,
  type TaskDraft,
} from './MemoLifeForms'

export type MemoTask = { id: string; title: string; description: string | null; due_date: string | null; priority: string | null; completed: boolean | null }
export type MemoNote = { id: string; title: string | null; content: string; created_at: string }
export type MemoContact = { id: string; name: string; phone: string | null; email: string | null; company: string | null; notes: string | null }

type Tab = 'today' | 'calendar' | 'tasks' | 'notes' | 'contacts'
type Editor =
  | { kind: 'appointment'; draft: AppointmentDraft }
  | { kind: 'task'; draft: TaskDraft }
  | { kind: 'note'; draft: NoteDraft }
  | { kind: 'contact'; draft: ContactDraft }
  | { kind: 'menu' }
  | null

const TABS: { key: Tab; icon: typeof Sun }[] = [
  { key: 'today', icon: Sun },
  { key: 'calendar', icon: CalendarDays },
  { key: 'tasks', icon: CheckCircle2 },
  { key: 'notes', icon: NotebookPen },
  { key: 'contacts', icon: BookUser },
]

export default function MemoLifeApp({
  today,
  sources,
  upcoming,
  monthEvents,
  tasks,
  notes,
  contacts,
  initialAdd,
}: {
  today: string
  sources: AgendaSources
  upcoming: AgendaEvent[]
  monthEvents: AgendaEvent[]
  tasks: MemoTask[]
  notes: MemoNote[]
  contacts: MemoContact[]
  initialAdd: 'appointment' | 'task' | null
}) {
  const t = useTranslations('agenda')
  const locale = useLocale()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('today')
  const [editor, setEditor] = useState<Editor>(
    initialAdd === 'appointment'
      ? { kind: 'appointment', draft: { title: '', date: today, time: '09:00', description: '' } }
      : initialAdd === 'task'
        ? { kind: 'task', draft: { title: '', dueDate: '', priority: 'medium', description: '' } }
        : null
  )
  const [view, setView] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) })
  const [selectedDay, setSelectedDay] = useState(today)
  const [calendarEvents, setCalendarEvents] = useState(monthEvents)
  const [loadingMonth, setLoadingMonth] = useState(false)
  const [query, setQuery] = useState('')
  const [showDone, setShowDone] = useState(false)

  // Mese mostrato nel calendario (rilegge anche dopo ogni modifica).
  // Ogni richiesta ha un numero progressivo: una risposta arrivata dopo che
  // l'utente ha già cambiato mese viene ignorata.
  const monthRequest = useRef(0)
  const loadMonth = useCallback(async (year: number, month: number) => {
    const request = ++monthRequest.current
    setLoadingMonth(true)
    try {
      const range = monthRange(year, month)
      const events = await getAgendaRange(range.from, range.to)
      if (request === monthRequest.current) setCalendarEvents(events)
    } catch (err) {
      console.error('[MemoLife] loadMonth failed:', err)
    } finally {
      if (request === monthRequest.current) setLoadingMonth(false)
    }
  }, [])

  const isCurrentMonth = view.year === Number(today.slice(0, 4)) && view.month === Number(today.slice(5, 7))
  useEffect(() => {
    if (isCurrentMonth) setCalendarEvents(monthEvents)
  }, [monthEvents, isCurrentMonth])

  const refresh = () => {
    setEditor(null)
    router.refresh()
    if (!isCurrentMonth) loadMonth(view.year, view.month)
  }

  const moveMonth = (delta: number | 'today') => {
    const next =
      delta === 'today'
        ? { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
        : (() => {
            const index = view.year * 12 + (view.month - 1) + delta
            return { year: Math.floor(index / 12), month: (index % 12) + 1 }
          })()
    setView(next)
    setSelectedDay(delta === 'today' ? today : `${next.year}-${String(next.month).padStart(2, '0')}-01`)
    if (next.year === Number(today.slice(0, 4)) && next.month === Number(today.slice(5, 7))) {
      // Mese corrente già noto: invalida eventuali richieste in corso
      monthRequest.current++
      setLoadingMonth(false)
      setCalendarEvents(monthEvents)
    } else loadMonth(next.year, next.month)
  }

  // Apre la scheda giusta toccando un evento
  const openEvent = (event: AgendaEvent) => {
    if (event.kind === 'appointment') {
      setEditor({ kind: 'appointment', draft: { id: event.refId, title: event.title, date: event.date, time: event.time ?? '09:00', description: event.note ?? '' } })
    } else if (event.kind === 'task') {
      const task = tasks.find((x) => x.id === event.refId)
      setEditor({ kind: 'task', draft: { id: event.refId, title: event.title, dueDate: event.date, priority: task?.priority ?? 'medium', description: event.note ?? '' } })
    }
  }

  const dayLabel = (key: string) =>
    new Date(`${key}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })

  const eventList = (events: AgendaEvent[], empty: string) =>
    events.length === 0 ? (
      <p className="rounded-xl bg-white px-4 py-5 text-center text-sm text-[var(--muted)]">{empty}</p>
    ) : (
      <ul className="space-y-2">
        {events.map((event) => (
          <AgendaEventRow key={event.key} event={event} today={today} onChanged={refresh} onOpen={openEvent} />
        ))}
      </ul>
    )

  // ---------- Oggi ----------
  const overdue = upcoming.filter((e) => e.date < today && !e.done)
  const todayEvents = upcoming.filter((e) => e.date === today)
  const nextDays = upcoming.filter((e) => e.date > today && e.date <= addDays(today, 6) && !e.done)
  const undatedTasks = tasks.filter((x) => !x.completed && !x.due_date)

  // ---------- Promemoria ----------
  const openTasks = tasks
    .filter((x) => !x.completed)
    .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  const doneTasks = tasks.filter((x) => x.completed)

  const q = query.trim().toLowerCase()
  const visibleNotes = notes.filter((n) => !q || `${n.title ?? ''} ${n.content}`.toLowerCase().includes(q))
  const visibleContacts = contacts.filter((c) => !q || `${c.name} ${c.company ?? ''} ${c.phone ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q))

  const section = (title: string, children: React.ReactNode, tone = 'text-[var(--ink)]') => (
    <section>
      <h3 className={`mb-2 text-sm font-bold uppercase tracking-wide ${tone}`}>{title}</h3>
      {children}
    </section>
  )

  return (
    <div>
      {/* Schede */}
      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-[var(--gold)]/25 bg-white p-1 shadow-sm">
        {TABS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setTab(key)
              setQuery('')
            }}
            className={`flex min-w-[4.5rem] flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-xs font-semibold transition-colors sm:flex-row sm:justify-center sm:gap-1.5 sm:text-sm ${
              tab === key ? 'bg-[var(--ink)] text-white' : 'text-[var(--muted)] hover:bg-gray-100'
            }`}
          >
            <Icon className="h-4 w-4" /> {t(`tab_${key}`)}
          </button>
        ))}
      </nav>

      {tab === 'today' && (
        <div className="space-y-6">
          <p className="text-2xl font-bold capitalize text-[var(--ink)]">{dayLabel(today)}</p>
          {overdue.length > 0 && section(t('sectionOverdue'), eventList(overdue, ''), 'text-red-600')}
          {section(t('sectionToday'), eventList(todayEvents, t('emptyToday')))}
          {section(t('sectionNextDays'), eventList(nextDays, t('emptyNextDays')))}
          {undatedTasks.length > 0 && (
            <button
              type="button"
              onClick={() => setTab('tasks')}
              className="flex w-full items-center justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-800"
            >
              {t('undatedTasks', { count: undatedTasks.length })} <span>→</span>
            </button>
          )}
          {(!sources.spendly || !sources.lifeCalendar) && <p className="text-xs text-[var(--muted)]">{t('sourcesHint')}</p>}
        </div>
      )}

      {tab === 'calendar' && (
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <MemoLifeCalendar
            year={view.year}
            month={view.month}
            today={today}
            selected={selectedDay}
            events={calendarEvents}
            loading={loadingMonth}
            onSelect={setSelectedDay}
            onMove={moveMonth}
          />
          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-bold capitalize text-[var(--ink)]">{dayLabel(selectedDay)}</p>
              <button
                type="button"
                onClick={() => setEditor({ kind: 'appointment', draft: { title: '', date: selectedDay, time: '09:00', description: '' } })}
                className="flex items-center gap-1 rounded-lg border border-[var(--gold)]/40 bg-white px-2.5 py-1.5 text-xs font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
              >
                <Plus className="h-3.5 w-3.5" /> {t('add_appointment')}
              </button>
            </div>
            {eventList(
              calendarEvents.filter((e) => e.date === selectedDay),
              t('emptyDay')
            )}
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <div className="space-y-3">
          {openTasks.length === 0 && <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-[var(--muted)]">{t('emptyTasks')}</p>}
          <ul className="space-y-2">
            {openTasks.map((task) => {
              const late = task.due_date && task.due_date < today
              return (
                <li key={task.id} className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 ${late ? 'border-red-200' : 'border-[var(--gold)]/20'}`}>
                  <button
                    type="button"
                    onClick={async () => {
                      await setTaskDone(task.id, true)
                      refresh()
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-violet-400 hover:bg-violet-100"
                    aria-label={t('markDone')}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setEditor({
                        kind: 'task',
                        draft: { id: task.id, title: task.title, dueDate: task.due_date ?? '', priority: task.priority ?? 'medium', description: task.description ?? '' },
                      })
                    }
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-semibold text-[var(--ink)]">{task.title}</p>
                    <p className={`text-xs ${late ? 'font-semibold text-red-600' : 'text-[var(--muted)]'}`}>
                      {task.due_date ? dayLabel(task.due_date) : t('noDate')}
                    </p>
                  </button>
                  <span
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${task.priority === 'high' ? 'bg-red-500' : task.priority === 'low' ? 'bg-gray-300' : 'bg-amber-400'}`}
                    title={t(`priority_${task.priority ?? 'medium'}`)}
                  />
                </li>
              )
            })}
          </ul>
          {doneTasks.length > 0 && (
            <div>
              <button type="button" onClick={() => setShowDone((v) => !v)} className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
                {showDone ? t('hideDone') : t('showDone', { count: doneTasks.length })}
              </button>
              {showDone && (
                <ul className="mt-2 space-y-1.5">
                  {doneTasks.slice(0, 50).map((task) => (
                    <li key={task.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                      <button
                        type="button"
                        onClick={async () => {
                          await setTaskDone(task.id, false)
                          refresh()
                        }}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-500 text-white"
                        aria-label={t('undo')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                      <span className="truncate line-through">{task.title}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {(tab === 'notes' || tab === 'contacts') && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
          />
        </div>
      )}

      {tab === 'notes' &&
        (visibleNotes.length === 0 ? (
          <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-[var(--muted)]">{t('emptyNotes')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => setEditor({ kind: 'note', draft: { id: note.id, title: note.title ?? '', content: note.content } })}
                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left shadow-sm transition-transform hover:-translate-y-0.5"
              >
                {note.title && <p className="mb-1 font-bold text-[var(--ink)]">{note.title}</p>}
                <p className="line-clamp-5 whitespace-pre-wrap text-sm text-gray-700">{note.content}</p>
                <p className="mt-2 text-[11px] text-gray-400">{new Date(note.created_at).toLocaleDateString(locale)}</p>
              </button>
            ))}
          </div>
        ))}

      {tab === 'contacts' &&
        (visibleContacts.length === 0 ? (
          <p className="rounded-xl bg-white px-4 py-6 text-center text-sm text-[var(--muted)]">{t('emptyContacts')}</p>
        ) : (
          <ul className="space-y-2">
            {visibleContacts.map((c) => {
              const digits = (c.phone ?? '').replace(/[^\d+]/g, '').replace(/^\+/, '')
              return (
                <li key={c.id} className="flex items-center gap-3 rounded-xl border border-[var(--gold)]/20 bg-white px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() =>
                      setEditor({
                        kind: 'contact',
                        draft: { id: c.id, name: c.name, phone: c.phone ?? '', email: c.email ?? '', company: c.company ?? '', notes: c.notes ?? '' },
                      })
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] font-bold text-[var(--gold-bright)]">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-[var(--ink)]">{c.name}</span>
                      <span className="block truncate text-xs text-[var(--muted)]">{[c.company, c.phone, c.email].filter(Boolean).join(' · ')}</span>
                    </span>
                  </button>
                  <span className="flex shrink-0 items-center gap-1">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label={t('call')}>
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {digits.length >= 6 && (
                      <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener noreferrer" className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50" aria-label="WhatsApp">
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label={t('email')}>
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        ))}

      {/* Pulsante + */}
      <button
        type="button"
        onClick={() => setEditor({ kind: 'menu' })}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] shadow-xl transition-transform hover:scale-105"
        aria-label={t('add')}
      >
        <Plus className="h-7 w-7" />
      </button>

      {editor?.kind === 'menu' && (
        <Sheet title={t('addWhat')} onClose={() => setEditor(null)}>
          <div className="space-y-2">
            {[
              { key: 'appointment', icon: CalendarClock, color: 'bg-sky-500', open: () => setEditor({ kind: 'appointment', draft: { title: '', date: tab === 'calendar' ? selectedDay : today, time: '09:00', description: '' } }) },
              { key: 'task', icon: CheckCircle2, color: 'bg-violet-500', open: () => setEditor({ kind: 'task', draft: { title: '', dueDate: '', priority: 'medium', description: '' } }) },
              { key: 'note', icon: NotebookPen, color: 'bg-amber-400', open: () => setEditor({ kind: 'note', draft: { title: '', content: '' } }) },
              { key: 'contact', icon: BookUser, color: 'bg-[var(--ink)]', open: () => setEditor({ kind: 'contact', draft: { name: '', phone: '', email: '', company: '', notes: '' } }) },
            ].map(({ key, icon: Icon, color, open }) => (
              <button key={key} type="button" onClick={open} className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-3 text-left hover:border-[var(--gold)] hover:bg-[var(--gold-pale)]/40">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg text-white ${color}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="font-semibold text-[var(--ink)]">{t(`add_${key}`)}</span>
              </button>
            ))}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {sources.spendly && (
                <Link href="/marketplace/spendly/bollette?new=1" className="flex items-center gap-2 rounded-xl border border-dashed border-amber-300 p-3 text-sm font-semibold text-amber-800 hover:bg-amber-50">
                  <Receipt className="h-4 w-4" /> {t('add_bill')} <ExternalLink className="ml-auto h-3.5 w-3.5" />
                </Link>
              )}
              {sources.lifeCalendar && (
                <Link href="/marketplace/life-calendar/new" className="flex items-center gap-2 rounded-xl border border-dashed border-rose-300 p-3 text-sm font-semibold text-rose-800 hover:bg-rose-50">
                  <FileBadge className="h-4 w-4" /> {t('add_deadline')} <ExternalLink className="ml-auto h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </Sheet>
      )}
      {editor?.kind === 'appointment' && (
        <Sheet title={editor.draft.id ? t('editAppointment') : t('add_appointment')} onClose={() => setEditor(null)}>
          <AppointmentForm draft={editor.draft} onDone={refresh} />
        </Sheet>
      )}
      {editor?.kind === 'task' && (
        <Sheet title={editor.draft.id ? t('editTask') : t('add_task')} onClose={() => setEditor(null)}>
          <TaskForm draft={editor.draft} onDone={refresh} />
        </Sheet>
      )}
      {editor?.kind === 'note' && (
        <Sheet title={editor.draft.id ? t('editNote') : t('add_note')} onClose={() => setEditor(null)}>
          <NoteForm draft={editor.draft} onDone={refresh} />
        </Sheet>
      )}
      {editor?.kind === 'contact' && (
        <Sheet title={editor.draft.id ? t('editContact') : t('add_contact')} onClose={() => setEditor(null)}>
          <ContactForm draft={editor.draft} onDone={refresh} />
        </Sheet>
      )}
    </div>
  )
}
