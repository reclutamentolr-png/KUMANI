'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'

// Usi dei KU Karma (Gestione KU). Tutta la logica sensibile (funzione
// attiva?, saldo, tetti, scalare i punti) vive nelle funzioni SQL
// SECURITY DEFINER: qui si chiamano con la sessione dell'utente.

const getServiceClient = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

type KuResult = { success: boolean; reason: string | null }

const refreshKuPages = () => {
  revalidatePath('/wallet')
  revalidatePath('/dashboard')
  revalidatePath('/marketplace/listings')
}

// 1. Vetrina annunci pagata in KU Karma
export async function featureListingWithKu(
  listingId: string,
  durationDays: 7 | 15
): Promise<KuResult & { featuredUntil: string | null }> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('feature_listing_ku', { p_listing_id: listingId, p_duration_days: durationDays })
    .maybeSingle<{ success: boolean; reason: string | null; featured_until: string | null }>()
  if (error || !data) return { success: false, reason: 'error', featuredUntil: null }
  if (data.success) refreshKuPages()
  return { success: data.success, reason: data.reason, featuredUntil: data.featured_until }
}

// 2. Sblocchi extra negli strumenti
export async function buyKuUnlock(unlockKey: string): Promise<KuResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('buy_ku_unlock', { p_unlock_key: unlockKey })
    .maybeSingle<{ success: boolean; reason: string | null }>()
  if (error || !data) return { success: false, reason: 'error' }
  if (data.success) {
    refreshKuPages()
    revalidatePath('/marketplace/link-in-bio')
  }
  return { success: data.success, reason: data.reason }
}

// 5. Conversione in KU Points
export async function convertKuToNetworkPoints(points: number): Promise<KuResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('convert_ku_to_network_points', { p_points: Math.round(points) })
    .maybeSingle<{ success: boolean; reason: string | null }>()
  if (error || !data) return { success: false, reason: 'error' }
  if (data.success) refreshKuPages()
  return { success: data.success, reason: data.reason }
}

// 4. Sconto sul rinnovo: i KU Karma si scalano nel database (prenotazione), poi
// si applica un coupon Stripe "una tantum" all'abbonamento dell'utente, che
// vale sul prossimo addebito. Se Stripe fallisce, i KU Karma vengono restituiti.
export async function redeemRenewalDiscount(): Promise<KuResult & { discountEur: number }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, reason: 'error', discountEur: 0 }

  const { data: reservation, error } = await supabase
    .rpc('reserve_renewal_discount')
    .maybeSingle<{ success: boolean; reason: string | null; transaction_id: string | null; discount_eur: number }>()
  if (error || !reservation) return { success: false, reason: 'error', discountEur: 0 }
  if (!reservation.success || !reservation.transaction_id) {
    return { success: false, reason: reservation.reason, discountEur: 0 }
  }

  const service = getServiceClient()
  try {
    const stripe = getStripe()
    const found = await stripe.subscriptions.search({
      query: `metadata['userId']:'${user.id}' AND status:'active'`,
      limit: 1,
    })
    const subscription = found.data[0]
    if (!subscription) throw new Error('subscription_not_found')

    const coupon = await stripe.coupons.create({
      amount_off: reservation.discount_eur * 100,
      currency: 'eur',
      duration: 'once',
      name: `KUMANI - sconto rinnovo KU Karma (${reservation.discount_eur}€)`,
      max_redemptions: 1,
    })
    // Lo sconto si aggiunge a quelli già presenti sull'abbonamento (non li sostituisce)
    const existing = (subscription.discounts ?? []).map((d) => ({ discount: typeof d === 'string' ? d : d.id }))
    await stripe.subscriptions.update(subscription.id, { discounts: [...existing, { coupon: coupon.id }] })

    await service
      .from('ku_transactions')
      .update({
        details: { status: 'applied', discount_eur: reservation.discount_eur, coupon_id: coupon.id, subscription_id: subscription.id },
      })
      .eq('id', reservation.transaction_id)
    refreshKuPages()
    return { success: true, reason: null, discountEur: reservation.discount_eur }
  } catch (err) {
    // Rimborso dei KU Karma e registrazione dell'esito: la prenotazione non conta
    // più per il limite annuale (status failed).
    const { data: tx } = await service.from('ku_transactions').select('ku_amount').eq('id', reservation.transaction_id).single()
    if (tx) await service.rpc('add_daily_points_for', { p_user_id: user.id, p_amount: tx.ku_amount })
    await service
      .from('ku_transactions')
      .update({ details: { status: 'failed', error: err instanceof Error ? err.message : 'stripe_error' } })
      .eq('id', reservation.transaction_id)
    return { success: false, reason: 'stripe_error', discountEur: 0 }
  }
}
