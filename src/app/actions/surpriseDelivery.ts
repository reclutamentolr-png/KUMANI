'use server'

import { cookies, headers } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { locales, defaultLocale } from '../../../i18n'
import { createClient } from '@/lib/supabase/server'
import { clientIp } from '@/lib/securityCore'
import { phoneInfo } from '@/lib/scamNetPhone'
import { surpriseDb } from '@/lib/surpriseServer'
import { voucherUnlockAt, type SurpriseKind } from '@/lib/surprise'
import { deliveryCookieName, DELIVERY_MAX, DELIVERY_WHEN, isEmail, normalizeDeliveryCode, type DeliveryWhen } from '@/lib/surpriseDelivery'
import {
  deliveryByCode,
  deliveryByGift,
  emailOwnerDelivered,
  emailProviderLink,
  emailProviderRequest,
  giftExpired,
  giftLive,
  notifyOwnerStep,
  tokenMatches,
  TOKEN_RE,
  type DeliveryFull,
} from '@/lib/surpriseDeliveryServer'

// «Regalo con consegna»: azioni di chi crea la sorpresa (dati di chi
// consegna), di chi riceve (richiesta di ritiro, senza account) e di chi
// consegna (link segreto: appuntamento e consegna, senza account).
// Freni in memoria contro i tentativi a raffica, più i limiti del database.

const attempts = new Map<string, number[]>()
function tooMany(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const list = (attempts.get(key) ?? []).filter((t) => now - t < windowMs)
  if (list.length >= max) return true
  list.push(now)
  attempts.set(key, list)
  if (attempts.size > 5000) attempts.clear()
  return false
}
const ip = async () => clientIp(await headers()) ?? 'x'
const clip = (value: unknown, max: number) => String(value ?? '').trim().slice(0, max)

// ─── Chi crea la sorpresa ───

export type DeliveryInput = { name: string; business: string; phone: string; email: string; pickup: string; agreed: boolean }
type SaveResult = { success: true } | { success: false; message: string }

// null = nessuno da indicare (la riga si toglie, se non c'è ancora una richiesta)
export async function saveSurpriseDelivery(giftId: string, input: DeliveryInput | null): Promise<SaveResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }
  if (!/^[0-9a-f-]{36}$/i.test(giftId)) return { success: false, message: 'notFound' }
  const { data: existing } = await supabase.from('surprise_deliveries').select('gift_id, status').eq('gift_id', giftId).maybeSingle()
  if (!input) {
    if (!existing) return { success: true }
    if (existing.status !== 'pending') return { success: false, message: 'dlvLocked' }
    const { error } = await supabase.from('surprise_deliveries').delete().eq('gift_id', giftId).eq('user_id', user.id)
    return error ? { success: false, message: /locked/.test(error.message) ? 'dlvLocked' : 'saveError' } : { success: true }
  }
  const name = clip(input.name, DELIVERY_MAX.name)
  const email = clip(input.email, DELIVERY_MAX.email).toLowerCase()
  if (!name) return { success: false, message: 'dlvName' }
  if (!isEmail(email)) return { success: false, message: 'dlvEmail' }
  let phone: string | null = null
  if (clip(input.phone, DELIVERY_MAX.phone)) {
    const info = phoneInfo(clip(input.phone, DELIVERY_MAX.phone))
    if (!info?.valid) return { success: false, message: 'dlvPhone' }
    phone = info.e164
  }
  if (input.agreed !== true) return { success: false, message: 'dlvAgree' }
  const fields = {
    provider_name: name,
    provider_business: clip(input.business, DELIVERY_MAX.business),
    provider_phone: phone,
    provider_email: email,
    pickup_info: clip(input.pickup, DELIVERY_MAX.pickup),
  }
  const { error } = existing
    ? await supabase.from('surprise_deliveries').update(fields).eq('gift_id', giftId).eq('user_id', user.id)
    : await supabase.from('surprise_deliveries').insert({ ...fields, gift_id: giftId, user_id: user.id })
  if (error) return { success: false, message: /locked|final/.test(error.message) ? 'dlvLocked' : 'saveError' }
  return { success: true }
}

