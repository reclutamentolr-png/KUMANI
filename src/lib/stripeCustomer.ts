import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'

export type StripeSubscriptionInfo = {
  customerId: string
  subscription: Stripe.Subscription | null
}

const LIVE_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing', 'past_due']

/**
 * Trova il cliente Stripe dell'utente (dall'email usata al checkout) e il suo
 * abbonamento. Preferenza: cliente con un abbonamento il cui metadata.userId
 * è quello dell'utente, poi cliente con un abbonamento attivo, infine il
 * primo cliente trovato con quella email. null se non esiste alcun cliente.
 */
export async function findStripeSubscriptionForUser(
  userId: string,
  email: string | null | undefined
): Promise<StripeSubscriptionInfo | null> {
  if (!email) return null
  const stripe = getStripe()
  const customers = await stripe.customers.list({ email, limit: 10 })
  if (customers.data.length === 0) return null

  let byUserId: StripeSubscriptionInfo | null = null
  let byActive: StripeSubscriptionInfo | null = null

  for (const customer of customers.data) {
    const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'all', limit: 10 })
    const live = subs.data.filter((s) => LIVE_STATUSES.includes(s.status))
    const mine = live.find((s) => s.metadata?.userId === userId) ?? subs.data.find((s) => s.metadata?.userId === userId)
    if (mine && !byUserId) {
      byUserId = { customerId: customer.id, subscription: mine }
      // Abbonamento in corso con il nostro userId: è quello giusto.
      if (LIVE_STATUSES.includes(mine.status)) break
    }
    if (live[0] && !byActive) byActive = { customerId: customer.id, subscription: live[0] }
  }

  return byUserId ?? byActive ?? { customerId: customers.data[0].id, subscription: null }
}

/** Fine del periodo pagato (secondi Unix), compatibile con le varie versioni API. */
export function subscriptionPeriodEnd(sub: Stripe.Subscription): number | undefined {
  return (sub as Stripe.Subscription & { current_period_end?: number }).current_period_end
    ?? sub.items?.data?.[0]?.current_period_end
}

/** Stripe risponde così quando il Customer Portal non è stato salvato nella dashboard. */
export function isPortalNotConfiguredError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err ?? '')
  return /configuration/i.test(message) && /(portal|billing)/i.test(message)
}
