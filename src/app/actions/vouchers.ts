'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser } from '@/lib/session'
import { normalizeCode } from '@/lib/codeFormat'

const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Voucher abbonamento nel Wallet: i voucher premio delle qualifiche
// (Kuman Green / Star / Black) arrivano da soli (evaluate_qualifications nel
// database) e si usano o si regalano, non si vendono. Qui: riscatto di un
// codice ricevuto, elenco dei propri voucher.

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

  const trimmed = normalizeCode(code)
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
  purpose: 'gift' | 'promo' | null
  // Premio di qualifica (rising_star, shining_star, diamond_star, black_plus_N)
  prize_key: string | null
  // Voucher Pro personale di Kuman Black: si può attivare per sé
  personal: boolean
}

/** I voucher dell'utente: quelli creati e quelli ricevuti in premio. */
export async function listMyVouchers(): Promise<MyVoucher[]> {
  // Utente verificato (getUser), letto una volta sola per richiesta: dal
  // Wallet è lo stesso della pagina; chiamata dal browser lo rilegge.
  const user = await getSessionUser()
  if (!user) return []

  // Letti col servizio, sempre filtrati sui voucher dell'utente
  const { data } = await db()
    .from('subscription_vouchers')
    .select('id, code, status, created_at, redeemed_at, plan, purpose, prize_key, created_by')
    .or(`created_by.eq.${user.id},holder_id.eq.${user.id}`)
    // I codici omaggio creati dallo Staff restano in Admin, non nel suo Wallet
    .or('purpose.is.null,purpose.neq.promo')
    .order('created_at', { ascending: false })
    .limit(200)

  return ((data ?? []) as (Omit<MyVoucher, 'personal'> & { created_by: string })[]).map(({ created_by, ...v }) => ({ ...v, personal: created_by !== user.id }))
}
