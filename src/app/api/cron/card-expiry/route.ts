import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push'
import { fullAdminIds } from '@/lib/staffAlerts'
import { dayLabel, expiringCards, expiryLabel, upcomingCharges, upcomingRenewals } from '@/lib/cardExpiry'

// Carte dei costi fissi in scadenza (Vercel Cron, vedi vercel.json): agli admin
// una notifica dal mese prima della scadenza e una seconda nel mese di
// scadenza, se la carta non è ancora stata aggiornata in Costi e margini.
// Lo stesso un mese prima dei rinnovi annuali (dominio…). E una settimana
// prima di ogni addebito sulle carte, per controllare la disponibilità.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: costs } = await db.from('platform_costs').select('name, provider, payment_card, card_expiry, status, end_date, frequency, start_date, amount_cents')
  const day = new Date().toISOString().slice(0, 10)
  const cards = expiringCards(costs ?? [], day)
  const renewals = upcomingRenewals(costs ?? [], day)
  const charges = upcomingCharges(costs ?? [], day)
  if (!cards.length && !renewals.length && !charges.length) return NextResponse.json({ ok: true, cards: 0, renewals: 0, charges: 0 })

  const admins = await fullAdminIds()
  for (const c of cards) {
    const ref = `${c.card.toLowerCase()}|${c.expiry}|${c.lastMonth ? 'last' : 'first'}`
    for (const adminId of admins) {
      await notifyUser(
        adminId,
        'staff',
        (t) => ({
          title: t('cardExpiryTitle'),
          body: t('cardExpiryBody', { card: c.card, expiry: expiryLabel(c.expiry), services: c.services.join(', ') }),
          url: '/admin?section=costs',
          tag: `card-expiry-${c.card.toLowerCase()}`,
        }),
        { kind: 'card_expiry', ref }
      )
    }
  }
  for (const r of renewals) {
    for (const adminId of admins) {
      await notifyUser(
        adminId,
        'staff',
        (t) => ({ title: t('renewalTitle'), body: t('renewalBody', { name: r.name, date: dayLabel(r.date) }), url: '/admin?section=costs', tag: `renewal-${r.date}` }),
        { kind: 'cost_renewal', ref: `${r.name}|${r.date}` }
      )
    }
  }
  const eur = (cents: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100)
  for (const c of charges) {
    for (const adminId of admins) {
      await notifyUser(
        adminId,
        'staff',
        (t) => ({
          title: t('chargeTitle'),
          body: t('chargeBody', { date: dayLabel(c.date), total: eur(c.total_cents), card: c.card, services: c.items.map((i) => `${i.name} ${eur(i.amount_cents)}`).join(', ') }),
          url: '/admin?section=costs',
          tag: `charge-${c.card.toLowerCase()}-${c.date}`,
        }),
        { kind: 'card_charge', ref: `${c.card.toLowerCase()}|${c.date}` }
      )
    }
  }
  return NextResponse.json({ ok: true, cards: cards.length, renewals: renewals.length, charges: charges.length })
}
