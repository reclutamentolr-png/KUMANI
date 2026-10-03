'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { awardToolPoint } from '@/lib/toolPoints'
import { locales } from '../../../i18n'
import {
  addWalletToken,
  closeCassaSession,
  getFidelityServiceClient,
  hasCassaAccess,
  hashPin,
  newClaimCode,
  newMemberCode,
  newMemberToken,
  openCassaSession,
  readWalletTokens,
  revokeAllCassaSessions,
  verifyPin,
} from '@/lib/fidelity-server'
import {
  FIDELITY_CLAIM_TTL_SECONDS,
  FIDELITY_MAX_MIN_HOURS,
  FIDELITY_MAX_QUANTITY,
  FIDELITY_MAX_STAMPS,
  FIDELITY_MIN_STAMPS,
  FIDELITY_PIN_PATTERN,
  FIDELITY_EXPIRY_OPTIONS,
  normalizePhone,
  FIDELITY_MIN_CLOSE_PERCENT,
  FIDELITY_MAX_CLOSE_PERCENT,
  parseMemberQr,
  effectiveStamps,
  type FidelityKind,
  type FidelityStatus,
} from '@/lib/fidelity'

type Fail<M extends string> = { success: false; message: M }

// ============================================================
// Commerciante: creazione e impostazioni della tessera
// ============================================================

export interface FidelityCardForm {
  businessName: string
  prize: string
  stampsNeeded: number
  minHoursBetweenStamps: number
  // null = i timbri non scadono.
  stampsExpireDays: number | null
  // Link alla pagina recensioni del negozio (es. Google): attiva il timbro bonus.
  reviewUrl: string
  // Da quale % dei timbri un cliente è "vicino al premio".
  closeToPrizePercent: number
  // Obbligatorio alla creazione; in modifica, se compilato cambia il PIN.
  pin: string
}

export async function saveFidelityCard(
  form: FidelityCardForm
): Promise<{ success: true } | Fail<'notAuthenticated' | 'subscriptionRequired' | 'invalidData' | 'invalidPin' | 'saveError'>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notAuthenticated' }
  if (!(await hasActiveToolAccess(supabase, user.id, 'fidelity'))) return { success: false, message: 'subscriptionRequired' }

  const businessName = form.businessName.trim().slice(0, 80)
  const prize = form.prize.trim().slice(0, 120)
  const stampsNeeded = Math.round(Number(form.stampsNeeded))
  const minHours = Math.round(Number(form.minHoursBetweenStamps))
  const pin = form.pin.trim()
  const expireDays = form.stampsExpireDays == null ? null : Number(form.stampsExpireDays)
  const reviewUrl = form.reviewUrl.trim()
  const closePercent = Math.round(Number(form.closeToPrizePercent))
  if (
    !businessName ||
    !prize ||
    !(stampsNeeded >= FIDELITY_MIN_STAMPS && stampsNeeded <= FIDELITY_MAX_STAMPS) ||
    !(minHours >= 0 && minHours <= FIDELITY_MAX_MIN_HOURS) ||
    !(expireDays === null || (FIDELITY_EXPIRY_OPTIONS as readonly number[]).includes(expireDays)) ||
    !(reviewUrl === '' || /^https?:\/\/\S+$/i.test(reviewUrl)) ||
    !(closePercent >= FIDELITY_MIN_CLOSE_PERCENT && closePercent <= FIDELITY_MAX_CLOSE_PERCENT)
  ) {
    return { success: false, message: 'invalidData' }
  }
  if (pin && !FIDELITY_PIN_PATTERN.test(pin)) return { success: false, message: 'invalidPin' }

  const service = getFidelityServiceClient()
  const { data: existing } = await service.from('fidelity_cards').select('id').eq('owner_id', user.id).maybeSingle()
  const settings = {
    business_name: businessName,
    prize,
    stamps_needed: stampsNeeded,
    min_hours_between_stamps: minHours,
    stamps_expire_days: expireDays,
    review_url: reviewUrl || null,
    close_to_prize_percent: closePercent,
  }

  if (!existing) {
    if (!pin) return { success: false, message: 'invalidPin' }
    const { error } = await service.from('fidelity_cards').insert({ ...settings, owner_id: user.id, pin_hash: hashPin(pin) })
    if (error) return { success: false, message: 'saveError' }
  } else {
    const update: Record<string, unknown> = { ...settings, updated_at: new Date().toISOString() }
    if (pin) {
      update.pin_hash = hashPin(pin)
      update.pin_failed_attempts = 0
      update.pin_locked_until = null
    }
    const { error } = await service.from('fidelity_cards').update(update).eq('id', existing.id)
    if (error) return { success: false, message: 'saveError' }
    // Nuovo PIN: i dispositivi sbloccati con il vecchio vanno riloggati.
    if (pin) await revokeAllCassaSessions(existing.id)
  }

  await awardToolPoint('fidelity')
  revalidatePath('/marketplace/fidelity')
  return { success: true }
}

