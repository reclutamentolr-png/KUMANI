import type Stripe from 'stripe'
import { randomBytes } from 'node:crypto'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'
import { notifyUser } from '@/lib/push'
import {
  DEFAULT_SURPRISE_PRICES,
  isSurpriseKind,
  SURPRISE_KINDS,
  SURPRISE_PRICE_KEYS,
  SURPRISE_TYPE,
  surpriseDays,
  unlockAt,
  voucherUnlockAt,
  type SurpriseKind,
  type SurpriseRow,
  type SurpriseStepRow,
  type SurpriseView,
} from '@/lib/surprise'

// KUMANI Sorpresa lato server: prezzi, pagamento (ritorno da Stripe e
// webhook), rimborso e pagina pubblica di chi riceve.

export const surpriseDb = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export async function getSurprisePrices(): Promise<Record<SurpriseKind, number>> {
  const prices = { ...DEFAULT_SURPRISE_PRICES }
  try {
    const { data } = await surpriseDb().from('system_settings').select('key, value').in('key', Object.values(SURPRISE_PRICE_KEYS))
    for (const kind of SURPRISE_KINDS) {
      const raw = data?.find((r) => r.key === SURPRISE_PRICE_KEYS[kind])?.value
      const cents = Number(String(raw ?? '').replace(/"/g, ''))
      if (Number.isInteger(cents) && cents >= 50) prices[kind] = cents
    }
  } catch {
    // prezzi predefiniti
  }
  return prices
}

const newToken = () => randomBytes(16).toString('base64url')

// Pagamento riuscito: la sorpresa diventa attiva con il suo link. Si può
// chiamare più volte (ritorno dal pagamento e webhook): la seconda non fa nulla.
export async function fulfillSurpriseSession(session: Stripe.Checkout.Session): Promise<string | null> {
  const meta = session.metadata ?? {}
  if (meta.type !== SURPRISE_TYPE || !meta.buyerId || !meta.giftId || session.payment_status !== 'paid') return null
  const db = surpriseDb()
  const { data: gift } = await db.from('surprise_gifts').select('id, user_id, status, start_at, public_token').eq('id', meta.giftId).maybeSingle()
  if (!gift || gift.user_id !== meta.buyerId) return null
  if (gift.status === 'active' && gift.public_token) return gift.id as string
  const kind = isSurpriseKind(meta.kind) ? meta.kind : 'voucher'
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null)
  const { error } = await db
    .from('surprise_gifts')
    .update({
      status: 'active',
      kind,
      public_token: gift.public_token ?? newToken(),
      paid_at: new Date().toISOString(),
      amount_cents: session.amount_total ?? null,
      stripe_session_id: session.id,
      stripe_payment_intent: paymentIntent,
      start_at: gift.start_at ?? new Date().toISOString(),
    })
    .eq('id', gift.id)
    .eq('status', 'draft')
  if (error) throw new Error(error.message)
  return gift.id as string
}

// Ritorno da Stripe (se il webhook arriva dopo)
export async function confirmSurpriseSession(sessionId: string, userId: string): Promise<boolean> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return false
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (session.metadata?.buyerId !== userId) return false
    return !!(await fulfillSurpriseSession(session))
  } catch (error) {
    console.error('[sorpresa] conferma pagamento:', error instanceof Error ? error.message : error)
    return false
  }
}

// Rimborso: il link non si apre più
export async function revokeSurpriseForCharge(charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!pi) return
  await surpriseDb().from('surprise_gifts').update({ refunded_at: new Date().toISOString() }).eq('stripe_payment_intent', pi).is('refunded_at', null)
}

async function signed(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (!unique.length) return new Map()
  const { data } = await surpriseDb().storage.from('surprise-media').createSignedUrls(unique, 6 * 3600)
  return new Map((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]))
}

// Contenuto da mostrare: con revealAll (anteprima di chi crea) tutto aperto;
// altrimenti solo le tappe già arrivate al loro momento.
export async function buildSurpriseView(gift: SurpriseRow, steps: SurpriseStepRow[], revealAll: boolean): Promise<SurpriseView> {
  const days = surpriseDays(gift.kind)
  const startAt = gift.start_at ?? new Date().toISOString()
  const now = Date.now()
  const visibleSteps = gift.kind === 'voucher' ? [] : [...steps].sort((a, b) => a.day - b.day || a.position - b.position)
  const opened = visibleSteps.map((s) => {
    const day = Math.min(s.day, days)
    const at = unlockAt(startAt, day)
    return { s, day, at, open: revealAll || at.getTime() <= now }
  })
  const voucherAt = voucherUnlockAt(startAt, gift.kind)
  const voucherOpen = revealAll || voucherAt.getTime() <= now
  const urls = await signed([
    ...opened.filter((o) => o.open && o.s.media_path).map((o) => o.s.media_path as string),
    ...(voucherOpen && gift.cover_path ? [gift.cover_path] : []),
  ])
  return {
    kind: gift.kind,
    theme: gift.theme,
    recipientName: gift.recipient_name,
    senderName: gift.sender_name,
    startAt,
    days,
    steps: opened.map(({ s, day, at, open }) =>
      open
        ? {
            id: s.id,
            day,
            unlockAt: at.toISOString(),
            open: true,
            title: s.title,
            message: s.message,
            hint: s.hint,
            mediaUrl: s.media_path ? (urls.get(s.media_path) ?? null) : null,
            mediaType: s.media_type,
          }
        : { id: s.id, day, unlockAt: at.toISOString(), open: false }
    ),
    voucher: voucherOpen
      ? {
          unlockAt: voucherAt.toISOString(),
          open: true,
          title: gift.title,
          message: gift.message,
          howToUse: gift.how_to_use,
          validUntil: gift.valid_until,
          coverUrl: gift.cover_path ? (urls.get(gift.cover_path) ?? null) : null,
        }
      : { unlockAt: voucherAt.toISOString(), open: false },
  }
}

// Pagina pubblica: sorpresa attiva e non rimborsata. La prima apertura viene
// segnata e chi l'ha creata riceve una notifica.
export async function loadPublicSurprise(token: string): Promise<SurpriseView | null> {
  if (!/^[A-Za-z0-9_-]{16,40}$/.test(token)) return null
  const db = surpriseDb()
  const { data: gift } = await db.from('surprise_gifts').select('*').eq('public_token', token).eq('status', 'active').is('refunded_at', null).maybeSingle()
  if (!gift) return null
  const { data: steps } = await db.from('surprise_steps').select('id, day, position, title, message, hint, media_path, media_type').eq('gift_id', gift.id)
  if (!gift.opened_at) {
    const { data: marked } = await db.from('surprise_gifts').update({ opened_at: new Date().toISOString() }).eq('id', gift.id).is('opened_at', null).select('id')
    if (marked?.length) {
      await notifyUser(
        gift.user_id as string,
        'messages',
        (t, locale) => ({
          title: t('surpriseOpenedTitle'),
          body: t('surpriseOpenedBody', { name: (gift.recipient_name as string) || '—' }),
          url: `${locale === 'it' ? '' : `/${locale}`}/sorprese/${gift.id}`,
          tag: `surprise-${gift.id}`,
        }),
        { kind: 'surprise_opened', ref: gift.id as string }
      )
    }
  }
  return buildSurpriseView(gift as SurpriseRow, (steps ?? []) as SurpriseStepRow[], false)
}
