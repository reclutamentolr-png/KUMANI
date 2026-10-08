import type { SupabaseClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
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
          .select('id, title, due_date, recurrence, reminder_offsets, notes, casa_home_id')
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
          events.push({
            key: `deadline:${item.id}`,
            kind: 'deadline',
            date,
            time: null,
            title: item.title,
            amount: null,
            done: false,
            refId: item.id,
            note: item.notes,
            recurring: item.recurrence !== 'none',
            casaHomeId: (item.casa_home_id as string | null) ?? undefined,
          })
        }
      })()
    )
  }

  // Kumani Garage: bollo, assicurazione, revisione… delle proprie auto (le
  // RLS mostrano solo le proprie; nessuna riga per chi non usa Garage).
  // Compaiono da 30 giorni prima, come un promemoria.
  jobs.push(
    (async () => {
      const { data } = await supabase
        .from('garage_deadlines')
        .select('id, vehicle_id, kind, title, due_date, amount, recurrence, garage_vehicles(name)')
        .eq('user_id', userId)
        .gte('due_date', overdueSince)
        .lte('due_date', addDays(to, 30))
      if (!data?.length) return
      const t = await getTranslations('garage')
      for (const item of data) {
        const date = item.due_date as string
        const inRange = date >= from && date <= to
        const overdue = date < from
        const remindNow = options.useReminders && date > to && daysBetween(today, date) <= 30
        if (!inRange && !overdue && !remindNow) continue
        const vehicle = (Array.isArray(item.garage_vehicles) ? item.garage_vehicles[0] : item.garage_vehicles) as { name: string } | null
        const label = (item.title as string | null) || t(`deadline_${item.kind}`)
        events.push({
          key: `garage:${item.id}`,
          kind: 'deadline',
          date,
          time: null,
          title: vehicle ? `${label} · ${vehicle.name}` : label,
          amount: item.amount !== null ? Number(item.amount) : null,
          done: false,
          refId: item.id as string,
          recurring: item.recurrence !== 'none',
          garageVehicleId: item.vehicle_id as string,
        })
      }
    })()
  )

  // KUMANI Travel: partenza e rientro dei viaggi di cui si fa parte (anche
  // senza abbonamento: le RLS mostrano solo i viaggi dei membri).
  jobs.push(
    (async () => {
      const { data } = await supabase
        .from('trips')
        .select('id, title, starts_on, ends_on, cover_emoji')
        .not('starts_on', 'is', null)
        .lte('starts_on', to)
        .gte('ends_on', from)
      for (const trip of data ?? []) {
        const title = `${trip.cover_emoji} ${trip.title}`
        const start = trip.starts_on as string
        const end = (trip.ends_on as string | null) ?? start
        if (start >= from && start <= to) {
          events.push({ key: `trip:${trip.id}:start`, kind: 'trip', date: start, time: null, title, amount: null, done: false, refId: trip.id, tripEdge: 'start' })
        }
        if (end !== start && end >= from && end <= to) {
          events.push({ key: `trip:${trip.id}:end`, kind: 'trip', date: end, time: null, title, amount: null, done: false, refId: trip.id, tripEdge: 'end' })
        }
      }
    })()
  )

  // KUMANI Events: eventi a cui sono iscritto e quelli che organizzo
  // (orari mostrati in ora italiana, come il resto dell'agenda).
  const eventFrom = `${addDays(from, -1)}T00:00:00Z`
  const eventTo = `${addDays(to, 1)}T23:59:59Z`
  const pushEvent = (e: { id: string; title: string; starts_at: string; type: string }, organizing: boolean) => {
    const instant = new Date(e.starts_at)
    const date = dateKeyOf(instant)
    if (date < from || date > to) return
    if (events.some((existing) => existing.key === `event:${e.id}`)) return
    events.push({ key: `event:${e.id}`, kind: 'event', date, time: timeOf(instant), title: e.title, amount: null, done: false, refId: e.id, organizing })
  }
  jobs.push(
    (async () => {
      const [{ data: registrations }, { data: organized }] = await Promise.all([
        supabase
          .from('event_participants')
          .select('status, events(id, title, starts_at, type, status)')
          .eq('user_id', userId)
          .in('status', ['registered', 'checked_in']),
        supabase
          .from('events')
          .select('id, title, starts_at, type, status')
          .eq('organizer_id', userId)
          .in('status', ['published', 'pending'])
          .gte('starts_at', eventFrom)
          .lte('starts_at', eventTo),
      ])
      for (const e of organized ?? []) pushEvent(e, true)
      for (const row of registrations ?? []) {
        const e = (Array.isArray(row.events) ? row.events[0] : row.events) as { id: string; title: string; starts_at: string; type: string; status: string } | null
        if (e && e.status === 'published') pushEvent(e, false)
      }
    })()
  )

  await Promise.all(jobs)
  return sortAgenda(events)
}