// ─── Chi riceve ───

export type DeliveryRequestResult = { ok: true } | { ok: false; reason: 'wait' | 'invalid' | 'contact' | 'limit' | 'delivered' | 'expired' | 'error' }

export async function requestSurpriseDelivery(token: string, input: { when: string; contact: string; note: string }): Promise<DeliveryRequestResult> {
  if (tooMany(`dlv-req:${await ip()}`, 6, 60 * 60_000)) return { ok: false, reason: 'wait' }
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return { ok: false, reason: 'invalid' }
  const db = surpriseDb()
  const { data: gift } = await db.from('surprise_gifts').select('id, kind, start_at').eq('public_token', token).eq('status', 'active').is('refunded_at', null).maybeSingle()
  if (!gift) return { ok: false, reason: 'invalid' }
  // Il buono deve essere già aperto (nei percorsi arriva l'ultimo giorno)
  if (voucherUnlockAt(gift.start_at ?? new Date().toISOString(), gift.kind as SurpriseKind).getTime() > Date.now()) return { ok: false, reason: 'invalid' }
  const d = await deliveryByGift(gift.id as string)
  if (!d) return { ok: false, reason: 'invalid' }
  if (d.status === 'delivered') return { ok: false, reason: 'delivered' }
  if (giftExpired(d)) return { ok: false, reason: 'expired' }
  const contact = clip(input.contact, DELIVERY_MAX.contact)
  if (contact.length < 3) return { ok: false, reason: 'contact' }
  const note = clip(input.note, DELIVERY_MAX.note)
  // «Quando»: scritto nella lingua di chi consegna (quella della sorpresa)
  const locale = locales.includes(d.gift.locale) ? d.gift.locale : defaultLocale
  const t = await getTranslations({ locale, namespace: 'surprise' })
  const whenKey = (DELIVERY_WHEN as readonly string[]).includes(input.when) ? (input.when as DeliveryWhen) : 'any'
  const when = t(`dlvWhen_${whenKey}`)
  const { error } = await db.from('surprise_delivery_requests').insert({ gift_id: d.gift_id, when_text: when, contact, note })
  if (error) return { ok: false, reason: /request_limit/.test(error.message) ? 'limit' : /final/.test(error.message) ? 'delivered' : 'error' }
  if (d.status === 'pending') {
    const now = new Date().toISOString()
    await db.from('surprise_deliveries').update({ status: 'requested', requested_at: now }).eq('gift_id', d.gift_id).eq('status', 'pending')
  }
  const sent = await emailProviderRequest(d, { when, contact, note })
  await notifyOwnerStep(d, 'requested')
  return sent ? { ok: true } : { ok: false, reason: 'error' }
}

// ─── Chi consegna ───

async function withCookie(rawCode: string): Promise<DeliveryFull | null> {
  const code = normalizeDeliveryCode(rawCode)
  if (!code) return null
  const d = await deliveryByCode(code)
  if (!d) return null
  const token = (await cookies()).get(deliveryCookieName(code))?.value
  return tokenMatches(d, token) ? d : null
}

// Link dell'email aperto: il link segreto (dopo il #) diventa un cookie
// sicuro per questo buono, così vale anche dalla pagina del QR
export async function claimDeliveryLink(rawCode: string, key: string): Promise<{ ok: boolean }> {
  if (tooMany(`dlv-claim:${await ip()}`, 20, 10 * 60_000)) return { ok: false }
  const code = normalizeDeliveryCode(rawCode)
  if (!code || !TOKEN_RE.test(key)) return { ok: false }
  const d = await deliveryByCode(code)
  if (!d || !tokenMatches(d, key)) return { ok: false }
  ;(await cookies()).set(deliveryCookieName(code), key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 86_400,
  })
  return { ok: true }
}

