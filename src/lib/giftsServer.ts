import type Stripe from 'stripe'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { getStripe } from '@/lib/stripe'
import { SITE_URL } from '@/lib/siteUrl'
import { escapeHtml, sendEmail } from '@/lib/email'
import { prettyVat } from '@/lib/vat'
import { WITHDRAWAL_DAYS } from '@/lib/withdrawal'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { GIFT_TYPE, giftPath } from '@/lib/gifts'
import { locales, defaultLocale } from '../../i18n'

// Regali: ordine e codici dopo il pagamento (webhook, o ritorno da Stripe se
// il webhook non è ancora arrivato), rimborso, email di conferma.

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Pagamento completato: crea ordine e codici (idempotente per sessione).
// Restituisce l'id dell'ordine, oppure null se la sessione non è un regalo pagato.
export async function fulfillGiftSession(session: Stripe.Checkout.Session): Promise<string | null> {
  const meta = session.metadata ?? {}
  if (meta.type !== GIFT_TYPE || !meta.buyerId || session.payment_status !== 'paid') return null
  const quantity = Math.min(Math.max(Number(meta.quantity) || 1, 1), 10)
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null)
  const amount = session.amount_total ?? 0
  const { data, error } = await service().rpc('create_gift_order', {
    p_session_id: session.id,
    p_payment_intent: paymentIntent,
    p_buyer: meta.buyerId,
    p_kind: meta.kind,
    p_tool: meta.tool || null,
    p_plan: meta.plan || null,
    p_quantity: quantity,
    p_unit_cents: Math.round(amount / quantity),
    p_amount_cents: amount,
    p_message: meta.message || null,
    p_locale: meta.locale || defaultLocale,
  })
  if (error) throw new Error(`Regalo non creato: ${error.message}`)
  return data as string
}

// Ritorno da Stripe: se il webhook non è ancora arrivato (o in locale non
// c'è), si verifica la sessione e si creano i codici.
export async function confirmGiftSession(sessionId: string, userId: string): Promise<string | null> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return null
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId)
    if (session.metadata?.buyerId !== userId) return null
    const orderId = await fulfillGiftSession(session)
    if (orderId) await sendGiftConfirmation(session, orderId).catch((err) => console.error('⚠️ Email del regalo:', err instanceof Error ? err.message : err))
    return orderId
  } catch (err) {
    console.error('⚠️ Conferma regalo:', err instanceof Error ? err.message : err)
    return null
  }
}

// Rimborso: i codici non ancora attivati non valgono più
export async function revokeGiftForCharge(charge: Stripe.Charge): Promise<void> {
  const paymentIntent = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
  if (!paymentIntent || !charge.amount_refunded) return
  const { error } = await service().rpc('revoke_gift_payment', { p_payment_intent: paymentIntent })
  if (error) throw new Error(`Regalo non annullato: ${error.message}`)
}

// Nome di quello che si regala, nella lingua indicata
export async function giftItemName(locale: string, kind: string | null | undefined, tool: string | null | undefined, plan: string | null | undefined) {
  const t = await getTranslations({ locale, namespace: 'gifts' })
  if (kind === 'plan') return t(plan === 'pro' ? 'itemPro' : 'itemBase')
  const tm = await getTranslations({ locale, namespace: 'marketplace' })
  const service = getMarketplaceTools((key) => tm(key)).find((item) => item.toolName === tool)?.title ?? tool ?? ''
  return t('itemPass', { service })
}

