import { NextResponse } from 'next/server'
import { emailCustomerReminder, loadBusiness, tempusDb } from '@/lib/tempus-server'

// KUMANI TEMPUS: promemoria via email ai clienti che hanno un appuntamento
// nelle prossime 6–30 ore (Vercel Cron ogni giorno alle 16 UTC, cioè la sera
// prima in Italia). Ogni prenotazione riceve un solo promemoria.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const db = tempusDb()
  const now = Date.now()
  const { data: bookings, error } = await db
    .from('tempus_bookings')
    .select('id, owner_id, service_name, price_cents, starts_at, customer_name, customer_phone, customer_email, customer_note, cancel_token, locale')
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .not('customer_email', 'is', null)
    .gte('starts_at', new Date(now + 6 * 3_600_000).toISOString())
    .lt('starts_at', new Date(now + 30 * 3_600_000).toISOString())
    .limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const owners = new Map<string, Awaited<ReturnType<typeof ownerInfo>>>()
  async function ownerInfo(ownerId: string) {
    const [{ data: page }, business] = await Promise.all([
      db.from('tempus_pages').select('title, slug, timezone, show_prices, cancel_limit_hours, suspended').eq('owner_id', ownerId).maybeSingle(),
      loadBusiness(ownerId),
    ])
    if (!page || page.suspended) return null
    return {
      displayName: page.title || business.name || page.slug,
      timezone: page.timezone,
      address: business.address,
      phone: business.phone || business.whatsapp,
      showPrices: page.show_prices,
      cancelLimitHours: page.cancel_limit_hours,
    }
  }

  let sent = 0
  for (const b of bookings ?? []) {
    if (!owners.has(b.owner_id)) owners.set(b.owner_id, await ownerInfo(b.owner_id))
    const biz = owners.get(b.owner_id)
    if (!biz) continue
    // Segnato prima dell'invio: con due esecuzioni insieme parte una volta sola
    const { data: claimed } = await db.from('tempus_bookings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', b.id).is('reminder_sent_at', null).select('id')
    if (!claimed?.length) continue
    if (await emailCustomerReminder(b, biz)) sent++
  }
  return NextResponse.json({ checked: bookings?.length ?? 0, sent })
}
