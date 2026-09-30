'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'
import { getLocale } from 'next-intl/server'
import { getStripe } from '@/lib/stripe'
import { recordConsent } from '@/lib/withdrawal'

const getServiceClient = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

type UpgradeReason = 'not_logged' | 'not_stripe' | 'unavailable' | 'already_pro' | 'stripe_error' | 'consent'

// Abbonamento Stripe attivo (Base con carta) da portare a Pro, con i controlli
// comuni ad anteprima e passaggio.
async function findUpgradableSubscription(): Promise<
  { ok: true; userId: string; proPrice: string; subscription: Stripe.Subscription; item: Stripe.SubscriptionItem } | { ok: false; reason: UpgradeReason }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'not_logged' }

  const proPrice = process.env.STRIPE_PRICE_ID_PRO
  if (!proPrice) return { ok: false, reason: 'unavailable' }

  const { data: profile } = await getServiceClient()
    .from('profiles')
    .select('subscription_status, subscription_source, subscription_plan')
    .eq('id', user.id)
    .single()
  if (profile?.subscription_plan === 'pro' && profile.subscription_status === 'active') return { ok: false, reason: 'already_pro' }
  if (profile?.subscription_status !== 'active' || profile.subscription_source !== 'stripe') {
    return { ok: false, reason: 'not_stripe' }
  }

  const stripe = getStripe()
  const found = await stripe.subscriptions.search({ query: `metadata['userId']:'${user.id}' AND status:'active'`, limit: 1 })
  let subscription: Stripe.Subscription | undefined = found.data[0]
  // Abbonamenti creati prima che il checkout salvasse userId anche
  // sull'abbonamento: si ritrovano dal cliente Stripe con la stessa email.
  if (!subscription && user.email) {
    const customers = await stripe.customers.list({ email: user.email, limit: 10 })
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: 'active', limit: 1 })
      if (subs.data[0]) {
        subscription = subs.data[0]
        break
      }
    }
  }
  const item = subscription?.items.data[0]
  if (!subscription || !item) return { ok: false, reason: 'not_stripe' }
  return { ok: true, userId: user.id, proPrice, subscription, item }
}

// Anteprima del passaggio a Pro: quanto Stripe addebiterà subito (la
// differenza per il periodo che resta), da mostrare prima della conferma.
// prorationDate va ripassata a upgradeToPro perché l'importo addebitato sia
// esattamente quello mostrato.
export async function previewUpgradeToPro(): Promise<
  { success: true; amountCents: number; currency: string; prorationDate: number } | { success: false; reason: UpgradeReason }
> {
  try {
    const found = await findUpgradableSubscription()
    if (!found.ok) return { success: false, reason: found.reason }
    const prorationDate = Math.floor(Date.now() / 1000)
    const preview = await getStripe().invoices.createPreview({
      customer: typeof found.subscription.customer === 'string' ? found.subscription.customer : found.subscription.customer.id,
      subscription: found.subscription.id,
      subscription_details: {
        items: [{ id: found.item.id, price: found.proPrice }],
        proration_behavior: 'always_invoice',
        proration_date: prorationDate,
      },
    })
    return { success: true, amountCents: Math.max(preview.amount_due, 0), currency: preview.currency, prorationDate }
  } catch (err) {
    console.error('Errore anteprima passaggio a Pro:', err)
    return { success: false, reason: 'stripe_error' }
  }
}

// Passaggio da Base a Pro per chi paga già con carta: si cambia il prezzo
// dell'abbonamento Stripe esistente e Stripe addebita subito solo la
// differenza per il periodo che resta (niente secondo abbonamento).
// Chi non ha un abbonamento con carta passa dal checkout (?plan=pro).
// immediateStart: consenso all'avvio immediato (casella obbligatoria).
export async function upgradeToPro(prorationDate?: number, immediateStart = false): Promise<{ success: boolean; reason?: UpgradeReason }> {
  if (!immediateStart) return { success: false, reason: 'consent' }
  try {
    const found = await findUpgradableSubscription()
    if (!found.ok) return { success: false, reason: found.reason }
    const { userId, proPrice, subscription, item } = found

    // La data dell'anteprima vale solo se recente (l'utente ha appena visto
    // l'importo); altrimenti Stripe calcola sul momento attuale.
    const now = Math.floor(Date.now() / 1000)
    const useDate = prorationDate && prorationDate <= now && now - prorationDate < 30 * 60 ? prorationDate : undefined

    // error_if_incomplete: se l'addebito della differenza fallisce Stripe
    // annulla il cambio di prezzo e lancia un errore (niente Pro non pagato).
    const updated = await getStripe().subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: proPrice }],
      proration_behavior: 'always_invoice',
      ...(useDate ? { proration_date: useDate } : {}),
      payment_behavior: 'error_if_incomplete',
      metadata: { ...subscription.metadata, userId, plan: 'pro', immediate_start_consent: new Date().toISOString() },
      expand: ['latest_invoice'],
    })

    const invoice = updated.latest_invoice
    const invoicePaid = !invoice || (typeof invoice !== 'string' && invoice.status === 'paid')
    if (updated.status !== 'active' || !invoicePaid) {
      console.error('Passaggio a Pro non pagato:', updated.id, updated.status, typeof invoice === 'string' ? invoice : invoice?.status)
      return { success: false, reason: 'stripe_error' }
    }

    // Il webhook customer.subscription.updated fa lo stesso: qui si aggiorna
    // subito per non far aspettare l'utente.
    const { error: updateError } = await getServiceClient()
      .from('profiles')
      .update({ subscription_plan: 'pro', subscription_status: 'active', subscription_source: 'stripe' })
      .eq('id', userId)
    if (updateError) console.error('Errore salvataggio piano Pro (arriverà col webhook):', updateError.message)
    await recordConsent(getServiceClient(), { userId, kind: 'upgrade', plan: 'pro', stripeRef: subscription.id, locale: await getLocale() })

    revalidatePath('/dashboard')
    revalidatePath('/pro')
    return { success: true }
  } catch (err) {
    console.error('Errore passaggio a Pro:', err)
    return { success: false, reason: 'stripe_error' }
  }
}

// Prova Pro gratuita (15 giorni) per chi è già iscritto: una sola volta per
// account, regole in start_pro_trial().
export async function startProTrial(): Promise<{ success: boolean; reason?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_pro_trial').maybeSingle<{ status: string }>()
  if (error || !data) return { success: false, reason: 'error' }
  if (data.status !== 'ok') return { success: false, reason: data.status }
  revalidatePath('/dashboard')
  revalidatePath('/pro')
  return { success: true }
}