// Conferma su supporto durevole con i codici e i link da mandare
// (una email per pagamento)
export async function sendGiftConfirmation(session: Stripe.Checkout.Session, orderId: string): Promise<void> {
  const meta = session.metadata ?? {}
  const to = session.customer_details?.email ?? session.customer_email
  if (!to || (session.amount_total ?? 0) <= 0) return
  const { data: codes } = await service().from('gift_codes').select('code, valid_until').eq('order_id', orderId).order('created_at')
  if (!codes?.length) return

  const locale = meta.locale && locales.includes(meta.locale) ? meta.locale : defaultLocale
  const t = await getTranslations({ locale, namespace: 'purchaseEmail' })
  const item = await giftItemName(locale, meta.kind, meta.tool, meta.plan)
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: (session.currency ?? 'eur').toUpperCase() })
  const paidAt = session.created * 1000
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const isBusiness = meta.buyer_type === 'business'
  const link = (code: string) => `${SITE_URL}${prefix}${giftPath(code)}`

  const rows: [string, string][] = [
    [t('labelGift'), item],
    [t('labelQuantity'), String(codes.length)],
    [t('labelAmount'), money.format((session.amount_total ?? 0) / 100)],
    [t('labelDate'), date.format(paidAt)],
    [t('labelRedeemBy'), date.format(new Date(codes[0].valid_until))],
    ...(isBusiness ? ([[t('labelBuyer'), `${meta.business_name ?? ''} · ${prettyVat(meta.vat_number)}`]] as [string, string][]) : []),
  ]
  const paragraphs: { text: string; link?: string }[] = [{ text: t('giftHowTo') }]
  if (isBusiness) paragraphs.push({ text: t('businessNote', { name: meta.business_name ?? '', vat: prettyVat(meta.vat_number) }) })
  else paragraphs.push({ text: t('giftWithdrawal', { days: WITHDRAWAL_DAYS }), link: `${SITE_URL}${prefix}/contact` })
  paragraphs.push({ text: t('giftManage'), link: `${SITE_URL}${prefix}/regali` })
  if (meta.terms_accepted) paragraphs.push({ text: t('termsAccepted', { date: date.format(new Date(meta.terms_accepted)) }) })
  paragraphs.push({ text: t('terms'), link: `${SITE_URL}${prefix}/terms` })

  const subject = t('subject_gift', { item })
  const intro = t('intro_gift', { item, count: codes.length })
  const text = [
    t('greeting'),
    '',
    intro,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    `${t('labelCodes')}:`,
    ...codes.map((c) => `${c.code} — ${link(c.code)}`),
    '',
    ...paragraphs.flatMap((p) => [p.link ? `${p.text} ${p.link}` : p.text, '']),
    t('footer'),
    '',
    t('signature'),
  ].join('\n')
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#111;color:#e8c872;font-weight:bold;font-size:20px;padding:16px 20px;border-radius:12px 12px 0 0">KUMANI</div>
<div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;line-height:1.5;font-size:15px">
<p>${escapeHtml(t('greeting'))}</p>
<p>${escapeHtml(intro)}</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
${rows.map(([k, v]) => `<tr><td style="padding:6px 0;color:#666">${escapeHtml(k)}</td><td style="padding:6px 0;text-align:right;font-weight:bold">${escapeHtml(v)}</td></tr>`).join('\n')}
</table>
<p style="font-weight:bold">${escapeHtml(t('labelCodes'))}</p>
${codes
  .map(
    (c) =>
      `<p style="margin:6px 0;padding:10px 12px;background:#f5f3ee;border-radius:8px"><span style="font-family:monospace;font-weight:bold;letter-spacing:1px">${escapeHtml(c.code)}</span><br><a href="${escapeHtml(link(c.code))}" style="color:#8a6d1f;font-size:13px">${escapeHtml(link(c.code))}</a></p>`
  )
  .join('\n')}
${paragraphs
  .map((p) => `<p>${escapeHtml(p.text)}${p.link ? ` <a href="${escapeHtml(p.link)}" style="color:#8a6d1f">${escapeHtml(p.link)}</a>` : ''}</p>`)
  .join('\n')}
<p style="font-size:13px;color:#666">${escapeHtml(t('footer'))}</p>
<p>${escapeHtml(t('signature'))}</p>
</div></div></body></html>`

  await sendEmail({ to, subject, html, text, idempotencyKey: `gift-${session.id}` })
}