// ============================================================
// Modalità cassa
// ============================================================

const PIN_MAX_ATTEMPTS = 5
const PIN_LOCK_MINUTES = 15

export async function unlockFidelityCassa(
  cardId: string,
  pin: string
): Promise<{ success: true } | Fail<'wrongPin' | 'locked' | 'notFound'>> {
  const service = getFidelityServiceClient()
  if (typeof cardId !== 'string' || !/^[0-9a-f-]{36}$/i.test(cardId)) return { success: false, message: 'notFound' }
  // Ogni tentativo si conta PRIMA di provare il PIN, in modo atomico: anche
  // con tante richieste insieme il blocco scatta dopo 5 tentativi.
  const { data: attempt } = await service.rpc('fidelity_pin_attempt', { p_card: cardId, p_max: PIN_MAX_ATTEMPTS, p_lock_minutes: PIN_LOCK_MINUTES })
  if (attempt === 'notfound') return { success: false, message: 'notFound' }
  if (attempt !== 'try') return { success: false, message: 'locked' }
  const { data: card } = await service.from('fidelity_cards').select('pin_hash').eq('id', cardId).maybeSingle()
  if (!card) return { success: false, message: 'notFound' }

  if (!FIDELITY_PIN_PATTERN.test(String(pin ?? '').trim()) || !verifyPin(String(pin).trim(), card.pin_hash)) {
    return { success: false, message: 'wrongPin' }
  }

  await service.from('fidelity_cards').update({ pin_failed_attempts: 0, pin_locked_until: null }).eq('id', cardId)
  await openCassaSession(cardId)
  return { success: true }
}

export async function lockFidelityCassa(cardId: string): Promise<void> {
  await closeCassaSession(cardId)
}

