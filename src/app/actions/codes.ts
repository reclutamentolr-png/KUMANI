'use server'

import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { redeemGiftCode } from '@/app/actions/gifts'
import { redeemToolPassCode } from '@/app/actions/toolPasses'
import { redeemVoucher } from '@/app/actions/vouchers'
import { GIFT_CODE_RE } from '@/lib/gifts'

// Un solo campo "Hai un codice?" (registrazione e dashboard) per tutti i
// codici KUMANI: voucher abbonamento (KV-/KVA-), codici Pass dello Staff
// (PASS-) e regali comprati da un utente (GIFT-).

export type ActivationKind = 'voucher' | 'pass' | 'gift'
export type ActivationResult = { success: boolean; kind: ActivationKind; reason: string | null; expiresAt: string | null }

const kindOf = (code: string): ActivationKind => (GIFT_CODE_RE.test(code) ? 'gift' : code.startsWith('PASS-') ? 'pass' : 'voucher')
const clean = (code: string) => code.trim().toUpperCase()

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Codice invito di chi ha comprato un regalo ancora valido (per chi si
// iscrive con il codice regalo senza indicare chi l'ha invitato)
export async function giftGiverReferral(raw: string): Promise<string> {
  const code = clean(raw)
  if (!GIFT_CODE_RE.test(code)) return ''
  const { data } = await service().rpc('gift_code_info', { p_code: code })
  const info = data as { status?: string; giver_referral?: string | null } | null
  return info?.status === 'valid' ? (info.giver_referral ?? '') : ''
}

// Prima dell'iscrizione: solo "valido / non valido" (si attiva dopo)
export async function checkActivationCode(raw: string): Promise<boolean> {
  const code = clean(raw)
  if (!code || code.length > 40) return false
  const kind = kindOf(code)
  if (kind === 'gift') {
    const { data } = await service().rpc('gift_code_info', { p_code: code })
    return (data as { status?: string } | null)?.status === 'valid'
  }
  if (kind === 'pass') {
    const { data } = await service().from('tool_pass_codes').select('redeemed_at').eq('code', code).maybeSingle()
    return !!data && !data.redeemed_at
  }
  const supabase = await createClient()
  const { data } = await supabase.rpc('voucher_code_is_valid', { p_code: code })
  return data === true
}

// Attiva il codice per l'utente collegato. welcome: iscrizione appena fatta
// con un codice Pass, senza piano: si apre la dashboard essenziale (come
// per i regali, che la impostano da soli).
export async function redeemActivationCode(raw: string, options: { welcome?: boolean } = {}): Promise<ActivationResult> {
  const code = clean(raw)
  const kind = kindOf(code)
  if (!code) return { success: false, kind, reason: 'not_found', expiresAt: null }

  if (kind === 'gift') {
    const result = await redeemGiftCode(code)
    return { success: result.success, kind, reason: result.reason, expiresAt: result.expiresAt }
  }

  if (kind === 'pass') {
    const result = await redeemToolPassCode(code)
    if (result.success && options.welcome) {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) {
        const db = service()
        const { data: plan } = await db.rpc('plan_of', { p_user_id: user.id })
        if (plan === 'none') await db.from('profiles').update({ gift_welcome: true }).eq('id', user.id)
      }
    }
    return { success: result.success, kind, reason: result.reason, expiresAt: result.expiresAt }
  }

  const result = await redeemVoucher(code)
  return result.success
    ? { success: true, kind, reason: null, expiresAt: result.expiresAt }
    : { success: false, kind, reason: result.message, expiresAt: null }
}