export type ProviderResult = { ok: true } | { ok: false; reason: 'auth' | 'delivered' | 'invalid' | 'closed' | 'error' }

export async function bookSurpriseDelivery(rawCode: string, input: { text: string; at: string | null }): Promise<ProviderResult> {
  if (tooMany(`dlv-book:${await ip()}`, 30, 60 * 60_000)) return { ok: false, reason: 'error' }
  const d = await withCookie(rawCode)
  if (!d) return { ok: false, reason: 'auth' }
  if (d.status === 'delivered') return { ok: false, reason: 'delivered' }
  // Sorpresa rimborsata o non più attiva
  if (!giftLive(d)) return { ok: false, reason: 'closed' }
  const text = clip(input.text, DELIVERY_MAX.booking)
  let at: string | null = null
  if (input.at) {
    const when = new Date(input.at)
    if (Number.isNaN(when.getTime()) || when.getTime() < Date.now() - 2 * 86_400_000 || when.getTime() > Date.now() + 2 * 366 * 86_400_000) return { ok: false, reason: 'invalid' }
    at = when.toISOString()
  }
  if (!text && !at) return { ok: false, reason: 'invalid' }
  const bookedAt = new Date().toISOString()
  const { data, error } = await surpriseDb()
    .from('surprise_deliveries')
    .update({ status: 'booked', booked_at: bookedAt, booking_text: text, booking_at: at })
    .eq('gift_id', d.gift_id)
    .neq('status', 'delivered')
    .select('gift_id')
  if (error) return { ok: false, reason: /final/.test(error.message) ? 'delivered' : 'error' }
  if (!data?.length) return { ok: false, reason: 'delivered' }
  await notifyOwnerStep({ ...d, booking_text: text, booking_at: at }, 'booked', `${d.gift_id}:${bookedAt}`)
  return { ok: true }
}

// «Segna il regalo come consegnato»: una volta sola (controllo nel database)
export async function markSurpriseDelivered(rawCode: string): Promise<ProviderResult> {
  if (tooMany(`dlv-done:${await ip()}`, 20, 60 * 60_000)) return { ok: false, reason: 'error' }
  const d = await withCookie(rawCode)
  if (!d) return { ok: false, reason: 'auth' }
  if (!giftLive(d)) return { ok: false, reason: 'closed' }
  const { data, error } = await surpriseDb()
    .from('surprise_deliveries')
    .update({ status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('gift_id', d.gift_id)
    .neq('status', 'delivered')
    .select('gift_id')
  if (error) return { ok: false, reason: /final/.test(error.message) ? 'delivered' : 'error' }
  if (!data?.length) return { ok: false, reason: 'delivered' }
  await notifyOwnerStep(d, 'delivered')
  await emailOwnerDelivered(d)
  return { ok: true }
}

// Dalla pagina del QR: «Mandami il link» all'email che ha scritto chi ha
// regalato (mai mostrata). Al massimo una volta all'ora per buono.
export async function resendDeliveryLink(rawCode: string): Promise<{ ok: boolean; reason?: 'wait' }> {
  if (tooMany(`dlv-link:${await ip()}`, 3, 60 * 60_000)) return { ok: false, reason: 'wait' }
  const code = normalizeDeliveryCode(rawCode)
  if (!code) return { ok: false }
  const d = await deliveryByCode(code)
  if (!d || !giftLive(d) || d.status === 'delivered') return { ok: true }
  const since = new Date(Date.now() - 60 * 60_000).toISOString()
  const { data } = await surpriseDb()
    .from('surprise_deliveries')
    .update({ link_sent_at: new Date().toISOString() })
    .eq('gift_id', d.gift_id)
    .or(`link_sent_at.is.null,link_sent_at.lt.${since}`)
    .select('gift_id')
  if (!data?.length) return { ok: false, reason: 'wait' }
  await emailProviderLink(d)
  return { ok: true }
}
