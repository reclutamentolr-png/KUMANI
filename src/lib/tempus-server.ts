import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { escapeHtml, sendEmail } from '@/lib/email'
import { SITE_URL } from '@/lib/siteUrl'
import { localizedPath } from '@/lib/push'
import { cleanHours, formatPrice, formatWhen, type BusyRange, type TempusClosure, type TempusService, type TempusSettings } from '@/lib/tempus'

// KUMANI TEMPUS lato server: la pagina pubblica (letta con la chiave di
// servizio, solo se pubblicata e visibile) e le email a clienti e titolari.

export const tempusDb = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export const SETTINGS_COLUMNS =
  'slug, is_published, title, intro, show_prices, timezone, slot_step, buffer_min, min_notice_min, max_days_ahead, cancel_limit_hours, hours, suspended, suspended_reason'
export const SERVICE_COLUMNS = 'id, name, description, duration_min, price_cents, active, sort'
export const BOOKING_COLUMNS =
  'id, service_id, service_name, duration_min, price_cents, starts_at, ends_at, customer_name, customer_phone, customer_email, customer_note, owner_note, status, cancelled_by, source, created_at'

export function settingsFromRow(row: Record<string, unknown>): TempusSettings {
  return { ...(row as unknown as TempusSettings), hours: cleanHours(row.hours) }
}

// Dati dell'attività dalla Scheda attività (nome, logo, indirizzo, contatti)
export type TempusBusiness = { name: string; logoUrl: string | null; address: string; phone: string; whatsapp: string; email: string; accent: string }

export async function loadBusiness(ownerId: string): Promise<TempusBusiness> {
  const db = tempusDb()
  const { data } = await db.from('quote_issuer_profiles').select('company_name, logo_path, address, city, phone, whatsapp, email, accent').eq('user_id', ownerId).maybeSingle()
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
  return {
    name: str(data?.company_name),
    logoUrl: data?.logo_path ? db.storage.from('quote-logos-v2').getPublicUrl(data.logo_path as string).data.publicUrl : null,
    address: [str(data?.address), str(data?.city)].filter(Boolean).join(', '),
    phone: str(data?.phone),
    whatsapp: str(data?.whatsapp),
    email: str(data?.email),
    accent: /^#[0-9a-f]{6}$/i.test(str(data?.accent)) ? str(data?.accent) : '',
  }
}

export type PublicTempus = { ownerId: string; settings: TempusSettings; services: TempusService[]; business: TempusBusiness; displayName: string }

export async function loadPublicTempus(slug: string): Promise<PublicTempus | null> {
  if (typeof slug !== 'string' || slug.length > 40) return null
  const { data: ownerId } = await tempusDb().rpc('tempus_public_owner', { p_slug: slug })
  return ownerId ? loadTempusOf(ownerId as string) : null
}

// Pagina vista da chi la apre: pubblica per tutti; non ancora pubblicata
// (o sospesa) solo per il titolare, come anteprima senza prenotazioni
export async function loadTempusForViewer(slug: string, viewerId: string | null): Promise<{ page: PublicTempus; preview: boolean } | null> {
  const page = await loadPublicTempus(slug)
  if (page) return { page, preview: false }
  if (!viewerId || typeof slug !== 'string') return null
  const { data } = await tempusDb().from('tempus_pages').select('owner_id').eq('slug', slug.toLowerCase()).maybeSingle()
  if (data?.owner_id !== viewerId) return null
  const own = await loadTempusOf(viewerId)
  return own ? { page: own, preview: true } : null
}

async function loadTempusOf(ownerId: string): Promise<PublicTempus | null> {
  const db = tempusDb()
  const [{ data: page }, { data: services }, business] = await Promise.all([
    db.from('tempus_pages').select(SETTINGS_COLUMNS).eq('owner_id', ownerId).maybeSingle(),
    db.from('tempus_services').select(SERVICE_COLUMNS).eq('owner_id', ownerId).eq('active', true).order('sort').order('created_at'),
    loadBusiness(ownerId as string),
  ])
  if (!page) return null
  const settings = settingsFromRow(page as Record<string, unknown>)
  return {
    ownerId: ownerId as string,
    settings,
    services: (services ?? []) as TempusService[],
    business,
    displayName: settings.title || business.name || settings.slug,
  }
}

