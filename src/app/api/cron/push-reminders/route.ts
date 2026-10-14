import { NextResponse } from 'next/server'
import { localizedPath, notifyUser, pushDb } from '@/lib/push'
import { fixedExpenseDueDate, type SpendlyFixedExpense } from '@/lib/spendly'
import { settleAutoPayments } from '@/lib/spendly-server'

// Promemoria giornalieri con le notifiche push (Vercel Cron, vedi vercel.json):
// - abbonamento senza rinnovo automatico (voucher, Staff) che scade entro 3 giorni;
// - eventi a cui si è iscritti che iniziano entro 36 ore;
// - FinCheck: invito a rifare il test 3 mesi dopo l'ultimo;
// - scadenze di Garage e di Life Calendar (anche KUMANI Casa);
// - bollette di Spendly non pagate (3 giorni prima e il giorno stesso).
// - Clienti e Lavori: quanti clienti sentire oggi e quanti lavori consegnati
//   aspettano il saldo (una volta al giorno, solo con il servizio nel piano).
// Ogni promemoria parte una volta sola (push_log). Per tutti nel Centro
// avvisi; sul telefono per chi ha attivato le notifiche.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DAY = 86_400_000

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  // Tutti gli iscritti: i promemoria restano nel Centro avvisi dell'app e
  // arrivano anche sul telefono a chi ha attivato le notifiche
  const db = pushDb()
  const userIds: string[] = []
  for (let from = 0; ; from += 1000) {
    const { data: page } = await db.from('profiles').select('id').order('id').range(from, from + 999)
    userIds.push(...(page ?? []).map((p) => p.id as string))
    if (!page || page.length < 1000) break
  }
  if (!userIds.length) return NextResponse.json({ expiry: 0, events: 0 })

  const now = Date.now()
  let expiry = 0
  let events = 0

  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)

    // Scadenze (gli abbonamenti con carta si rinnovano da soli)
    const { data: expiring } = await db
      .from('profiles')
      .select('id, subscription_expires_at, subscription_source')
      .in('id', chunk)
      .eq('subscription_status', 'active')
      .or('subscription_source.is.null,subscription_source.neq.stripe')
      .gt('subscription_expires_at', new Date(now).toISOString())
      .lte('subscription_expires_at', new Date(now + 3 * DAY).toISOString())
    for (const p of expiring ?? []) {
      const expiresAt = new Date(p.subscription_expires_at as string)
      await notifyUser(
        p.id as string,
        'expiry',
        (t, locale) => ({
          title: t('expiryTitle'),
          body: t('expiryBody', { date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: 'Europe/Rome' }).format(expiresAt) }),
          url: '/billing',
          tag: 'expiry',
        }),
        { kind: 'expiry', ref: expiresAt.toISOString().slice(0, 10) }
      )
      expiry++
    }

    // Eventi in arrivo
    const { data: participations } = await db
      .from('event_participants')
      .select('user_id, event_id, events!inner(id, title, starts_at, status)')
      .in('user_id', chunk)
      .eq('status', 'registered')
      .eq('events.status', 'published')
      .gt('events.starts_at', new Date(now).toISOString())
      .lte('events.starts_at', new Date(now + 1.5 * DAY).toISOString())
    for (const row of participations ?? []) {
      const event = (Array.isArray(row.events) ? row.events[0] : row.events) as { id: string; title: string; starts_at: string } | undefined
      if (!event) continue
      const startsAt = new Date(event.starts_at)
      await notifyUser(
        row.user_id as string,
        'events',
        (t, locale) => ({
          title: t('eventTitle'),
          body: t('eventBody', {
            title: event.title,
            date: new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(startsAt),
          }),
          url: localizedPath(locale, `/events/${event.id}`),
          tag: `event-${event.id}`,
        }),
        { kind: 'event', ref: event.id }
      )
      events++
    }
  }

  // FinCheck: 3 mesi dopo l'ultimo test, invito a rifarlo (una volta per test)
  let fincheck = 0
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
    const { data: tests } = await db
      .from('fincheck_results')
      .select('id, user_id, created_at')
      .in('user_id', chunk)
      .order('created_at', { ascending: false })
    const latest = new Map<string, { id: string; created_at: string }>()
    for (const row of tests ?? []) if (!latest.has(row.user_id as string)) latest.set(row.user_id as string, row as { id: string; created_at: string })
    for (const [userId, row] of latest) {
      if (now - new Date(row.created_at).getTime() < 90 * DAY) continue
      await notifyUser(
        userId,
        'expiry',
        (t, locale) => ({ title: t('fincheckTitle'), body: t('fincheckBody'), url: localizedPath(locale, '/marketplace/fincheck'), tag: 'fincheck' }),
        { kind: 'fincheck', ref: row.id }
      )
      fincheck++
    }
  }

  // Kumani Garage: scadenze dell'auto a 30, 7 e 1 giorno e il giorno stesso;
  // noleggio senza km aggiornati da più di 30 giorni (una volta al mese)
  let garage = 0
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date(now))
  const dayKey = (offset: number) => new Date(new Date(`${today}T12:00:00Z`).getTime() + offset * DAY).toISOString().slice(0, 10)
  const remindDays = [0, 1, 7, 30]
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
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
          url: localizedPath(locale, `/marketplace/garage/${row.vehicle_id}`),
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
    if (!rentals?.length) continue
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
          url: localizedPath(locale, `/marketplace/garage/${rental.id}`),
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
  let lifeCalendar = 0
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
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
          url: localizedPath(locale, homeId ? `/marketplace/casa/${homeId}` : '/marketplace/life-calendar'),
          tag: `life-${item.id}`,
        }),
        { kind: 'life_deadline', ref: `${item.id}:${item.due_date}:${days}` }
      )
      lifeCalendar++
    }
  }

  // Spendly: bollette non ancora segnate pagate, 3 giorni prima e il giorno stesso
  let bills = 0
  const billDays = [0, 3]
  const months = [today.slice(0, 7), dayKey(3).slice(0, 7)].filter((m, idx, all) => all.indexOf(m) === idx)
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200)
    // Addebito automatico: le bollette già addebitate oggi non vanno ricordate
    await settleAutoPayments(db, chunk)
    const { data: expenses } = await db
      .from('spendly_fixed_expenses')
      .select('id, user_id, description, amount, frequency, category, start_date, end_date, billing_day, notes')
      .in('user_id', chunk)
      .eq('category', 'bollette')
      .lte('start_date', dayKey(3))
    if (!expenses?.length) continue
    const { data: payments } = await db
      .from('spendly_fixed_payments')
      .select('expense_id, period')
      .in('expense_id', expenses.map((e) => e.id as string))
      .in('period', months.map((m) => `${m}-01`))
    const paid = new Set((payments ?? []).map((p) => `${p.expense_id}:${p.period}`))
    for (const expense of expenses) {
      for (const month of months) {
        const due = fixedExpenseDueDate({ ...(expense as SpendlyFixedExpense), amount: Number(expense.amount) }, Number(month.slice(0, 4)), Number(month.slice(5, 7)))
        const days = billDays.find((d) => dayKey(d) === due)
        if (!due || days === undefined || paid.has(`${expense.id}:${month}-01`)) continue
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
            url: localizedPath(locale, '/marketplace/spendly/bollette'),
            tag: `bill-${expense.id}`,
          }),
          { kind: 'spendly_bill', ref: `${expense.id}:${due}:${days}` }
        )
        bills++
      }
    }
  }

  // Clienti e Lavori: riepilogo del mattino
  let clienti = 0
  const summary = new Map<string, { steps: number; collect: number }>()
  const bump = (userId: string, key: 'steps' | 'collect') => {
    const row = summary.get(userId) ?? { steps: 0, collect: 0 }
    row[key]++
    summary.set(userId, row)
  }
  for (let from = 0; ; from += 1000) {
    const { data: steps } = await db.from('quote_clients').select('id, user_id').not('next_step', 'is', null).lte('next_step_due', today).order('id').range(from, from + 999)
    for (const row of steps ?? []) bump(row.user_id as string, 'steps')
    if (!steps || steps.length < 1000) break
  }
  // Lavori consegnati con un saldo ancora aperto (prezzo − pagamenti, come in «Oggi»)
  for (let from = 0; ; from += 1000) {
    const { data: done } = await db.from('client_jobs').select('id, user_id, amount, quote_id').eq('stage', 'done').order('id').range(from, from + 999)
    // A blocchi di 100: indirizzi delle richieste corti e risposte complete
    for (let k = 0; k < (done?.length ?? 0); k += 100) {
      const part = done!.slice(k, k + 100)
      const jobIds = part.map((j) => j.id as string)
      const quoteIds = part.map((j) => j.quote_id as string | null).filter((id): id is string => !!id)
      const [{ data: pays }, { data: quotes }] = await Promise.all([
        db.from('client_payments').select('job_id, amount').in('job_id', jobIds).limit(5000),
        quoteIds.length ? db.from('quotes').select('id, total, vat_mode, vat_rate, payment_status, paid_amount').in('id', quoteIds) : Promise.resolve({ data: [] }),
      ])
      for (const job of part) {
        const quote = (quotes ?? []).find((q) => q.id === job.quote_id)
        // Come in «Oggi»: un preventivo rimborsato non dà un prezzo
        const gross = quote && quote.payment_status !== 'refunded' ? Number(quote.total) * (quote.vat_mode === 'plus' && Number(quote.vat_rate) > 0 ? 1 + Number(quote.vat_rate) / 100 : 1) : null
        const price = job.amount !== null ? Number(job.amount) : gross
        if (price === null) continue
        const paid = (pays ?? []).filter((p) => p.job_id === job.id).reduce((sum, p) => sum + Number(p.amount), 0) + (quote?.payment_status === 'paid' ? Number(quote.paid_amount) : 0)
        if (price - paid > 0.009) bump(job.user_id as string, 'collect')
      }
    }
    if (!done || done.length < 1000) break
  }
  for (const [userId, counts] of summary) {
    const { data: access } = await db.rpc('tool_access', { p_user_id: userId, p_tool: 'clienti' }).maybeSingle<{ allowed: boolean }>()
    if (!access?.allowed) continue
    await notifyUser(
      userId,
      'expiry',
      (t, locale) => ({
        title: t('clientiTitle'),
        body: [counts.steps ? t('clientiSteps', { count: counts.steps }) : null, counts.collect ? t('clientiCollect', { count: counts.collect }) : null].filter(Boolean).join(' · '),
        url: localizedPath(locale, '/marketplace/clienti'),
        tag: 'clienti-today',
      }),
      { kind: 'clienti_today', ref: today }
    )
    clienti++
  }

  return NextResponse.json({ expiry, events, fincheck, garage, lifeCalendar, bills, clienti })
}
