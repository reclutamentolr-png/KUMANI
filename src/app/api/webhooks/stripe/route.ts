import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'
import { markEventFeesPaid } from '@/lib/eventFees'

// Creato alla richiesta e non al caricamento del modulo: così `next build`
// non fallisce se le variabili d'ambiente non sono disponibili in build.
const getSupabaseAdmin = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

// Fine del periodo corrente (secondi Unix): sull'abbonamento nelle API
// Stripe meno recenti, sulla prima voce in quelle nuove.
type PeriodSource = { current_period_end?: number; items?: { data?: Array<{ current_period_end?: number }> } }
const getPeriodEnd = (sub: PeriodSource | null | undefined): number | null =>
  sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end ?? null

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  let event: Stripe.Event

  try {
    event = getStripe().webhooks.constructEvent(body, sig!, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch (err: any) {
    console.error('❌ Errore verifica webhook (firma sbagliata?):', err.message)
    return NextResponse.json({ error: err.message }, { status: 400 })
  }

  // KUMANI Events: pagamento delle commissioni. Gestito a parte e mai come
  // abbonamento (i suoi metadati non hanno userId).
  if (event.type === 'checkout.session.completed' && (event.data.object as Stripe.Checkout.Session).metadata?.type === 'event_fee') {
    try {
      await markEventFeesPaid((event.data.object as Stripe.Checkout.Session).id)
      return NextResponse.json({ received: true })
    } catch (err) {
      console.error('❌ Commissioni Events non aggiornate:', err instanceof Error ? err.message : err)
      return NextResponse.json({ error: 'db_update_failed' }, { status: 500 })
    }
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.userId

    // Scadenza: la fine del periodo reale dell'abbonamento Stripe. Se non si
    // riesce a leggerla si stima 1 anno (piano annuale); si corregge comunque
    // col successivo customer.subscription.updated.
    const now = new Date()
    let expiresAt = new Date(now.setFullYear(now.getFullYear() + 1))
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    if (subscriptionId) {
      try {
        const sub = await getStripe().subscriptions.retrieve(subscriptionId)
        const periodEnd = getPeriodEnd(sub)
        if (periodEnd) expiresAt = new Date(periodEnd * 1000)
      } catch (err) {
        console.error('⚠️ Impossibile leggere l\'abbonamento Stripe, scadenza stimata:', err instanceof Error ? err.message : err)
      }
    }

    if (userId) {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .update({
          subscription_status: 'active',
          subscription_expires_at: expiresAt.toISOString(),
          subscription_source: 'stripe',
          subscription_plan: session.metadata?.plan === 'pro' ? 'pro' : 'base',
        })
        .eq('id', userId)
        .select()
      
      if (error) {
        console.error('❌ Errore Supabase:', error.message)
        // 500 → Stripe ritenta l'invio dell'evento più tardi.
        return NextResponse.json({ error: 'db_update_failed' }, { status: 500 })
      } else if (!data || data.length === 0) {
        console.error('⚠️ NESSUNA RIGA AGGIORNATA! UserId non trovato.')
      }
    }
  }

  // Handle subscription deletion/cancellation
  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as any
    const userId = subscription.metadata?.userId
    if (userId) {
      const newStatus = subscription.status === 'active' ? 'active' : 'inactive'

      const updateData: Record<string, any> = {
        subscription_status: newStatus,
        subscription_source: newStatus === 'active' ? 'stripe' : null,
      }

      // Piano dal prezzo dell'abbonamento (cambia anche col passaggio a Pro).
      const priceId = subscription.items?.data?.[0]?.price?.id
      if (newStatus === 'active' && priceId) {
        updateData.subscription_plan = priceId === process.env.STRIPE_PRICE_ID_PRO ? 'pro' : 'base'
      }

      // Prossimo rinnovo: nelle versioni recenti dell'API Stripe
      // current_period_end sta sulle voci dell'abbonamento, non più su di esso.
      const periodEnd = getPeriodEnd(subscription)
      if (periodEnd) {
        updateData.subscription_expires_at = new Date(periodEnd * 1000).toISOString()
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', userId)

      if (error) {
        console.error('❌ Errore aggiornamento subscription:', error.message)
        // 500 → Stripe ritenta l'invio dell'evento più tardi.
        return NextResponse.json({ error: 'db_update_failed' }, { status: 500 })
      }
    }
  }

  return NextResponse.json({ received: true })
}