export async function loadBusy(ownerId: string, fromIso: string, toIso: string): Promise<BusyRange[]> {
  const { data } = await tempusDb()
    .from('tempus_bookings')
    .select('starts_at, blocked_until')
    .eq('owner_id', ownerId)
    .neq('status', 'cancelled')
    .lt('starts_at', toIso)
    .gt('blocked_until', fromIso)
  return (data ?? []) as BusyRange[]
}

export async function loadClosures(ownerId: string, fromDay: string): Promise<TempusClosure[]> {
  const { data } = await tempusDb().from('tempus_closures').select('id, starts_on, ends_on, note').eq('owner_id', ownerId).gte('ends_on', fromDay).order('starts_on')
  return (data ?? []) as TempusClosure[]
}

// --- Email -----------------------------------------------------------------

function emailHtml(lines: string[], button?: { label: string; url: string }, small?: string[]) {
  return `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#111;color:#e8c872;font-weight:bold;font-size:20px;padding:16px 20px;border-radius:12px 12px 0 0">KUMANI TEMPUS</div>
<div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;line-height:1.5;font-size:15px">
${lines.map((line) => `<p>${escapeHtml(line).replace(/\n/g, '<br>')}</p>`).join('\n')}
${button ? `<p style="text-align:center"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#111;color:#e8c872;font-weight:bold;text-decoration:none;padding:12px 20px;border-radius:10px">${escapeHtml(button.label)}</a></p>` : ''}
${(small ?? []).map((line) => `<p style="font-size:13px;color:#555">${escapeHtml(line)}</p>`).join('\n')}
</div></div></body></html>`
}

type BookingForEmail = {
  id: string
  service_name: string
  price_cents: number | null
  starts_at: string
  customer_name: string
  customer_phone: string
  customer_email: string | null
  customer_note: string | null
  cancel_token: string
  locale: string
}

type BusinessForEmail = { displayName: string; timezone: string; address: string; phone: string; showPrices: boolean; cancelLimitHours: number }

const cancelUrl = (locale: string, token: string) => `${SITE_URL}${localizedPath(locale, `/prenota/disdici/${token}`)}`

// Al cliente: prenotazione confermata (con il link per disdire)
export async function emailCustomerConfirmed(b: BookingForEmail, biz: BusinessForEmail) {
  if (!b.customer_email) return
  const t = await getTranslations({ locale: b.locale, namespace: 'tempusEmail' })
  const when = formatWhen(b.starts_at, biz.timezone, b.locale)
  const price = biz.showPrices ? formatPrice(b.price_cents, b.locale) : ''
  const lines = [
    t('hello', { name: b.customer_name }),
    t('confirmedBody', { business: biz.displayName }),
    `${t('service')}: ${b.service_name}${price ? ` · ${price}` : ''}\n${t('when')}: ${when}${biz.address ? `\n${t('where')}: ${biz.address}` : ''}${biz.phone ? `\n${t('phone')}: ${biz.phone}` : ''}`,
  ]
  const small = [biz.cancelLimitHours ? t('cancelRule', { hours: biz.cancelLimitHours }) : t('cancelAnytime'), t('footer')]
  const url = cancelUrl(b.locale, b.cancel_token)
  await sendEmail({
    to: b.customer_email,
    subject: t('confirmedSubject', { business: biz.displayName, when }),
    html: emailHtml(lines, { label: t('manageButton'), url }, small),
    text: [...lines, `${t('manageButton')}: ${url}`, ...small].join('\n\n'),
    idempotencyKey: `tempus-confirmed-${b.id}`,
  }).catch((err) => console.error('[TEMPUS] conferma non inviata:', err))
}

// Al cliente: il titolare ha annullato
export async function emailCustomerCancelled(b: BookingForEmail, biz: BusinessForEmail, message: string) {
  if (!b.customer_email) return
  const t = await getTranslations({ locale: b.locale, namespace: 'tempusEmail' })
  const when = formatWhen(b.starts_at, biz.timezone, b.locale)
  const lines = [
    t('hello', { name: b.customer_name }),
    t('cancelledByOwnerBody', { business: biz.displayName, service: b.service_name, when }),
    ...(message ? [`«${message}»`] : []),
    ...(biz.phone ? [t('callToRebook', { phone: biz.phone })] : []),
  ]
  await sendEmail({
    to: b.customer_email,
    subject: t('cancelledSubject', { business: biz.displayName }),
    html: emailHtml(lines, undefined, [t('footer')]),
    text: [...lines, t('footer')].join('\n\n'),
    idempotencyKey: `tempus-cancelled-${b.id}`,
  }).catch((err) => console.error('[TEMPUS] avviso di annullamento non inviato:', err))
}

// Al cliente: promemoria del giorno prima
export async function emailCustomerReminder(b: BookingForEmail, biz: BusinessForEmail) {
  if (!b.customer_email) return false
  const t = await getTranslations({ locale: b.locale, namespace: 'tempusEmail' })
  const when = formatWhen(b.starts_at, biz.timezone, b.locale)
  const lines = [
    t('hello', { name: b.customer_name }),
    t('reminderBody', { business: biz.displayName, service: b.service_name, when }),
    ...(biz.address ? [`${t('where')}: ${biz.address}`] : []),
  ]
  const result = await sendEmail({
    to: b.customer_email,
    subject: t('reminderSubject', { business: biz.displayName, when }),
    html: emailHtml(lines, { label: t('manageButton'), url: cancelUrl(b.locale, b.cancel_token) }, [t('footer')]),
    text: [...lines, `${t('manageButton')}: ${cancelUrl(b.locale, b.cancel_token)}`, t('footer')].join('\n\n'),
    idempotencyKey: `tempus-reminder-${b.id}`,
  }).catch(() => ({ sent: false }))
  return result.sent
}

// Al titolare: nuova prenotazione o disdetta del cliente
export async function emailOwner(ownerId: string, ownerLocale: string, kind: 'new' | 'cancelled', b: BookingForEmail, timezone: string) {
  const { data } = await tempusDb().auth.admin.getUserById(ownerId)
  const to = data.user?.email
  if (!to) return
  const t = await getTranslations({ locale: ownerLocale, namespace: 'tempusEmail' })
  const when = formatWhen(b.starts_at, timezone, ownerLocale)
  const contact = [b.customer_phone, b.customer_email].filter(Boolean).join(' · ')
  const lines = [
    kind === 'new' ? t('ownerNewBody', { name: b.customer_name, service: b.service_name, when }) : t('ownerCancelledBody', { name: b.customer_name, service: b.service_name, when }),
    ...(contact ? [`${t('contact')}: ${contact}`] : []),
    ...(kind === 'new' && b.customer_note ? [`${t('note')}: ${b.customer_note}`] : []),
  ]
  const url = `${SITE_URL}${localizedPath(ownerLocale, '/marketplace/tempus')}`
  await sendEmail({
    to,
    subject: kind === 'new' ? t('ownerNewSubject', { name: b.customer_name, when }) : t('ownerCancelledSubject', { name: b.customer_name, when }),
    html: emailHtml(lines, { label: t('openAgenda'), url }, [t('ownerFooter')]),
    text: [...lines, `${t('openAgenda')}: ${url}`, t('ownerFooter')].join('\n\n'),
    idempotencyKey: `tempus-owner-${kind}-${b.id}`,
  }).catch((err) => console.error('[TEMPUS] email al titolare non inviata:', err))
}
