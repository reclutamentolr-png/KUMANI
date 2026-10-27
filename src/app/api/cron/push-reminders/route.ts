import { NextResponse } from 'next/server'
import { localizedPath, notifyUser, pushDb } from '@/lib/push'
import { OCCASION_EMOJI, type ConviviumOccasion } from '@/lib/convivium'

// Promemoria giornalieri con le notifiche push (Vercel Cron, vedi vercel.json):
// - abbonamento senza rinnovo automatico (voucher, Staff) che scade entro 3 giorni;
// - eventi a cui si è iscritti che iniziano entro 36 ore;
// - FinCheck: invito a rifare il test 3 mesi dopo l'ultimo;
// (scadenze di Garage e Life Calendar, bollette di Spendly e agenda di
// MemoLife: all'ora scelta da ognuno, in /api/cron/agenda-reminders)
// - Clienti e Lavori: quanti clienti sentire oggi e quanti lavori consegnati
//   aspettano il saldo (una volta al giorno, solo con il servizio nel piano).
// - Convivium: le serate di domani, a chi organizza e agli invitati iscritti.
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
  // Prova della sola parte Convivium: ?only=convivium
  if (new URL(request.url).searchParams.get('only') === 'convivium') {
    return NextResponse.json({ convivium: await conviviumReminders(db, Date.now()) })
  }
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
        (t, locale) => ({ title: t('fincheckTitle'), body: t('fincheckBody'), url: localizedPath(locale, '/app/fincheck'), tag: 'fincheck' }),
        { kind: 'fincheck', ref: row.id }
      )
      fincheck++
    }
  }

  // Clienti e Lavori: riepilogo del mattino
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date(now))
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
        url: localizedPath(locale, '/app/clienti'),
        tag: 'clienti-today',
      }),
      { kind: 'clienti_today', ref: today }
    )
    clienti++
  }

  const convivium = await conviviumReminders(db, now)

  return NextResponse.json({ expiry, events, fincheck, clienti, convivium })
}

// Convivium: serate nelle prossime 40 ore (cioè domani, col giro delle 10),
// a chi organizza e agli invitati iscritti che hanno detto «Ci sto» o «Forse»
async function conviviumReminders(db: ReturnType<typeof pushDb>, now: number): Promise<number> {
  let sent = 0
  const { data: evenings } = await db
    .from('convivium_events')
    .select('id, owner_id, title, occasion, starts_at, place, invite_code')
    .is('cancelled_at', null)
    .is('reminder_sent_at', null)
    .gt('starts_at', new Date(now).toISOString())
    .lte('starts_at', new Date(now + 40 * 3_600_000).toISOString())
    .limit(500)
  for (const evening of evenings ?? []) {
    // Prima si segna come inviato: un altro giro non lo rimanda
    const { data: claimed } = await db.from('convivium_events').update({ reminder_sent_at: new Date().toISOString() }).eq('id', evening.id).is('reminder_sent_at', null).select('id')
    if (!claimed?.length) continue
    const { data: guests } = await db.from('convivium_rsvps').select('user_id').eq('event_id', evening.id).in('answer', ['yes', 'maybe']).not('user_id', 'is', null)
    const startsAt = new Date(evening.starts_at as string)
    const emoji = OCCASION_EMOJI[evening.occasion as ConviviumOccasion] ?? '🥂'
    const recipients = [...new Set([evening.owner_id as string, ...(guests ?? []).map((g) => g.user_id as string)])]
    for (const userId of recipients) {
      const isOwner = userId === evening.owner_id
      await notifyUser(
        userId,
        'events',
        (t, locale) => {
          const when = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(startsAt)
          return {
            title: t('conviviumRemindTitle', { emoji, title: evening.title as string }),
            body: evening.place ? t('conviviumRemindBodyPlace', { when, place: evening.place as string }) : t('conviviumRemindBody', { when }),
            url: localizedPath(locale, isOwner ? `/convivium/${evening.id}` : `/convivium/invito/${evening.invite_code}`),
            tag: `convivium-${evening.id}`,
          }
        },
        { kind: 'convivium', ref: evening.id as string }
      )
      sent++
    }
  }
  return sent
}
