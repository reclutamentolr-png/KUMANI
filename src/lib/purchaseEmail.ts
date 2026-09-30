import type Stripe from 'stripe'
import { getTranslations } from 'next-intl/server'
import { getStripe } from '@/lib/stripe'
import { SITE_URL } from '@/lib/siteUrl'
import { escapeHtml, sendEmail } from '@/lib/email'
import { prettyVat } from '@/lib/vat'
import { WITHDRAWAL_DAYS } from '@/lib/withdrawal'
import { locales, defaultLocale } from '../../i18n'

// Conferma dell'acquisto su supporto durevole (Codice del Consumo, art. 51):
// email inviata a ogni fattura di abbonamento pagata (primo pagamento,
// passaggio a Pro, rinnovo) con il riepilogo e
// - privati: conferma dell'avvio immediato richiesto e diritto di recesso
//   (14 giorni, rimborso della parte non usata);
// - aziende/professionisti: dati fiscali e nessun recesso del consumatore.

type InvoiceLike = Stripe.Invoice & {
  subscription?: string | { id: string } | null
  subscription_details?: { metadata?: Record<string, string> | null } | null
}

const REASONS = { subscription_create: 'create', subscription_update: 'update', subscription_cycle: 'cycle' } as const

export async function sendPurchaseConfirmation(raw: Stripe.Invoice): Promise<void> {
  const invoice = raw as InvoiceLike
  const reason = REASONS[invoice.billing_reason as keyof typeof REASONS]
  const to = invoice.customer_email
  if (!reason || !to || !invoice.id || (invoice.amount_paid ?? 0) <= 0) return

  // Dati dell'acquisto salvati sull'abbonamento al checkout
  let meta = invoice.subscription_details?.metadata ?? null
  if (!meta?.userId) {
    const sub = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
    if (sub) meta = (await getStripe().subscriptions.retrieve(sub)).metadata
  }
  meta = meta ?? {}

  const locale = meta.locale && locales.includes(meta.locale) ? meta.locale : defaultLocale
  const t = await getTranslations({ locale, namespace: 'purchaseEmail' })
  const date = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: (invoice.currency ?? 'eur').toUpperCase() })

  // Riga principale (nel passaggio a Pro la prima è lo storno del Base)
  const main = invoice.lines.data.reduce<(typeof invoice.lines.data)[number] | undefined>(
    (best, line) => (!best || line.amount > best.amount ? line : best),
    undefined
  )
  const priceId = main?.pricing?.price_details?.price ?? (main as { price?: { id?: string } } | undefined)?.price?.id
  const plan = priceId && priceId === process.env.STRIPE_PRICE_ID_PRO ? 'KUMANI Pro' : 'KUMANI Base'
  const paidAt = (invoice.status_transitions?.paid_at ?? invoice.created) * 1000
  const validUntil = main?.period?.end ? main.period.end * 1000 : null

  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const billingUrl = `${SITE_URL}/billing`
  const termsUrl = `${SITE_URL}${prefix}/terms#sez-12`
  const isBusiness = meta.buyer_type === 'business'

  const rows: [string, string][] = [
    [t('labelPlan'), plan],
    [t('labelAmount'), money.format(invoice.amount_paid / 100)],
    [t('labelDate'), date.format(paidAt)],
    ...(validUntil ? ([[t('labelValidUntil'), date.format(validUntil)]] as [string, string][]) : []),
    ...(isBusiness ? ([[t('labelBuyer'), `${meta.business_name ?? ''} · ${prettyVat(meta.vat_number)}`]] as [string, string][]) : []),
  ]

  // Paragrafi: testo semplice; {link} diventa un collegamento nella versione HTML
  const paragraphs: { text: string; link?: string }[] = []
  if (isBusiness) {
    paragraphs.push({ text: t('businessNote', { name: meta.business_name ?? '', vat: prettyVat(meta.vat_number) }) })
  } else {
    if (meta.immediate_start_consent) paragraphs.push({ text: t('consumerConsent', { date: date.format(new Date(meta.immediate_start_consent)) }) })
    paragraphs.push({
      text: t('consumerWithdrawal', { deadline: date.format(paidAt + WITHDRAWAL_DAYS * 86_400_000), days: WITHDRAWAL_DAYS }),
      link: billingUrl,
    })
  }
  paragraphs.push({ text: t('manage'), link: billingUrl }, { text: t('terms'), link: termsUrl })

  const subject = t(`subject_${reason}`, { plan })
  const intro = t(`intro_${reason}`, { plan })

  const text = [
    t('greeting'),
    '',
    intro,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
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
${paragraphs
  .map((p) => `<p>${escapeHtml(p.text)}${p.link ? ` <a href="${escapeHtml(p.link)}" style="color:#8a6d1f">${escapeHtml(p.link)}</a>` : ''}</p>`)
  .join('\n')}
<p style="font-size:13px;color:#666">${escapeHtml(t('footer'))}</p>
<p>${escapeHtml(t('signature'))}</p>
</div></div></body></html>`

  // Gli errori sono già nei log di sendEmail: il webhook non va ripetuto per un'email
  await sendEmail({ to, subject, html, text, idempotencyKey: `purchase-${invoice.id}` })
}
