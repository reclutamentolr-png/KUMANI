import { NextResponse } from 'next/server'
import { localizedPath, notifyUser, pushConfigured, pushDb } from '@/lib/push'

// Promemoria giornalieri con le notifiche push (Vercel Cron, vedi vercel.json):
// - abbonamento senza rinnovo automatico (voucher, Staff) che scade entro 3 giorni;
// - eventi a cui si è iscritti che iniziano entro 36 ore.
// Ogni promemoria parte una volta sola (push_log). Solo per chi ha attivato
// le notifiche su almeno un dispositivo.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DAY = 86_400_000

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!pushConfigured()) return NextResponse.json({ skipped: 'not_configured' })

  const db = pushDb()
  const { data: subs } = await db.from('push_subscriptions').select('user_id')
  const userIds = [...new Set((subs ?? []).map((s) => s.user_id as string))]
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
      .neq('subscription_source', 'stripe')
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

  return NextResponse.json({ expiry, events })
}
