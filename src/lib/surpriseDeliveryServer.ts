import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { getTranslations } from 'next-intl/server'
import { locales, defaultLocale } from '../../i18n'
import { escapeHtml, sendEmail } from '@/lib/email'
import { localizedPath, notifyUser } from '@/lib/push'
import { PUBLIC_SITE_URL } from '@/lib/siteUrl'
import { surpriseDb } from '@/lib/surpriseServer'
import { bookingLabel, deliveryManagePath, DELIVERY_CODE_RE, firstName, type DeliveryRow } from '@/lib/surpriseDelivery'

// «Regalo con consegna» lato server: link segreto di chi consegna, email e
// avvisi a chi ha regalato. Nei log non finiscono mai nomi, email o telefoni.

// Link segreto: si ricava dalla sorpresa e da un numero casuale salvato nel
// database (manage_nonce) con una chiave che il database non ha. Nel database
// resta solo l'impronta (sha256) per ritrovarlo.
const secret = () => process.env.SURPRISE_DELIVERY_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!
export const deliveryToken = (giftId: string, nonce: string) => createHmac('sha256', secret()).update(`surprise-delivery:${giftId}:${nonce}`).digest('base64url')
export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

export type DeliveryFull = DeliveryRow & {
  user_id: string
  manage_nonce: string
  manage_token_hash: string | null
  link_sent_at: string | null
  gift: {
    id: string
    user_id: string
    status: string
    refunded_at: string | null
    kind: string
    start_at: string | null
    title: string
    recipient_name: string
    sender_name: string
    valid_until: string | null
    locale: string
    opened_at: string | null
    link_opened_at: string | null
  }
}

const FULL_SELECT =
  '*, gift:surprise_gifts!inner(id, user_id, status, refunded_at, kind, start_at, title, recipient_name, sender_name, valid_until, locale, opened_at, link_opened_at)'

export async function deliveryByCode(code: string): Promise<DeliveryFull | null> {
  if (!DELIVERY_CODE_RE.test(code)) return null
  const { data } = await surpriseDb().from('surprise_deliveries').select(FULL_SELECT).eq('code', code).maybeSingle()
  return (data as unknown as DeliveryFull | null) ?? null
}

export async function deliveryByGift(giftId: string): Promise<DeliveryFull | null> {
  const { data } = await surpriseDb().from('surprise_deliveries').select(FULL_SELECT).eq('gift_id', giftId).maybeSingle()
  return (data as unknown as DeliveryFull | null) ?? null
}

// Il link segreto (dal cookie o dall'indirizzo) apre questo buono?
export function tokenMatches(d: Pick<DeliveryFull, 'gift_id' | 'manage_nonce' | 'manage_token_hash'>, token: string | undefined | null): boolean {
  if (!token || !TOKEN_RE.test(token) || !d.manage_token_hash) return false
  const expected = Buffer.from(deliveryToken(d.gift_id, d.manage_nonce))
  const given = Buffer.from(token)
  return expected.length === given.length && timingSafeEqual(expected, given) && tokenHash(token) === d.manage_token_hash
}

// Buono valido (sorpresa attiva, non rimborsata). Scaduto: si vede, ma la
// consegna si può ancora segnare (chi consegna decide se accettarlo).
export const giftLive = (d: DeliveryFull) => d.gift.status === 'active' && !d.gift.refunded_at
export const giftExpired = (d: DeliveryFull) => !!d.gift.valid_until && new Date(`${d.gift.valid_until}T23:59:59+01:00`).getTime() < Date.now()

const emailLocale = (value: string | null | undefined) => (value && locales.includes(value) ? value : defaultLocale)

