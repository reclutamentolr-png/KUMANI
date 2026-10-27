import { localizedPath, notifyUser, type pushDb } from '@/lib/push'
import { fixedExpenseDueDate, type SpendlyFixedExpense } from '@/lib/spendly'
import { settleAutoPayments } from '@/lib/spendly-server'
import { addDays, dateKeyOf, DEFAULT_REMIND_TIME, romeToInstant, timeOf, todayKey } from '@/lib/agenda'

// Avvisi di scadenze e agenda (giro ogni 5 minuti, /api/cron/agenda-reminders):
// - all'ora degli avvisi di ognuno (profilo; di base le 9): scadenze di Life
//   Calendar (anche Casa, ricevute, documenti di viaggio), di Garage, bollette
//   di Spendly e promemoria di MemoLife senza ora;
// - all'ora giusta: appuntamenti (con l'anticipo scelto) e promemoria con l'ora.
// Ogni avviso parte una volta sola (push_log): due giri vicini non lo ripetono.

type Db = ReturnType<typeof pushDb>

const DAY = 86_400_000
// Un avviso parte se la sua ora è caduta negli ultimi 10 minuti (il giro è
// ogni 5: se uno salta, lo prende il successivo)
export const REMIND_WINDOW_MS = 10 * 60_000

// L'ora 'HH:MM' di oggi (Roma) è caduta negli ultimi 10 minuti?
export function timeIsDue(time: string, now: number) {
  const at = new Date(romeToInstant(todayKey(new Date(now)), time)).getTime()
  return at <= now && at > now - REMIND_WINDOW_MS
}

// Chi deve ricevere adesso gli avvisi «del giorno»: chi ha scelto un'ora
// appena passata e, se è appena passata l'ora di base, chi non ne ha scelta una
export async function usersDueNow(db: Db, now: number): Promise<string[]> {
  const { data: prefs } = await db.from('push_preferences').select('user_id, remind_time').not('remind_time', 'is', null)
  const custom = new Map((prefs ?? []).map((p) => [p.user_id as string, p.remind_time as string]))
  const due = [...custom].filter(([, time]) => time !== DEFAULT_REMIND_TIME && timeIsDue(time, now)).map(([id]) => id)
  if (timeIsDue(DEFAULT_REMIND_TIME, now)) {
    for (let from = 0; ; from += 1000) {
      const { data: page } = await db.from('profiles').select('id').order('id').range(from, from + 999)
      for (const p of page ?? []) {
        const time = custom.get(p.id as string)
        if (!time || time === DEFAULT_REMIND_TIME) due.push(p.id as string)
      }
      if (!page || page.length < 1000) break
    }
  }
  return due
}

