'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarClock, Check, CheckCircle2, FileBadge, LoaderCircle, Receipt, RotateCcw, Undo2 } from 'lucide-react'
import { markBillPaid, setTaskDone, unmarkBillPaid } from '@/app/actions/agenda'
import { markHandled } from '@/app/actions/lifeCalendar'
import { agendaStatus, daysBetween, type AgendaEvent } from '@/lib/agenda'
import { parseAmount } from '@/lib/spendly'

const KIND_ICON = { appointment: CalendarClock, task: CheckCircle2, bill: Receipt, deadline: FileBadge }
export const KIND_COLOR = {
  appointment: 'bg-sky-500',
  task: 'bg-violet-500',
  bill: 'bg-amber-500',
  deadline: 'bg-rose-500',
}

// Una riga dell'agenda unica con l'azione rapida del suo tipo: bolletta →
// "Pagata" (con l'importo reale), promemoria → "Fatto", scadenza → "Rinnovata".
export default function AgendaEventRow({
  event,
  today,
  onChanged,
  onOpen,
  compact = false,
}: {
  event: AgendaEvent
  today: string
  onChanged: () => void
  // Tocco sul titolo: apre la scheda (appuntamenti e promemoria in MemoLife)
  onOpen?: (event: AgendaEvent) => void
  compact?: boolean
}) {
  const t = useTranslations('agenda')
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const status = agendaStatus(event, today)
  const Icon = KIND_ICON[event.kind]

  // Azione rapida: lo spinner si spegne sempre, anche se l'azione fallisce
  // (false o { success: false }), e in quel caso l'utente viene avvisato.
  const run = async (action: () => Promise<boolean | { success: boolean }>) => {
    setBusy(true)
    let ok = false
    try {
      const result = await action()
      ok = typeof result === 'boolean' ? result : result.success
    } catch (err) {
      console.error('[Agenda] quick action failed:', err)
    } finally {
      setBusy(false)
    }
    if (!ok) alert(t('errorSave'))
    onChanged()
  }

  const payBill = () => {
    const answer = prompt(t('paidAmountPrompt', { name: event.title }), String(event.amount ?? 0).replace('.', ','))
    if (answer === null) return
    const amount = parseAmount(answer)
    if (Number.isNaN(amount) || amount < 0) return
    run(() => markBillPaid(event.refId, event.period ?? '', amount))
  }

  const diff = daysBetween(today, event.date)
  const when =
    diff === 0
      ? t('today')
      : diff === 1
        ? t('tomorrow')
        : diff === -1
          ? t('yesterday')
          : new Date(`${event.date}T12:00:00Z`).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

  const details = [
    status === 'overdue' ? t('overdueDays', { count: -diff }) : when,
    event.time,
    event.amount !== null ? new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(event.amount) : null,
    t(`source_${event.kind}`),
  ].filter(Boolean)

  const tone =
    status === 'overdue'
      ? 'border-red-200 bg-red-50/70'
      : status === 'today'
        ? 'border-[var(--gold)]/50 bg-[var(--gold-pale)]/60'
        : status === 'done'
          ? 'border-gray-100 bg-gray-50 opacity-70'
          : 'border-gray-100 bg-white'

  return (
    <li className={`flex items-center gap-3 rounded-xl border px-3 ${compact ? 'py-2' : 'py-2.5'} ${tone}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white ${KIND_COLOR[event.kind]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <button type="button" disabled={!onOpen} onClick={() => onOpen?.(event)} className="min-w-0 flex-1 text-left disabled:cursor-default">
        <p className={`truncate text-sm font-semibold text-[var(--ink)] ${event.done ? 'line-through' : ''}`}>{event.title}</p>
        <p className={`truncate text-xs ${status === 'overdue' ? 'font-semibold text-red-600' : 'text-[var(--muted)]'}`}>{details.join(' · ')}</p>
      </button>
      {busy ? (
        <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-[var(--gold)]" />
      ) : event.kind === 'bill' ? (
        event.done ? (
          <button type="button" onClick={() => run(() => unmarkBillPaid(event.refId, event.period ?? ''))} className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100" title={t('undo')} aria-label={t('undo')}>
            <Undo2 className="h-4 w-4" />
          </button>
        ) : (
          <button type="button" onClick={payBill} className="shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700">
            {t('markPaid')}
          </button>
        )
      ) : event.kind === 'task' ? (
        <button
          type="button"
          onClick={() => run(() => setTaskDone(event.refId, !event.done))}
          className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold ${event.done ? 'text-gray-500 hover:bg-gray-100' : 'bg-violet-600 text-white hover:bg-violet-700'}`}
        >
          {event.done ? <Undo2 className="h-4 w-4" /> : <span className="flex items-center gap-1"><Check className="h-3.5 w-3.5" /> {t('markDone')}</span>}
        </button>
      ) : event.kind === 'deadline' ? (
        <button
          type="button"
          onClick={() => confirm(event.recurring ? t('renewConfirm', { name: event.title }) : t('completeConfirm', { name: event.title })) && run(() => markHandled(event.refId))}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
        >
          {event.recurring ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} {event.recurring ? t('markRenewed') : t('markDone')}
        </button>
      ) : null}
    </li>
  )
}
