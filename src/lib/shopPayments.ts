import { createClient as createServiceClient } from '@supabase/supabase-js'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { localizedPath, notifyUser } from '@/lib/push'

// KUMANI Shop (fase 1): parte server comune ad azioni e webhook.
// Il cliente paga il venditore sul SUO conto Stripe (Connect, conto
// Standard): qui si registra l'esito sul preventivo e si avvisa il venditore.

export const serviceDb = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Stato del conto collegato copiato da Stripe
export async function syncSellerAccount(account: Stripe.Account) {
  const db = serviceDb()
  const { data: before } = await db.from('seller_stripe_accounts').select('user_id, charges_enabled').eq('stripe_account_id', account.id).maybeSingle()
  const { error } = await db
    .from('seller_stripe_accounts')
    .update({
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: !!account.details_submitted,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_account_id', account.id)
  if (error) console.error('[Shop] syncSellerAccount failed:', error.message)
  // Avviso al venditore quando i pagamenti si attivano o vengono sospesi
  const now = !!account.charges_enabled
  if (!error && before && !!before.charges_enabled !== now) {
    await notifyUser(before.user_id as string, 'messages', (t, locale) => ({
      title: t(now ? 'shopPaymentsActiveTitle' : 'shopPaymentsPausedTitle'),
      body: t(now ? 'shopPaymentsActiveBody' : 'shopPaymentsPausedBody'),
      url: localizedPath(locale, '/marketplace/shop?tab=payments'),
      tag: `stripe-${account.id}`,
    }))
  }
}

// Pagamento riuscito di una Checkout Session sul conto del venditore:
// preventivo pagato (e accettato), avviso al venditore. Idempotente.
export async function recordQuotePayment(session: Stripe.Checkout.Session) {
  const quoteId = session.metadata?.quote_id
  if (!quoteId || session.payment_status !== 'paid') return false
  const db = serviceDb()
  const { data: quote } = await db
    .from('quotes')
    .select('id, user_id, quote_number, client_name, payment_status, accepted_at, accepted_by_name')
    .eq('id', quoteId)
    .maybeSingle()
  if (!quote) return false
  if (quote.payment_status === 'paid') return true
  const amount = (session.amount_total ?? 0) / 100
  const now = new Date().toISOString()
  const { error } = await db
    .from('quotes')
    .update({
      payment_status: 'paid',
      paid_amount: amount,
      paid_at: now,
      accepted_at: quote.accepted_at ?? now,
      accepted_by_name: quote.accepted_by_name ?? session.metadata?.accepted_by_name ?? null,
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null),
    })
    .eq('id', quoteId)
    .neq('payment_status', 'paid')
  if (error) {
    console.error('[Shop] recordQuotePayment failed:', error.message)
    return false
  }
  await notifyUser(
    quote.user_id as string,
    'messages',
    (t, locale) => ({
      title: t('quotePaidTitle', { number: quote.quote_number as number }),
      body: t('quotePaidBody', {
        client: (quote.client_name as string) || '',
        amount: new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(amount),
      }),
      url: localizedPath(locale, `/marketplace/preventivi/${quote.id}`),
      tag: `quote-paid-${quote.id}`,
    }),
    { kind: 'quote_paid', ref: quote.id as string }
  )
  return true
}

export async function retrieveConnectedSession(sessionId: string, accountId: string) {
  return getStripe().checkout.sessions.retrieve(sessionId, {}, { stripeAccount: accountId })
}