// Scadenze e promemoria senza ora: per chi è appena arrivato alla sua ora
export async function dailyReminders(db: Db, userIds: string[], now: number) {
  const today = todayKey(new Date(now))
  const dayKey = (offset: number) => addDays(today, offset)
  let garage = 0
  let lifeCalendar = 0
  let bills = 0
  let tasks = 0

  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)

    // Kumani Garage: scadenze dell'auto a 30, 7 e 1 giorno e il giorno stesso;
    // noleggio senza km aggiornati da più di 30 giorni (una volta al mese)
    const remindDays = [0, 1, 7, 30]
    const { data: due } = await db
      .from('garage_deadlines')
      .select('id, user_id, vehicle_id, kind, title, due_date, garage_vehicles(name)')
      .in('user_id', chunk)
      .in('due_date', remindDays.map(dayKey))
    for (const row of due ?? []) {
      const days = remindDays.find((d) => dayKey(d) === row.due_date) ?? 0
      const vehicle = (Array.isArray(row.garage_vehicles) ? row.garage_vehicles[0] : row.garage_vehicles) as { name: string } | null
      await notifyUser(
        row.user_id as string,
        'expiry',
        (t, locale) => ({
          title: t('garageDeadlineTitle', { car: vehicle?.name ?? '' }),
          body: t(days === 0 ? 'garageDeadlineToday' : 'garageDeadlineBody', {
            what: (row.title as string | null) || t(`garageKind_${row.kind}`),
            days,
            date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${row.due_date}T12:00:00Z`)),
          }),
          url: localizedPath(locale, `/app/garage/${row.vehicle_id}`),
          tag: `garage-${row.id}`,
        }),
        { kind: 'garage_deadline', ref: `${row.id}:${row.due_date}:${days}` }
      )
      garage++
    }

    const { data: rentals } = await db
      .from('garage_vehicles')
      .select('id, user_id, name, rental_start, rental_months, created_at')
      .in('user_id', chunk)
      .eq('kind', 'rental')
      .lte('rental_start', dayKey(-30))
    if (rentals?.length) {
      const { data: lastReadings } = await db
        .from('garage_readings')
        .select('vehicle_id, read_on')
        .in('vehicle_id', rentals.map((r) => r.id as string))
        .order('read_on', { ascending: false })
      const lastRead = new Map<string, string>()
      for (const r of lastReadings ?? []) if (!lastRead.has(r.vehicle_id as string)) lastRead.set(r.vehicle_id as string, r.read_on as string)
      for (const rental of rentals) {
        // Contratto ancora in corso e ultima rilevazione (o ritiro) oltre 30 giorni fa
        const start = rental.rental_start as string
        const endDate = new Date(`${start}T12:00:00Z`)
        endDate.setUTCMonth(endDate.getUTCMonth() + (rental.rental_months as number))
        if (endDate.toISOString().slice(0, 10) < today) continue
        const last = lastRead.get(rental.id as string) ?? start
        if (last > dayKey(-30)) continue
        await notifyUser(
          rental.user_id as string,
          'expiry',
          (t, locale) => ({
            title: t('garageKmTitle', { car: rental.name as string }),
            body: t('garageKmBody'),
            url: localizedPath(locale, `/app/garage/${rental.id}`),
            tag: `garage-km-${rental.id}`,
          }),
          { kind: 'garage_km', ref: `${rental.id}:${today.slice(0, 7)}` }
        )
        garage++
      }
    }

    // Life Calendar (anche le scadenze di KUMANI Casa, delle ricevute e dei
    // documenti di viaggio): nei giorni di anticipo scelti per la voce e il
    // giorno stesso
    const { data: items } = await db
      .from('life_calendar_items')
      .select('id, user_id, title, due_date, reminder_offsets, casa_home_id')
      .in('user_id', chunk)
      .eq('status', 'active')
      .gte('due_date', today)
      .lte('due_date', dayKey(400))
    for (const item of items ?? []) {
      const days = Math.round((Date.parse(`${item.due_date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / DAY)
      const offsets = (item.reminder_offsets as number[] | null) ?? []
      if (days !== 0 && !offsets.includes(days)) continue
      const homeId = item.casa_home_id as string | null
      await notifyUser(
        item.user_id as string,
        'expiry',
        (t, locale) => ({
          title: t(homeId ? 'casaDeadlineTitle' : 'lifeDeadlineTitle'),
          body: t(days === 0 ? 'lifeDeadlineToday' : 'lifeDeadlineBody', {
            what: item.title as string,
            days,
            date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${item.due_date}T12:00:00Z`)),
          }),
          url: localizedPath(locale, homeId ? `/app/casa/${homeId}` : '/app/life-calendar'),
          tag: `life-${item.id}`,
        }),
        { kind: 'life_deadline', ref: `${item.id}:${item.due_date}:${days}` }
      )
      lifeCalendar++
    }

    // Spendly: bollette non ancora segnate pagate, 3 giorni prima, il giorno
    // prima e il giorno stesso
    const billDays = [0, 1, 3]
    const months = [today.slice(0, 7), dayKey(3).slice(0, 7)].filter((m, idx, all) => all.indexOf(m) === idx)
    // Addebito automatico: le bollette già addebitate oggi non vanno ricordate
    await settleAutoPayments(db, chunk)
    const { data: expenses } = await db
      .from('spendly_fixed_expenses')
      .select('id, user_id, description, amount, frequency, category, start_date, end_date, billing_day, notes')
      .in('user_id', chunk)
      .eq('category', 'bollette')
      .lte('start_date', dayKey(3))
    if (expenses?.length) {
      const { data: payments } = await db
        .from('spendly_fixed_payments')
        .select('expense_id, period')
        .in('expense_id', expenses.map((e) => e.id as string))
        .in('period', months.map((m) => `${m}-01`))
      const paid = new Set((payments ?? []).map((p) => `${p.expense_id}:${p.period}`))
      for (const expense of expenses) {
        for (const month of months) {
          const dueDate = fixedExpenseDueDate({ ...(expense as SpendlyFixedExpense), amount: Number(expense.amount) }, Number(month.slice(0, 4)), Number(month.slice(5, 7)))
          const days = billDays.find((d) => dayKey(d) === dueDate)
          if (!dueDate || days === undefined || paid.has(`${expense.id}:${month}-01`)) continue
          await notifyUser(
            expense.user_id as string,
            'expiry',
            (t, locale) => ({
              title: t('billTitle'),
              body: t(days === 0 ? 'billToday' : 'billBody', {
                what: expense.description as string,
                amount: new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(Number(expense.amount)),
                days,
              }),
              url: localizedPath(locale, '/app/spendly/bollette'),
              tag: `bill-${expense.id}`,
            }),
            { kind: 'spendly_bill', ref: `${expense.id}:${dueDate}:${days}` }
          )
          bills++
        }
      }
    }

    // MemoLife: promemoria senza ora, il giorno stesso o il giorno prima
    const { data: todo } = await db
      .from('tasks')
      .select('id, user_id, title, due_date, remind_days')
      .in('user_id', chunk)
      .is('remind_time', null)
      .or('completed.is.null,completed.eq.false')
      .in('due_date', [today, dayKey(1)])
    for (const task of todo ?? []) {
      const days = task.due_date === today ? 0 : 1
      if (!((task.remind_days as number[] | null) ?? [0]).includes(days)) continue
      await notifyTask(task.user_id as string, task.id as string, task.title as string, task.due_date as string, days, null)
      tasks++
    }
  }
  return { garage, lifeCalendar, bills, tasks }
}

async function notifyTask(userId: string, id: string, title: string, dueDate: string, days: number, time: string | null) {
  await notifyUser(
    userId,
    'expiry',
    (t, locale) => ({
      title: t('taskTitle'),
      body: t(days === 0 ? (time ? 'taskTodayAt' : 'taskToday') : time ? 'taskTomorrowAt' : 'taskTomorrow', { what: title, time: time ?? '' }),
      url: localizedPath(locale, '/app/memolife'),
      tag: `task-${id}`,
    }),
    { kind: 'task', ref: `${id}:${dueDate}:${time ?? ''}:${days}` }
  )
}

// Appuntamenti con l'anticipo scelto e promemoria con l'ora: a quell'ora
export async function timedReminders(db: Db, now: number) {
  let appointments = 0
  let tasks = 0

  // Appuntamenti nelle prossime 24 ore (l'anticipo più lungo è il giorno prima)
  const { data: soon } = await db
    .from('appointments')
    .select('id, user_id, title, date_time, remind_minutes')
    .gt('date_time', new Date(now).toISOString())
    .lte('date_time', new Date(now + DAY + REMIND_WINDOW_MS).toISOString())
    .limit(5000)
  for (const a of soon ?? []) {
    const at = new Date(a.date_time as string)
    for (const minutes of (a.remind_minutes as number[] | null) ?? []) {
      const remindAt = at.getTime() - minutes * 60_000
      if (remindAt > now || remindAt <= now - REMIND_WINDOW_MS) continue
      const time = timeOf(at)
      const sameDay = dateKeyOf(at) === todayKey(new Date(now))
      await notifyUser(
        a.user_id as string,
        'expiry',
        (t, locale) => ({
          title: t('appointmentTitle', { what: a.title as string }),
          body: t(sameDay ? 'appointmentToday' : 'appointmentTomorrow', { time }),
          url: localizedPath(locale, '/app/memolife'),
          tag: `appointment-${a.id}`,
        }),
        { kind: 'appointment', ref: `${a.id}:${a.date_time}:${minutes}` }
      )
      appointments++
    }
  }

  // Promemoria con l'ora: il giorno stesso o il giorno prima a quell'ora
  const today = todayKey(new Date(now))
  const { data: todo } = await db
    .from('tasks')
    .select('id, user_id, title, due_date, remind_time, remind_days')
    .not('remind_time', 'is', null)
    .or('completed.is.null,completed.eq.false')
    .in('due_date', [today, addDays(today, 1)])
    .limit(5000)
  for (const task of todo ?? []) {
    const time = task.remind_time as string
    for (const days of (task.remind_days as number[] | null) ?? [0]) {
      const remindAt = new Date(romeToInstant(addDays(task.due_date as string, -days), time)).getTime()
      if (remindAt > now || remindAt <= now - REMIND_WINDOW_MS) continue
      await notifyTask(task.user_id as string, task.id as string, task.title as string, task.due_date as string, days, time)
      tasks++
    }
  }
  return { appointments, tasks }
}
