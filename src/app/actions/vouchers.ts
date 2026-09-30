'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Voucher del nuovo sistema dei Punti Community:
// 1. si riscatta un pacchetto (294 / 1800 / 5500 punti) → credito in euro;
// 2. con il credito si crea un voucher Base (49 €) o Pro (149 €), da regalare
//    o da vendere; un voucher non usato si può annullare (credito restituito).
// Controlli e addebiti avvengono in un'unica transazione nel database
// (redeem_voucher_pack, create_subscription_voucher, cancel_my_voucher in
// 20261203100000_network_points_v2.sql).

export async function redeemVoucherPack(index: number) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, message: 'notLoggedIn' as const }

  const { data, error } = await supabase
    .rpc('redeem_voucher_pack', { p_index: index })
    .single<{ success: boolean; reason: string | null; new_network_points: number; new_credit_cents: number }>()
  if (error || !data) return { success: false as const, message: 'error' as const }
  if (!data.success) return { success: false as const, message: (data.reason ?? 'error') as 'insufficient_points' | 'not_found' | 'error' }
  revalidatePath('/wallet')
  return { success: true as const, points: data.new_network_points, creditCents: data.new_credit_cents }
}

export async function createVoucher(input: { plan: 'base' | 'pro'; purpose: 'gift' | 'sale'; priceCents: number | null }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, message: 'notLoggedIn' as const }

  const price = input.purpose === 'sale' && input.priceCents !== null && Number.isFinite(input.priceCents) ? Math.max(0, Math.round(input.priceCents)) : null
  const { data, error } = await supabase
    .rpc('create_subscription_voucher', { p_plan: input.plan, p_purpose: input.purpose, p_price_cents: price })
    .single<{ success: boolean; reason: string | null; code: string | null; new_credit_cents: number }>()
  if (error || !data) return { success: false as const, message: 'error' as const }
  if (!data.success) return { success: false as const, message: (data.reason ?? 'error') as 'insufficient_credit' | 'invalid' | 'error' }
  revalidatePath('/wallet')
  return { success: true as const, code: data.code as string, creditCents: data.new_credit_cents }
}

export async function cancelMyVoucher(voucherId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('cancel_my_voucher', { p_voucher_id: voucherId })
    .single<{ success: boolean; new_credit_cents: number }>()
  if (error || !data?.success) return { success: false as const }
  revalidatePath('/wallet')
  return { success: true as const, creditCents: data.new_credit_cents }
}

// Dati di vendita per la ricevuta (acquirente e prezzo): solo sui propri
// voucher. La vendita è del Kumano, KUMANI non ne è parte.
export async function updateVoucherSale(voucherId: string, input: { buyerName: string; priceCents: number | null }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const }
  const buyer = input.buyerName.trim().slice(0, 200)
  const price = input.priceCents !== null && Number.isFinite(input.priceCents) ? Math.max(0, Math.round(input.priceCents)) : null
  const service = db()
  const { data: voucher } = await service.from('subscription_vouchers').select('id, sold_at').eq('id', voucherId).eq('created_by', user.id).maybeSingle()
  if (!voucher) return { success: false as const }
  const { error } = await service
    .from('subscription_vouchers')
    .update({ purpose: 'sale', buyer_name: buyer || null, sale_price_cents: price, sold_at: voucher.sold_at ?? new Date().toISOString() })
    .eq('id', voucherId)
  if (error) return { success: false as const }
  revalidatePath('/wallet')
  return { success: true as const }
}

/**
 * Redeems a subscription voucher code: single-use, and never redeemable by
 * its own creator (both enforced inside redeem_subscription_voucher, not
 * here — this action is a thin pass-through so the RPC's atomicity is the
 * real guarantee).
 */
export async function redeemVoucher(code: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, message: 'notLoggedIn' as const }

  const trimmed = code.trim().toUpperCase()
  if (!trimmed) return { success: false as const, message: 'notFound' as const }

  const { data, error } = await supabase
    .rpc('redeem_subscription_voucher', { p_code: trimmed })
    .single<{ success: boolean; reason: string | null; new_expires_at: string | null }>()

  if (error || !data) return { success: false as const, message: 'error' as const }
  if (!data.success) {
    return { success: false as const, message: (data.reason || 'error') as 'not_found' | 'already_used' | 'self_redemption' }
  }
  return { success: true as const, expiresAt: data.new_expires_at as string }
}

export type MyVoucher = {
  id: string
  code: string
  status: string
  created_at: string
  redeemed_at: string | null
  plan: 'base' | 'pro' | null
  purpose: 'gift' | 'sale' | null
  sale_price_cents: number | null
  buyer_name: string | null
}

/** Lists vouchers the caller created, for their own wallet history. */
export async function listMyVouchers(): Promise<MyVoucher[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // Letti col servizio, sempre filtrati sui voucher creati dall'utente
  const { data } = await db()
    .from('subscription_vouchers')
    .select('id, code, status, created_at, redeemed_at, plan, purpose, sale_price_cents, buyer_name')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  return (data as MyVoucher[] | null) || []
}
