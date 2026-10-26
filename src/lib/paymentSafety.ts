import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { localizedPath, notifyUser } from '@/lib/push'
import { serviceDb } from '@/lib/shopPayments'
import { fullAdminIds } from '@/lib/staffAlerts'

// Protezioni dei pagamenti: contestazioni (chargeback) e abbonamenti pagati
// due volte. Gli avvisi vanno agli admin completi o al venditore.

const LIVE: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due']
const money = (cents: number, currency: string, locale: string) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: currency.toUpperCase() }).format(cents / 100)

const adminIds = fullAdminIds

// --- Contestazioni ---

// Su un pagamento a KUMANI (abbonamenti, pass, regali…): avviso agli admin
export async function notifyPlatformDispute(dispute: Stripe.Dispute) {
  for (const id of await adminIds()) {
    await notifyUser(
      id,
      'staff',
      (t, locale) => ({
        title: t('disputeStaffTitle'),
        body: t('disputeStaffBody', { amount: money(dispute.amount, dispute.currency, locale), reason: dispute.reason }),
        url: `https://dashboard.stripe.com/disputes/${dispute.id}`,
        tag: `dispute-${dispute.id}`,
      }),
      { kind: 'dispute', ref: dispute.id }
    )
  }
}

// Su un pagamento al venditore (preventivo o Shop, sul suo conto Stripe)
export async function notifySellerDispute(dispute: Stripe.Dispute, accountId: string) {
  const { data: seller } = await serviceDb().from('seller_stripe_accounts').select('user_id').eq('stripe_account_id', accountId).maybeSingle()
  if (!seller) return
  await notifyUser(
    seller.user_id as string,
    'messages',
    (t, locale) => ({
      title: t('disputeSellerTitle'),
      body: t('disputeSellerBody', { amount: money(dispute.amount, dispute.currency, locale) }),
      url: `https://dashboard.stripe.com/disputes/${dispute.id}`,
      tag: `dispute-${dispute.id}`,
    }),
    { kind: 'dispute', ref: dispute.id }
  )
}

// --- Abbonamento pagato due volte (due schede aperte) ---

const planRank = (sub: Stripe.Subscription) => (sub.items?.data?.[0]?.price?.id === process.env.STRIPE_PRICE_ID_PRO ? 2 : 1)

// Se l'utente ha già un altro abbonamento attivo di piano uguale o superiore,
// quello appena pagato è un doppione: si chiude e si rimborsa subito.
// true = doppione gestito (il profilo non va toccato).
export async function cancelDuplicateSubscription(session: Stripe.Checkout.Session): Promise<boolean> {
  const userId = session.metadata?.userId
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  const email = session.customer_details?.email ?? session.customer_email
  if (!userId || !subscriptionId || !email) return false
  const stripe = getStripe()

  const current = await stripe.subscriptions.retrieve(subscriptionId)
  if (current.metadata?.duplicate === '1') return true
  // I clienti con quella email (ogni pagamento può averne creato uno nuovo)
  const customers = await stripe.customers.list({ email, limit: 10 })
  const others: Stripe.Subscription[] = []
  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 10 })
    for (const sub of subs.data) {
      if (sub.id !== current.id && sub.metadata?.userId === userId && sub.metadata?.duplicate !== '1' && LIVE.includes(sub.status)) others.push(sub)
    }
  }
  const keeper = others.find((sub) => sub.created <= current.created && planRank(sub) >= planRank(current))
  if (!keeper) return false

  // Segnato come doppione prima di chiuderlo: il webhook non toccherà il profilo
  await stripe.subscriptions.update(current.id, { metadata: { duplicate: '1', duplicate_of: keeper.id } })
  await stripe.subscriptions.cancel(current.id, { prorate: false })
  const invoiceId = typeof current.latest_invoice === 'string' ? current.latest_invoice : current.latest_invoice?.id
  let refunded = 0
  if (invoiceId) {
    const invoice = (await stripe.invoices.retrieve(invoiceId)) as Stripe.Invoice & { payment_intent?: string | { id: string } | null }
    const paymentIntent = typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id
    if (paymentIntent && invoice.amount_paid > 0) {
      await stripe.refunds.create({ payment_intent: paymentIntent, reason: 'duplicate' }, { idempotencyKey: `dup-sub-${current.id}` })
      refunded = invoice.amount_paid
    }
  }
  console.warn(`⚠️ Abbonamento doppio ${current.id} di ${userId} chiuso e rimborsato (tiene ${keeper.id})`)

  await notifyUser(
    userId,
    'messages',
    (t, locale) => ({
      title: t('duplicateSubTitle'),
      body: t('duplicateSubBody', { amount: money(refunded, current.currency, locale) }),
      url: localizedPath(locale, '/billing'),
      tag: `dup-sub-${current.id}`,
    }),
    { kind: 'duplicate_subscription', ref: current.id }
  )
  for (const id of await adminIds()) {
    await notifyUser(
      id,
      'staff',
      (t, locale) => ({
        title: t('duplicateSubStaffTitle'),
        body: t('duplicateSubStaffBody', { email, amount: money(refunded, current.currency, locale) }),
        url: `https://dashboard.stripe.com/subscriptions/${current.id}`,
        tag: `dup-sub-${current.id}`,
      }),
      { kind: 'duplicate_subscription', ref: current.id }
    )
  }
  return true
}

// Prima di un nuovo pagamento dell'abbonamento: le pagine di pagamento
// lasciate aperte (altre schede) si chiudono, così se ne paga una sola
export async function expireOpenSubscriptionCheckouts(userId: string) {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
  const { data } = await serviceDb()
    .from('subscription_consents')
    .select('stripe_ref')
    .eq('user_id', userId)
    .eq('kind', 'checkout')
    .gte('created_at', since)
    .not('stripe_ref', 'is', null)
    .limit(20)
  const stripe = getStripe()
  for (const row of data ?? []) {
    const ref = row.stripe_ref as string
    if (!ref.startsWith('cs_')) continue
    try {
      const session = await stripe.checkout.sessions.retrieve(ref)
      if (session.status === 'open') await stripe.checkout.sessions.expire(ref)
    } catch {
      // già chiusa o di un altro ambiente: niente da fare
    }
  }
}
