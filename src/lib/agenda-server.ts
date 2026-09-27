import type { SupabaseClient } from '@supabase/supabase-js'
import { addDays, dateKeyOf, daysBetween, sortAgenda, timeOf, todayKey, type AgendaEvent } from '@/lib/agenda'
import { fixedExpenseDueDate, paymentKey, periodOf, type SpendlyFixedExpense, type SpendlyFixedPayment } from '@/lib/spendly'

export type AgendaSources = { memolife: boolean; spendly: boolean; lifeCalendar: boolean }

type Options = {
  from: string
  to: string
  sources: AgendaSources
  // Cose non fatte prima di "from" da riportare (bollette, promemoria, scadenze)
  overdueSince?: string
  // Mostra anche ciò che è già fatto nell'intervallo (calendario di MemoLife)
  includeDone?: boolean
  // Life Calendar: anticipa le scadenze secondo i "ricordamelo N giorni prima"
  useReminders?: boolean
}

// Eventi dei tre strumenti tra due giorni (inclusi), letti con il client
// dell'utente: le RLS limitano già tutto ai suoi dati.
export async function loadAgenda(supabase: SupabaseClient, userId: string, options: Options): Promise<AgendaEvent[]> {
  const { from, to, sources } = options
  const today = todayKey()
  const overdueSince = options.overdueSince ?? from
  const events: AgendaEvent[] = []

  const jobs: Promise<void>[] = []

  if (sources.memolife) {
    jobs.push(
      (async () => {
        // Un giorno di margine per i fusi orari, poi filtro sul giorno italiano.
        const { data } = await supabase
          .from('appointments')
          .select('id, title, description, date_time')
          .eq('user_id', userId)
          .gte('date_time', `${addDays(from, -1)}T00:00:00Z`)
          .lte('date_time', `${addDays(to, 1)}T23:59:59Z`)
        for (const a of data ?? []) {
          const instant = new Date(a.date_time as string)
          const date = dateKeyOf(instant)
          if (date < from || date > to) continue
          events.push({ key: `appointment:${a.id}`, kind: 'appointment', date, time: timeOf(instant), title: a.title, amount: null, done: false, refId: a.id, note: a.description })
        }
      })()
    )
    jobs.push(
      (async () => {
        const { data } = await supabase
          .from('tasks')
          .select('id, title, description, due_date, priority, completed')
          .eq('user_id', userId)
          .not('due_date', 'is', null)
          .gte('due_date', overdueSince)
          .lte('due_date', to)
        for (const t of data ?? []) {
          const date = t.due_date as string
          const inRange = date >= from
          if (t.completed && !(options.includeDone && inRange)) continue
          if (!t.completed && !inRange && date >= today) continue
          events.push({ key: `task:${t.id}`, kind: 'task', date, time: null, title: t.title, amount: null, done: !!t.completed, refId: t.id, note: t.description, priority: t.priority })
        }
      })()
    )
  }

  if (sources.spendly) {
    jobs.push(
      (async () => {
        const [{ data: expenses }, { data: payments }] = await Promise.all([
          supabase
            .from('spendly_fixed_expenses')
            .select('id, description, amount, frequency, category, start_date, end_date, billing_day, notes')
            .eq('user_id', userId)
            .lte('start_date', to)
            .returns<SpendlyFixedExpense[]>(),
          supabase
            .from('spendly_fixed_payments')
            .select('expense_id, period, amount, paid_on')
            .eq('user_id', userId)
            .gte('period', `${overdueSince.slice(0, 7)}-01`)
            .lte('period', `${to.slice(0, 7)}-01`)
            .returns<SpendlyFixedPayment[]>(),
        ])
        const paid = new Map((payments ?? []).map((p) => [paymentKey(p.expense_id, p.period), p]))
        // Mesi da overdueSince a to
        const months: { year: number; month: number }[] = []
        let y = Number(overdueSince.slice(0, 4))
        let m = Number(overdueSince.slice(5, 7))
        const endY = Number(to.slice(0, 4))
        const endM = Number(to.slice(5, 7))
        while (y < endY || (y === endY && m <= endM)) {
          months.push({ year: y, month: m })
          m += 1
          if (m > 12) {
            m = 1
            y += 1
          }
        }
        for (const expense of expenses ?? []) {
          for (const { year, month } of months) {
            const date = fixedExpenseDueDate({ ...expense, amount: Number(expense.amount) }, year, month)
            if (!date || date > to || date < overdueSince) continue
            const period = periodOf(year, month)
            const payment = paid.get(paymentKey(expense.id, period))
            const inRange = date >= from
            if (payment && !(options.includeDone && inRange)) continue
            if (!payment && !inRange && date >= today) continue
            events.push({
              key: `bill:${expense.id}:${period}`,
              kind: 'bill',
              date,
              time: null,
              title: expense.description,
              amount: payment ? Number(payment.amount) : Number(expense.amount),
              done: !!payment,
              refId: expense.id,
              period,
              recurring: expense.frequency !== 'una_tantum',
            })
          }
        }
      })()
    )
  }

  if (sources.lifeCalendar) {
    jobs.push(
      (async () => {
        const { data } = await supabase
          .from('life_calendar_items')
          .select('id, title, due_date, recurrence, reminder_offsets, notes')
          .eq('user_id', userId)
          .eq('status', 'active')
          .lte('due_date', addDays(to, 400))
        for (const item of data ?? []) {
          const date = item.due_date as string
          const inRange = date >= from && date <= to
          const overdue = date < from
          const reminderDays = Math.max(7, ...((item.reminder_offsets as number[] | null) ?? []))
          const remindNow = options.useReminders && date > to && daysBetween(today, date) <= reminderDays
          if (!inRange && !overdue && !remindNow) continue
          events.push({ key: `deadline:${item.id}`, kind: 'deadline', date, time: null, title: item.title, amount: null, done: false, refId: item.id, note: item.notes, recurring: item.recurrence !== 'none' })
        }
      })()
    )
  }

  await Promise.all(jobs)
  return sortAgenda(events)
}
