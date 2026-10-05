'use server'

import { revalidatePath } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { createClient } from '@/lib/supabase/server'
import { localizedPath, notifyUser } from '@/lib/push'
import { GIFT_CODE_RE, normalizeGiftCode, type GiftKind, type GiftOrder, type GiftRedeemReason } from '@/lib/gifts'

export type GiftRedeemResult = {
  success: boolean
  reason: GiftRedeemReason | null
  kind: GiftKind | null
  tool: string | null
  plan: 'base' | 'pro' | null
  expiresAt: string | null
}

type RedeemRow = { success: boolean; reason: GiftRedeemReason | null; kind: GiftKind | null; tool: string | null; plan: 'base' | 'pro' | null; expires_at: string | null; buyer_id: string | null }

// Attiva un codice regalo per l'utente collegato e avvisa chi l'ha regalato
export async function redeemGiftCode(code: string): Promise<GiftRedeemResult> {
  const clean = normalizeGiftCode(code)
  const empty = { kind: null, tool: null, plan: null, expiresAt: null }
  if (!GIFT_CODE_RE.test(clean)) return { success: false, reason: 'not_found', ...empty }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('redeem_gift_code', { p_code: clean }).maybeSingle<RedeemRow>()
  if (error || !data) return { success: false, reason: 'error', ...empty }
  if (data.success) {
    revalidatePath('/dashboard')
    revalidatePath('/wallet')
    if (data.buyer_id) {
      const { data: me } = await supabase.rpc('get_my_profile').maybeSingle<{ id: string; first_name: string | null }>()
      const name = me?.first_name || 'Kumano'
      // Chi riceve il regalo e non ha ancora indicato chi l'ha invitato (entro
      // i giorni previsti): entra nella stella di chi ha regalato
      if (me?.id) await giverAsSponsor(me.id, data.buyer_id)
      await notifyUser(
        data.buyer_id,
        'network',
        (t, locale) => ({ title: t('giftRedeemedTitle'), body: t('giftRedeemedBody', { name }), url: localizedPath(locale, '/regali'), tag: `gift-${clean}` }),
        { kind: 'gift_redeemed', ref: clean }
      )
    }
  }
  return { success: data.success, reason: data.reason, kind: data.kind, tool: data.tool, plan: data.plan, expiresAt: data.expires_at }
}

async function giverAsSponsor(userId: string, buyerId: string) {
  try {
    const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: status } = await db.rpc('late_sponsor_status', { p_user: userId })
    if ((status as { eligible?: boolean } | null)?.eligible !== true) return
    const { data: buyer } = await db.from('profiles').select('referral_code').eq('id', buyerId).maybeSingle()
    if (!buyer?.referral_code) return
    const { data: result, error } = await db.rpc('assign_late_sponsor', { p_user: userId, p_code: buyer.referral_code, p_ignore_deadline: false })
    if (error || result !== 'ok') console.error('[regalo] invito di chi regala non assegnato:', error?.message ?? result)
  } catch (error) {
    console.error('[regalo] invito di chi regala non assegnato:', error)
  }
}

export async function getMyGiftOrders(): Promise<GiftOrder[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_gift_orders')
  return (data ?? []) as GiftOrder[]
}

// "Mostra la dashboard completa"
export async function showFullDashboard(): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('gift_welcome_off')
  revalidatePath('/dashboard')
}

// ---------- Admin ----------

export type AdminGiftCode = { code: string; valid_until: string; redeemed_at: string | null; revoked_at: string | null; redeemed_by: string | null }
export type AdminGiftOrder = {
  id: string
  buyer_id: string | null
  kind: GiftKind
  tool: string | null
  plan: 'base' | 'pro' | null
  quantity: number
  amount_cents: number
  message: string | null
  stripe_payment_intent: string | null
  refunded_at: string | null
  created_at: string
  gift_codes: AdminGiftCode[]
}
export type AdminGiftPerson = { first_name: string | null; last_name: string | null; email: string | null }

// Admin → Voucher e coupon → Regali: ordini con i codici e chi li ha attivati
export async function adminListGiftOrders(): Promise<{ orders: AdminGiftOrder[]; people: Record<string, AdminGiftPerson>; error: string | null }> {
  const admin = await verifyAdmin('coupons.read')
  if (!admin) return { orders: [], people: {}, error: 'Non autorizzato' }
  const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await db
    .from('gift_orders')
    .select('id, buyer_id, kind, tool, plan, quantity, amount_cents, message, stripe_payment_intent, refunded_at, created_at, gift_codes(code, valid_until, redeemed_at, revoked_at, redeemed_by)')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return { orders: [], people: {}, error: error.message }
  const orders = (data ?? []) as AdminGiftOrder[]
  const ids = [...new Set(orders.flatMap((o) => [o.buyer_id, ...o.gift_codes.map((c) => c.redeemed_by)]).filter((id): id is string => !!id))]
  const people: Record<string, AdminGiftPerson> = {}
  if (ids.length) {
    const { data: rows } = await db.from('profiles').select('id, first_name, last_name, email').in('id', ids)
    for (const row of rows ?? []) people[row.id as string] = { first_name: row.first_name, last_name: row.last_name, email: row.email }
  }
  return { orders, people, error: null }
}