// "Dai timbro" / "Consegna premio": crea il QR usa e getta.
export async function createFidelityClaim(
  cardId: string,
  kind: FidelityKind,
  quantity: number
): Promise<{ success: true; code: string; expiresAt: string } | Fail<'unauthorized' | 'saveError'>> {
  if (!(await hasCassaAccess(cardId))) return { success: false, message: 'unauthorized' }

  const service = getFidelityServiceClient()
  // Pulizia opportunistica dei QR scaduti di questa tessera (nessun cron).
  await service
    .from('fidelity_claims')
    .delete()
    .eq('card_id', cardId)
    .lt('expires_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  const code = newClaimCode()
  const expiresAt = new Date(Date.now() + FIDELITY_CLAIM_TTL_SECONDS * 1000).toISOString()
  const qty = kind !== 'stamp' ? 1 : Math.min(Math.max(Math.round(quantity) || 1, 1), FIDELITY_MAX_QUANTITY)
  const { error } = await service
    .from('fidelity_claims')
    .insert({ card_id: cardId, code, kind, quantity: qty, expires_at: expiresAt })
  if (error) return { success: false, message: 'saveError' }
  // Punto KU di utilizzo: solo se in cassa c'è il titolare loggato (sui
  // dispositivi sbloccati col PIN non c'è sessione e la chiamata non fa nulla).
  await awardToolPoint('fidelity')
  return { success: true, code, expiresAt }
}

// La cassa controlla (polling) se il cliente ha già inquadrato il QR.
export async function getFidelityClaimStatus(
  cardId: string,
  code: string
): Promise<{ used: boolean; expired: boolean; lastStatus: FidelityStatus | null; memberCode: string | null; stampsCount: number | null }> {
  const none = { used: false, expired: true, lastStatus: null, memberCode: null, stampsCount: null }
  if (!(await hasCassaAccess(cardId))) return none

  const service = getFidelityServiceClient()
  const { data: claim } = await service
    .from('fidelity_claims')
    .select('used_at, expires_at, member_id, last_status')
    .eq('card_id', cardId)
    .eq('code', code)
    .maybeSingle()
  if (!claim) return none

  let memberCode: string | null = null
  let stampsCount: number | null = null
  if (claim.member_id) {
    const { data: member } = await service
      .from('fidelity_members')
      .select('member_code, stamps_count')
      .eq('id', claim.member_id)
      .maybeSingle()
    memberCode = member?.member_code ?? null
    stampsCount = member?.stamps_count ?? null
  }
  return {
    used: !!claim.used_at,
    expired: !claim.used_at && new Date(claim.expires_at).getTime() < Date.now(),
    lastStatus: (claim.last_status as FidelityStatus | null) ?? null,
    memberCode,
    stampsCount,
  }
}

export interface CassaMemberInfo {
  memberCode: string
  stampsCount: number
  stampsNeeded: number
  nextStampAt: string | null
  // Timbro bonus recensione: attivo sul negozio e non ancora ricevuto.
  reviewBonusAvailable: boolean
}

// Percorso alternativo: la cassa inquadra il QR personale del cliente.
export async function lookupFidelityMember(
  cardId: string,
  scanned: string
): Promise<{ success: true; member: CassaMemberInfo } | Fail<'unauthorized' | 'notFound'>> {
  if (!(await hasCassaAccess(cardId))) return { success: false, message: 'unauthorized' }
  const memberCode = parseMemberQr(scanned)
  if (!memberCode) return { success: false, message: 'notFound' }

  const service = getFidelityServiceClient()
  const [{ data: member }, { data: card }] = await Promise.all([
    service
      .from('fidelity_members')
      .select('member_code, stamps_count, last_stamp_at, review_bonus_at')
      .eq('card_id', cardId)
      .eq('member_code', memberCode)
      .maybeSingle(),
    service
      .from('fidelity_cards')
      .select('stamps_needed, min_hours_between_stamps, stamps_expire_days, review_url')
      .eq('id', cardId)
      .single(),
  ])
  if (!member || !card) return { success: false, message: 'notFound' }

  const next =
    member.last_stamp_at && card.min_hours_between_stamps > 0
      ? new Date(new Date(member.last_stamp_at).getTime() + card.min_hours_between_stamps * 3600 * 1000)
      : null
  return {
    success: true,
    member: {
      memberCode: member.member_code,
      stampsCount: effectiveStamps(card, member),
      stampsNeeded: card.stamps_needed,
      nextStampAt: next && next.getTime() > Date.now() ? next.toISOString() : null,
      reviewBonusAvailable: !!card.review_url && !member.review_bonus_at,
    },
  }
}

export async function applyFidelityToMember(
  cardId: string,
  memberCode: string,
  kind: FidelityKind,
  quantity: number
): Promise<{ success: true; status: FidelityStatus; stampsCount: number; stampsNeeded: number; nextStampAt: string | null } | Fail<'unauthorized' | 'notFound'>> {
  // Whitelist del tipo di operazione: il client potrebbe inviare valori arbitrari
  if (!(['stamp', 'redeem', 'review'] as const).includes(kind)) return { success: false, message: 'unauthorized' }
  if (!(await hasCassaAccess(cardId))) return { success: false, message: 'unauthorized' }

  const service = getFidelityServiceClient()
  const { data: member } = await service
    .from('fidelity_members')
    .select('id')
    .eq('card_id', cardId)
    .eq('member_code', memberCode)
    .maybeSingle()
  if (!member) return { success: false, message: 'notFound' }

  const qty = kind !== 'stamp' ? 1 : Math.min(Math.max(Math.round(quantity) || 1, 1), FIDELITY_MAX_QUANTITY)
  const { data, error } = await service.rpc('fidelity_apply', {
    p_card_id: cardId,
    p_member_id: member.id,
    p_kind: kind,
    p_quantity: qty,
  })
  const row = (data as { status: FidelityStatus; stamps_count: number; stamps_needed: number; next_stamp_at: string | null }[] | null)?.[0]
  if (error || !row) return { success: false, message: 'notFound' }

  revalidatePath('/marketplace/fidelity')
  return {
    success: true,
    status: row.status,
    stampsCount: row.stamps_count,
    stampsNeeded: row.stamps_needed,
    nextStampAt: row.next_stamp_at,
  }
}

// ============================================================
// Cliente (pubblico, senza account)
// ============================================================

export interface ClaimResult {
  status: FidelityStatus
  token: string | null
  kind: FidelityKind | null
  stampsCount: number
  stampsNeeded: number
  nextStampAt: string | null
}

// Il cliente ha inquadrato il QR usa e getta della cassa.
export async function claimFidelityCode(code: string, locale: string): Promise<ClaimResult> {
  const empty: ClaimResult = { status: 'invalid', token: null, kind: null, stampsCount: 0, stampsNeeded: 0, nextStampAt: null }
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) return empty

  const tokens = await readWalletTokens()
  const { data, error } = await getFidelityServiceClient().rpc('fidelity_use_claim', {
    p_code: code,
    p_tokens: tokens,
    p_new_token: newMemberToken(),
    p_new_member_code: newMemberCode(),
    // Lingua del cliente, per i promemoria email nella sua lingua.
    p_locale: locales.includes(locale) ? locale : null,
  })
  const row = (data as {
    status: FidelityStatus
    member_token: string | null
    kind: FidelityKind | null
    stamps_count: number
    stamps_needed: number
    next_stamp_at: string | null
  }[] | null)?.[0]
  if (error || !row) return empty

  // Anche con "too_soon" la tessera esiste: il browser la deve ricordare.
  if (row.member_token) await addWalletToken(row.member_token)

  return {
    status: row.status,
    token: row.member_token,
    kind: row.kind,
    stampsCount: row.stamps_count,
    stampsNeeded: row.stamps_needed,
    nextStampAt: row.next_stamp_at,
  }
}

