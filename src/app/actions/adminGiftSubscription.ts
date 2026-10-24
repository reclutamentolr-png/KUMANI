'use server'

import { revalidatePath } from 'next/cache'
import { selfRewardRefused, verifyAdmin } from '@/lib/verifyAdmin'
import { localizedPath, notifyUser, pushDb } from '@/lib/push'
import { SITE_URL } from '@/lib/siteUrl'
import { CARD_CUSTOM_MAX, CARD_DESIGNS, CARD_NAME_MAX, CARD_PHRASES, cardLink, cardPath, type CardOptions } from '@/lib/voucherCard'

// Admin → Voucher e coupon → Coupon per la community → «Regala un
// abbonamento»: un voucher Plus o Pro intestato a un Kumano, che parte
// dall'account KUMANI (create_prize_voucher, come i premi delle qualifiche).
// Il Kumano lo trova nel Wallet e riceve un avviso (campanella e telefono)
// che apre il biglietto, da dove lo attiva con un tocco.
export async function adminGiftSubscription(input: {
  userId: string
  plan: 'base' | 'pro'
  design: string
  phrase: string
  custom: string
  from: string
}): Promise<{ success: true; code: string; link: string } | { success: false; error: string }> {
  const admin = await verifyAdmin('coupons.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!/^[0-9a-f-]{36}$/i.test(input.userId)) return { success: false, error: 'Scegli a chi regalarlo' }
  if (await selfRewardRefused(admin.id, input.userId)) return { success: false, error: 'Solo un amministratore completo può farsi un regalo da solo' }
  const plan = input.plan === 'pro' ? 'pro' : 'base'
  const db = pushDb()

  const { data: person } = await db.from('profiles').select('id, first_name, guest_until, is_blocked').eq('id', input.userId).maybeSingle()
  if (!person || person.guest_until || person.is_blocked) return { success: false, error: 'Utente non valido' }

  // Account KUMANI come autore: il Kumano può attivarlo per sé
  const { data: code, error } = await db.rpc('create_prize_voucher', { p_holder: person.id, p_plan: plan, p_prize_key: 'admin_gift', p_self: true })
  if (error || !code) return { success: false, error: error?.message || 'Voucher non creato (manca l’account KUMANI?)' }
  await db.from('subscription_vouchers').update({ recipient_name: person.first_name ?? null, campaign: 'admin_gift' }).eq('code', code)

  const options: CardOptions = {
    design: (CARD_DESIGNS as readonly string[]).includes(input.design) ? (input.design as CardOptions['design']) : 'A',
    phrase: input.phrase === 'custom' ? 'custom' : (CARD_PHRASES as readonly string[]).includes(input.phrase) ? (input.phrase as CardOptions['phrase']) : 'p2',
    custom: (input.custom ?? '').slice(0, CARD_CUSTOM_MAX),
    to: (person.first_name ?? '').slice(0, CARD_NAME_MAX),
    from: (input.from || 'KUMANI').slice(0, CARD_NAME_MAX),
  }
  const planName = plan === 'pro' ? 'Pro' : 'Plus'
  await notifyUser(
    person.id,
    'alerts',
    (t, locale) => ({
      title: t('giftVoucherTitle'),
      body: t('giftVoucherBody', { plan: planName }),
      url: localizedPath(locale, cardPath(code as string, options)),
      tag: `gift-voucher-${code}`,
    }),
    { kind: 'gift_voucher', ref: code as string }
  )
  revalidatePath('/wallet')
  return { success: true, code: code as string, link: cardLink(SITE_URL, 'it', code as string, options) }
}

export type AdminGiftRow = {
  code: string
  plan: 'base' | 'pro'
  createdAt: string
  status: 'active' | 'redeemed' | 'other'
  redeemedAt: string | null
  recipient: string
  email: string | null
}

// Elenco dei regali fatti dall'Admin (più recenti prima): a chi, piano, stato
export async function adminListGiftSubscriptions(): Promise<{ gifts: AdminGiftRow[] } | { error: string }> {
  if (!(await verifyAdmin('coupons.read'))) return { error: 'Non autorizzato' }
  const db = pushDb()
  const { data, error } = await db
    .from('subscription_vouchers')
    .select('code, plan, status, created_at, redeemed_at, holder_id')
    .eq('prize_key', 'admin_gift')
    .order('created_at', { ascending: false })
    .limit(300)
  if (error) return { error: error.message }
  const ids = [...new Set((data ?? []).map((v) => v.holder_id).filter(Boolean))] as string[]
  const { data: people } = ids.length ? await db.from('profiles').select('id, first_name, last_name, email').in('id', ids) : { data: [] }
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]))
  return {
    gifts: (data ?? []).map((v) => {
      const p = byId.get(v.holder_id as string)
      return {
        code: v.code as string,
        plan: v.plan === 'pro' ? 'pro' : 'base',
        createdAt: v.created_at as string,
        status: v.status === 'active' ? 'active' : v.status === 'redeemed' ? 'redeemed' : 'other',
        redeemedAt: (v.redeemed_at as string | null) ?? null,
        recipient: [p?.first_name, p?.last_name].filter(Boolean).join(' ') || '—',
        email: (p?.email as string | null) ?? null,
      }
    }),
  }
}