// Email con l'aspetto delle altre di KUMANI (senza immagini né pixel)
function emailHtml(lines: string[], extra: { list?: [string, string][]; cta?: { label: string; url: string }; foot?: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#111;color:#e8c872;font-weight:bold;font-size:20px;padding:16px 20px;border-radius:12px 12px 0 0">KUMANI · 🎁</div>
<div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;line-height:1.5;font-size:15px">
${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join('\n')}
${
  extra.list?.length
    ? `<table role="presentation" style="width:100%;background:#faf3dc;border-radius:10px;padding:12px;border-collapse:separate">${extra.list
        .map(([k, v]) => `<tr><td style="padding:4px 8px;font-weight:bold;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:4px 8px;white-space:pre-wrap">${escapeHtml(v)}</td></tr>`)
        .join('')}</table>`
    : ''
}
${extra.cta ? `<p style="margin-top:20px"><a href="${escapeHtml(extra.cta.url)}" style="display:inline-block;background:#111;color:#e8c872;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:bold">${escapeHtml(extra.cta.label)} →</a></p>` : ''}
${extra.foot ? `<p style="font-size:12px;color:#777;margin-top:20px">${escapeHtml(extra.foot)}</p>` : ''}
</div></div></body></html>`
}

function emailText(lines: string[], extra: { list?: [string, string][]; cta?: { label: string; url: string }; foot?: string }) {
  return [...lines, ...(extra.list ?? []).map(([k, v]) => `${k} ${v}`), extra.cta ? `${extra.cta.label}: ${extra.cta.url}` : '', extra.foot ?? ''].filter(Boolean).join('\n\n')
}

// Link segreto pronto (e la sua impronta salvata, la prima volta)
async function manageUrl(d: DeliveryFull, locale: string): Promise<string | null> {
  const token = deliveryToken(d.gift_id, d.manage_nonce)
  if (!d.manage_token_hash) {
    const { error } = await surpriseDb().from('surprise_deliveries').update({ manage_token_hash: tokenHash(token) }).eq('gift_id', d.gift_id).is('manage_token_hash', null)
    if (error) {
      console.error('[consegna] impronta del link non salvata:', error.message)
      return null
    }
    d.manage_token_hash = tokenHash(token)
  }
  // Il link segreto sta dopo il # : non arriva ai server né ai loro registri
  return `${PUBLIC_SITE_URL}${localizedPath(locale, deliveryManagePath(d.code))}#k=${token}`
}

const names = (d: DeliveryFull, t: (k: string) => string) => ({
  to: d.gift.recipient_name.trim() || t('dlvSomeone'),
  from: d.gift.sender_name.trim() || t('dlvSomeone'),
  provider: firstName(d.provider_name) || d.provider_name,
  title: d.gift.title.trim() || '—',
})

// A chi consegna: «Mattia vuole ritirare il regalo di Marco», con i dettagli
export async function emailProviderRequest(d: DeliveryFull, req: { when: string; contact: string; note: string }): Promise<boolean> {
  const locale = emailLocale(d.gift.locale)
  const t = await getTranslations({ locale, namespace: 'surprise' })
  const n = names(d, (k) => t(k))
  const url = await manageUrl(d, locale)
  if (!url) return false
  const lines = [t('dlvMailHello', { name: n.provider }), t('dlvMailIntro', { to: n.to, from: n.from, title: n.title })]
  const list: [string, string][] = [
    [t('dlvMailWhen'), req.when || '—'],
    [t('dlvMailContact'), req.contact],
    ...(req.note ? ([[t('dlvMailNote'), req.note]] as [string, string][]) : []),
    [t('dlvMailCode'), d.code],
  ]
  const extra = { list, cta: { label: t('dlvManageCta'), url }, foot: `${t('dlvMailHow')} ${t('dlvMailWhy', { from: n.from })}` }
  const r = await sendEmail({ to: d.provider_email, subject: t('dlvMailSubject', { to: n.to, from: n.from }), html: emailHtml(lines, extra), text: emailText(lines, extra) })
  if (!r.sent) console.error('[consegna] email a chi consegna non partita:', r.error)
  else await surpriseDb().from('surprise_deliveries').update({ link_sent_at: new Date().toISOString() }).eq('gift_id', d.gift_id)
  return r.sent
}

// A chi consegna: solo il link (chiesto dalla pagina del QR)
export async function emailProviderLink(d: DeliveryFull): Promise<boolean> {
  const locale = emailLocale(d.gift.locale)
  const t = await getTranslations({ locale, namespace: 'surprise' })
  const n = names(d, (k) => t(k))
  const url = await manageUrl(d, locale)
  if (!url) return false
  const lines = [t('dlvMailHello', { name: n.provider }), t('dlvLinkIntro', { title: n.title, code: d.code, to: n.to, from: n.from })]
  const extra = { cta: { label: t('dlvManageCta'), url }, foot: `${t('dlvMailHow')} ${t('dlvLinkIgnore')}` }
  const r = await sendEmail({ to: d.provider_email, subject: t('dlvLinkSubject', { code: d.code }), html: emailHtml(lines, extra), text: emailText(lines, extra) })
  if (!r.sent) console.error('[consegna] link per chi consegna non partito:', r.error)
  return r.sent
}

const ownerUrl = (locale: string, giftId: string) => localizedPath(locale, `/sorprese/${giftId}`)

// Avvisi nella campanella di chi ha regalato (e sul telefono, se attive)
export async function notifyOwnerStep(d: DeliveryFull, step: 'requested' | 'booked' | 'delivered', ref?: string) {
  const to = d.gift.recipient_name.trim() || '—'
  const provider = firstName(d.provider_name) || d.provider_name
  await notifyUser(
    d.gift.user_id,
    'messages',
    (t, locale) => ({
      title: t(`surpriseDlv_${step}_title`),
      body:
        step === 'booked'
          ? t('surpriseDlv_booked_body', { to, when: bookingLabel(d.booking_text, d.booking_at, locale) || '—' })
          : t(`surpriseDlv_${step}_body`, { to, provider }),
      url: ownerUrl(locale, d.gift_id),
      tag: `surprise-dlv-${d.gift_id}`,
    }),
    { kind: `surprise_dlv_${step}`, ref: ref ?? d.gift_id }
  )
}

// Email a chi ha regalato quando il regalo è consegnato (non a chi ha detto
// «non voglio più email da KUMANI»: resta l'avviso nella campanella)
export async function emailOwnerDelivered(d: DeliveryFull) {
  const db = surpriseDb()
  const [{ data: profile }, { data: off }] = await Promise.all([
    db.from('profiles').select('email').eq('id', d.gift.user_id).maybeSingle(),
    db.from('email_unsubscribes').select('user_id').eq('user_id', d.gift.user_id).maybeSingle(),
  ])
  if (!profile?.email || off) return
  const locale = emailLocale(d.gift.locale)
  const t = await getTranslations({ locale, namespace: 'surprise' })
  const to = d.gift.recipient_name.trim() || '—'
  const provider = d.provider_name
  const lines = [t('dlvDoneIntro', { provider, title: d.gift.title.trim() || '—', to }), t('dlvDoneThanks', { to })]
  const extra = { cta: { label: t('dlvDoneCta'), url: `${PUBLIC_SITE_URL}${ownerUrl(locale, d.gift_id)}` } }
  await sendEmail({
    to: profile.email as string,
    subject: t('dlvDoneSubject', { to }),
    html: emailHtml(lines, extra),
    text: emailText(lines, extra),
    idempotencyKey: `surprise-dlv-done-${d.gift_id}`,
  })
}
