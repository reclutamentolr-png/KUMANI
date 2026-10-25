import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notifyUser } from '@/lib/push'
import { expiringCards, expiryLabel } from '@/lib/cardExpiry'

// Carte dei costi fissi in scadenza (Vercel Cron, vedi vercel.json): agli admin
// una notifica dal mese prima della scadenza e una seconda nel mese di
// scadenza, se la carta non è ancora stata aggiornata in Costi e margini.

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
  const { data: costs } = await db.from('platform_costs').select('name, provider, payment_card, card_expiry, status, end_date').not('card_expiry', 'is', null)
  const cards = expiringCards(costs ?? [], new Date().toISOString().slice(0, 10))
  if (!cards.length) return NextResponse.json({ ok: true, cards: 0 })

  const { data: admins } = await db.from('profiles').select('id').eq('is_admin', true)
  for (const c of cards) {
    const ref = `${c.card.toLowerCase()}|${c.expiry}|${c.lastMonth ? 'last' : 'first'}`
    for (const admin of admins ?? []) {
      await notifyUser(
        admin.id as string,
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
  return NextResponse.json({ ok: true, cards: cards.length })
}
