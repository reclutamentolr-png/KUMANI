import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'
import { isPlatformFeeType, markPlatformFeesPaid } from '@/lib/eventFees'
import { recordAgentCommission, reverseAgentCommission } from '@/lib/agentCommissions'
import { sendPassConfirmation, sendPurchaseConfirmation } from '@/lib/purchaseEmail'
import { awardActivationPoints, awardPassPoints, reverseActivationPoints } from '@/lib/networkPoints'
import { accrueSubscriptionDonation, reverseSubscriptionDonation } from '@/lib/donations'
import { grantToolPassFromSession, revokeToolPassForCharge, TOOL_PASS_TYPE } from '@/lib/toolPasses'

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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('❌ Errore verifica webhook (firma sbagliata?):', message)
    return NextResponse.json({ error: message }, { status: 400 })
  }

  // Fattura di abbonamento pagata: email di conferma, provvigione dell'agente
  // (cliente arrivato dal suo link), Punti Rete allo sponsor diretto e
  // donazione KUMANI. Rimborso: provvigione, punti e donazione annullati.
  if (event.type === 'invoice.paid' || event.type === 'charge.refunded') {
    try {
      if (event.type === 'invoice.paid') {
        // Email di conferma dell'acquisto (supporto durevole): un errore
        // qui non blocca le provvigioni né fa ripetere l'evento.
        await sendPurchaseConfirmation(event.data.object as Stripe.Invoice).catch((err) =>
          console.error('❌ Email di conferma acquisto:', err instanceof Error ? err.message : err)
        )
        await recordAgentCommission(event.data.object as Stripe.Invoice)
        // Punti Rete allo sponsor diretto (idempotente per fattura)
        await awardActivationPoints(event.data.object as Stripe.Invoice)
        // Donazione KUMANI all'associazione attiva (idempotente per fattura)
        await accrueSubscriptionDonation(event.data.object as Stripe.Invoice)
      } else {
        await reverseAgentCommission(event.data.object as Stripe.Charge)
        await reverseActivationPoints(event.data.object as Stripe.Charge)
        await reverseSubscriptionDonation(event.data.object as Stripe.Charge)
        // Pass servizio rimborsato: revocato
        await revokeToolPassForCharge(event.data.object as Stripe.Charge)
      }
      return NextResponse.json({ received: true })
    } catch (err) {
      console.error(`❌ Provvigione agente o Punti Rete (${event.type}) non registrati:`, err instanceof Error ? err.message : err)
      // 500 → Stripe ritenta l'invio dell'evento più tardi.
      return NextResponse.json({ error: 'db_update_failed' }, { status: 500 })
    }
  }

  // Pass di un singolo servizio (pagamento una tantum): si assegna il pass e
  // ci si ferma qui, mai come abbonamento.
  if (
    (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') &&
    (event.data.object as Stripe.Checkout.Session).metadata?.type === TOOL_PASS_TYPE
  ) {
    try {
      const session = event.data.object as Stripe.Checkout.Session
      const expiresAt = await grantToolPassFromSession(session)
      // KU Points a chi ha invitato l'acquirente (se decisi per quel servizio)
      if (expiresAt) await awardPassPoints(session)
      // Conferma su supporto durevole (un'email per pagamento)
      if (expiresAt) {
        await sendPassConfirmation(session, expiresAt).catch((err) =>
          console.error('⚠️ Email di conferma del pass non inviata:', err instanceof Error ? err.message : err)
        )
      }
      return NextResponse.json({ received: true })
    } catch (err) {
      console.error('❌ Pass servizio non assegnato:', err instanceof Error ? err.message : err)
      return NextResponse.json({ error: 'db_update_failed' }, { status: 500 })
    }
  }

  // Commissioni KUMANI (Events: 'event_fee', Kordata: 'convivio_fee').
  // Gestite a parte e mai come abbonamento (i loro metadati non hanno userId).
  if (event.type === 'checkout.session.completed' && isPlatformFeeType((event.data.object as Stripe.Checkout.Session).metadata?.type)) {
    const feeSession = event.data.object as Stripe.Checkout.Session
    try {
      await markPlatformFeesPaid(feeSession.id)
      return NextResponse.json({ received: true })
    } catch (err) {
      console.error(`❌ Commissioni (${feeSession.metadata?.type}) non aggiornate:`, err instanceof Error ? err.message : err)
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
    const subscription = event.data.object as Stripe.Subscription
    const userId = subscription.metadata?.userId
    if (userId) {
      // Attivo anche in prova e durante i nuovi tentativi di addebito
      // (past_due); disdetto o scaduto → 'free' (i valori ammessi nel
      // database sono free/active/suspended: 'inactive' faceva fallire
      // l'aggiornamento e l'utente restava attivo).
      const newStatus = ['active', 'trialing', 'past_due'].includes(subscription.status) ? 'active' : 'free'

      // Piano attivato da voucher o dallo Staff: la fine di un vecchio
      // abbonamento Stripe non lo cancella, e la scadenza non torna indietro.
      const { data: current } = await supabaseAdmin
        .from('profiles')
        .select('subscription_status, subscription_source, subscription_expires_at')
        .eq('id', userId)
        .maybeSingle()
      const manualPlan = !!current?.subscription_source && current.subscription_source !== 'stripe' && current.subscription_status === 'active'
      if (newStatus === 'free' && manualPlan) {
        console.log(`ℹ️ Abbonamento Stripe chiuso per ${userId}: piano ${current?.subscription_source} mantenuto`)
        return NextResponse.json({ received: true })
      }

      const updateData: {
        subscription_status: string
        subscription_source: string | null
        subscription_plan?: 'pro' | 'base'
        subscription_expires_at?: string
      } = {
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
        const stripeEnd = periodEnd * 1000
        const manualEnd = manualPlan && current?.subscription_expires_at ? new Date(current.subscription_expires_at).getTime() : 0
        updateData.subscription_expires_at = new Date(Math.max(stripeEnd, manualEnd)).toISOString()
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