'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Voucher abbonamento nel Wallet: i voucher premio delle qualifiche
// (Kuman Green / Star / Black) arrivano da soli (evaluate_qualifications nel
// database). Qui: dati di vendita per la ricevuta, riscatto di un codice
// ricevuto, elenco dei propri voucher.

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
  const { data: voucher } = await service
    .from('subscription_vouchers')
    .select('id, sold_at, cost_cents')
    .eq('id', voucherId)
    .or(`created_by.eq.${user.id},holder_id.eq.${user.id}`)
    .maybeSingle()
  if (!voucher) return { success: false as const }
  // Mai oltre il valore del voucher (vale anche il vincolo nel database)
  if (price !== null && voucher.cost_cents !== null && price > voucher.cost_cents) return { success: false as const }
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
  // Premio di qualifica (rising_star, shining_star, diamond_star, black_plus_N)
  prize_key: string | null
  // Voucher Pro personale di Kuman Black: si può attivare per sé
  personal: boolean
}

/** I voucher dell'utente: quelli creati e quelli ricevuti in premio. */
export async function listMyVouchers(): Promise<MyVoucher[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  // Letti col servizio, sempre filtrati sui voucher dell'utente
  const { data } = await db()
    .from('subscription_vouchers')
    .select('id, code, status, created_at, redeemed_at, plan, purpose, sale_price_cents, buyer_name, prize_key, created_by')
    .or(`created_by.eq.${user.id},holder_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  return ((data ?? []) as (Omit<MyVoucher, 'personal'> & { created_by: string })[]).map(({ created_by, ...v }) => ({ ...v, personal: created_by !== user.id }))
}
