import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { recordQuotePayment, syncSellerAccount } from '@/lib/shopPayments'
import { recordShopOrderPayment } from '@/lib/shopServer'

// Webhook di Stripe Connect (eventi dei conti dei venditori, KUMANI Shop):
// endpoint separato da quello degli abbonamenti, con la sua chiave
// STRIPE_CONNECT_WEBHOOK_SECRET. Eventi: checkout.session.completed,
// checkout.session.async_payment_succeeded, account.updated.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'not_configured' }, { status: 503 })
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig!, secret)
  } catch (error) {
    console.error('[Shop webhook] signature failed:', error)
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.metadata?.kind === 'quote') await recordQuotePayment(session)
        if (session.metadata?.kind === 'shop_order') await recordShopOrderPayment(session)
        break
      }
      case 'account.updated':
        await syncSellerAccount(event.data.object as Stripe.Account)
        break
    }
  } catch (error) {
    console.error('[Shop webhook] handling failed:', error)
    return NextResponse.json({ error: 'handler_failed' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