// Aprendo il link della tessera (es. salvato, o su un altro browser) la si
// aggiunge al portafoglio di questo browser.
export async function rememberFidelityCard(token: string): Promise<void> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return
  const { data } = await getFidelityServiceClient().from('fidelity_members').select('id').eq('token', token).maybeSingle()
  if (data) await addWalletToken(token)
}

// ============================================================
// Cliente: contatti facoltativi (nessun servizio esterno)
// ============================================================

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/

async function findMemberByToken(token: string) {
  if (!TOKEN_PATTERN.test(token)) return null
  const { data } = await getFidelityServiceClient().from('fidelity_members').select('id').eq('token', token).maybeSingle()
  return data
}

export interface MemberContactForm {
  customerName: string
  phone: string
  marketingConsent: boolean
}

// Nome, telefono e consenso a essere contattato su WhatsApp dal negozio.
// Il token della tessera fa da credenziale: lo conosce solo il cliente.
export async function updateMemberContact(
  token: string,
  form: MemberContactForm
): Promise<{ success: true } | Fail<'notFound' | 'invalidPhone' | 'phoneRequired' | 'saveError'>> {
  const member = await findMemberByToken(token)
  if (!member) return { success: false, message: 'notFound' }
  const phone = form.phone.trim() ? normalizePhone(form.phone) : null
  if (form.phone.trim() && !phone) return { success: false, message: 'invalidPhone' }
  // Il consenso serve solo se c'è un numero a cui scrivere.
  if (form.marketingConsent && !phone) return { success: false, message: 'phoneRequired' }

  const { error } = await getFidelityServiceClient()
    .from('fidelity_members')
    .update({
      customer_name: form.customerName.trim().slice(0, 60) || null,
      contact_phone: phone,
      marketing_consent: !!form.marketingConsent,
      marketing_consent_at: form.marketingConsent ? new Date().toISOString() : null,
    })
    .eq('id', member.id)
  if (error) return { success: false, message: 'saveError' }
  return { success: true }
}

// ============================================================
// Commerciante: contatti WhatsApp ai clienti vicini al premio
// ============================================================

// Il messaggio parte dal WhatsApp del commerciante (link wa.me): qui si
// registra solo quando l'ha contattato, per non scrivere troppo spesso.
export async function markFidelityMemberContacted(memberId: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'fidelity'))) return { success: false }

  const service = getFidelityServiceClient()
  const { data: card } = await service.from('fidelity_cards').select('id').eq('owner_id', user.id).maybeSingle()
  if (!card) return { success: false }
  const { error } = await service
    .from('fidelity_members')
    .update({ last_contacted_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('card_id', card.id)
    .eq('marketing_consent', true)
  return { success: !error }
}

// Eliminazione definitiva della Kumi Card del commerciante: clienti,
// timbri, QR e dispositivi cassa spariscono a cascata. Non richiede un
// abbonamento attivo: cancellare i propri dati deve essere sempre possibile.
export async function deleteFidelityCard(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const { error } = await getFidelityServiceClient().from('fidelity_cards').delete().eq('owner_id', user.id)
  if (error) return { success: false }
  revalidatePath('/marketplace/fidelity')
  return { success: true }
}
