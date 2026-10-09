import type Stripe from 'stripe'
import { getTranslations } from 'next-intl/server'
import { serviceDb } from '@/lib/shopPayments'
import { localizedPath, notifyUser } from '@/lib/push'
import { escapeHtml, sendEmail } from '@/lib/email'
import { SITE_URL } from '@/lib/siteUrl'
import { formatCents, shopPath, type ShopOrder, type ShopOrderItem, type ShopProduct, type ShopSettings, type ShipAddress, type OrderStatus } from '@/lib/shop'
import { defaultLocale, locales } from '../../i18n'

// KUMANI Shop (fase 2): parte server del negozio, usata dalle azioni, dalla
// pagina pubblica e dal webhook di Stripe Connect.

/* eslint-disable @typescript-eslint/no-explicit-any */
export const mapSettings = (row: any): ShopSettings => ({
  slug: row.slug,
  name: row.name,
  description: row.description ?? '',
  coverPath: row.cover_path ?? null,
  isOpen: !!row.is_open,
  pickupEnabled: !!row.pickup_enabled,
  pickupInfo: row.pickup_info ?? '',
  shippingEnabled: !!row.shipping_enabled,
  shippingItCents: row.shipping_it_cents ?? 0,
  shippingEuCents: row.shipping_eu_cents ?? null,
  freeShippingOverCents: row.free_shipping_over_cents ?? null,
  returnsPolicy: row.returns_policy ?? '',
})

export const mapProduct = (row: any, inventoryStock?: Map<string, number>): ShopProduct => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  priceCents: row.price_cents,
  imagePath: row.image_path ?? null,
  inventoryProductId: row.inventory_product_id ?? null,
  stock: row.inventory_product_id ? Math.max(Math.floor(inventoryStock?.get(row.inventory_product_id) ?? 0), 0) : (row.stock ?? null),
  isActive: !!row.is_active,
  position: row.position ?? 0,
})

export const mapOrder = (row: any): ShopOrder => ({
  id: row.id,
  number: row.number ?? null,
  status: row.status,
  customerName: row.customer_name,
  customerEmail: row.customer_email,
  customerPhone: row.customer_phone ?? null,
  delivery: row.delivery,
  shipAddress: (row.ship_address as ShipAddress | null) ?? null,
  notes: row.notes ?? null,
  items: (row.items as ShopOrderItem[]) ?? [],
  subtotalCents: row.subtotal_cents,
  shippingCents: row.shipping_cents,
  totalCents: row.total_cents,
  trackingNumber: row.tracking_number ?? null,
  trackingUrl: row.tracking_url ?? null,
  createdAt: row.created_at,
  paidAt: row.paid_at ?? null,
  shippedAt: row.shipped_at ?? null,
})
/* eslint-enable @typescript-eslint/no-explicit-any */

export const shopImageUrl = (path: string | null) => (path ? serviceDb().storage.from('shop-media').getPublicUrl(path).data.publicUrl : null)

// Giacenze del Magazzino per i prodotti collegati
export async function inventoryStock(ownerId: string, ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map()
  const { data } = await serviceDb().from('inventory_products').select('id, stock').eq('owner_id', ownerId).in('id', ids)
  return new Map((data ?? []).map((r) => [r.id as string, Number(r.stock)]))
}

export type SellerInfo = { name: string; vat: string | null; address: string; email: string | null; phone: string | null; logoUrl: string | null }

export type PublicShop = {
  ownerId: string
  settings: ShopSettings
  products: (ShopProduct & { imageUrl: string | null })[]
  coverUrl: string | null
  seller: SellerInfo
  stripeAccountId: string
}

// Negozio aperto a tutti: aperto dal venditore, piano Pro attivo, conto
// Stripe pronto a ricevere pagamenti. Altrimenti non esiste (404).
export async function loadPublicShop(slug: string): Promise<PublicShop | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null
  const db = serviceDb()
  const { data: row } = await db.from('shop_settings').select('*').eq('slug', slug).eq('is_open', true).maybeSingle()
  if (!row) return null
  const ownerId = row.owner_id as string
  const [{ data: visible }, { data: account }, { data: issuer }, { data: products }] = await Promise.all([
    db.rpc('public_page_visible', { p_owner: ownerId, p_tool: 'shop' }),
    db.from('seller_stripe_accounts').select('stripe_account_id, charges_enabled').eq('user_id', ownerId).maybeSingle(),
    db.from('quote_issuer_profiles').select('company_name, vat_number, address, postal_code, city, province, email, phone, logo_path').eq('user_id', ownerId).maybeSingle(),
    db.from('shop_products').select('*').eq('owner_id', ownerId).eq('is_active', true).order('position').order('created_at'),
  ])
  if (!visible || !account?.charges_enabled) return null
  const stock = await inventoryStock(ownerId, (products ?? []).map((p) => p.inventory_product_id).filter(Boolean) as string[])
  const settings = mapSettings(row)
  return {
    ownerId,
    settings,
    products: (products ?? []).map((p) => ({ ...mapProduct(p, stock), imageUrl: shopImageUrl(p.image_path) })),
    coverUrl: shopImageUrl(settings.coverPath),
    stripeAccountId: account.stripe_account_id as string,
    seller: {
      name: issuer?.company_name || settings.name,
      vat: issuer?.vat_number || null,
      address: [issuer?.address, [issuer?.postal_code, issuer?.city].filter(Boolean).join(' '), issuer?.province].filter(Boolean).join(', '),
      email: issuer?.email || null,
      phone: issuer?.phone || null,
      logoUrl: issuer?.logo_path ? db.storage.from('quote-logos-v2').getPublicUrl(issuer.logo_path).data.publicUrl : null,
    },
  }
}

const pickLocale = (value: string | null | undefined) => (value && locales.includes(value) ? value : defaultLocale)
const orderUrl = (locale: string, slug: string, token: string) => `${SITE_URL}${localizedPath(locale, `${shopPath(slug)}/ordine/${token}`)}`

// Pagamento arrivato (webhook o ritorno dal pagamento): ordine pagato e
// numerato, giacenze scalate, email al cliente e avviso al venditore. Idempotente.
export async function recordShopOrderPayment(session: Stripe.Checkout.Session): Promise<boolean> {
  const orderId = session.metadata?.order_id
  if (!orderId || session.payment_status !== 'paid') return false
  const db = serviceDb()
  const paymentIntent = typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null)
  const { data: number, error } = await db.rpc('shop_mark_order_paid', { p_order: orderId, p_session: session.id, p_payment_intent: paymentIntent })
  if (error) {
    console.error('[Shop] ordine non registrato:', error.message)
    return false
  }
  if (number == null) return false
  const { data: row } = await db.from('shop_orders').select('*').eq('id', orderId).maybeSingle()
  if (!row) return false
  const order = mapOrder(row)
  const { data: shop } = await db.from('shop_settings').select('slug, name').eq('owner_id', row.owner_id).maybeSingle()
  await notifyUser(
    row.owner_id as string,
    'messages',
    (t, locale) => ({
      title: t('shopOrderTitle', { number: order.number ?? 0 }),
      body: t('shopOrderBody', { name: order.customerName, amount: formatCents(order.totalCents, locale) }),
      url: localizedPath(locale, '/marketplace/shop?tab=orders'),
      tag: `shop-order-${order.id}`,
    }),
    { kind: 'shop_order', ref: order.id }
  )
  if (shop) await sendOrderEmail(order, row.public_token as string, shop.slug as string, shop.name as string, pickLocale(row.locale), 'paid')
  return true
}

// Email al cliente: conferma dell'ordine, pronto per il ritiro, spedito
export async function sendOrderEmail(order: ShopOrder, token: string, slug: string, shopName: string, locale: string, kind: 'paid' | 'ready' | 'shipped') {
  const t = await getTranslations({ locale, namespace: 'shopPublic' })
  const money = (c: number) => formatCents(c, locale)
  const link = orderUrl(locale, slug, token)
  const subject = t(`email_${kind}_subject`, { shop: shopName, number: order.number ?? 0 })
  const intro = t(`email_${kind}_intro`, { name: order.customerName, shop: shopName, number: order.number ?? 0 })
  const lines = order.items.map((i) => `${i.quantity} × ${i.name} — ${money(i.price_cents * i.quantity)}`)
  const totals = [`${t('subtotal')}: ${money(order.subtotalCents)}`, `${t(order.delivery === 'pickup' ? 'deliveryPickup' : 'shipping')}: ${money(order.shippingCents)}`, `${t('total')}: ${money(order.totalCents)}`]
  const tracking = kind === 'shipped' && order.trackingNumber ? t('emailTracking', { code: order.trackingNumber }) + (order.trackingUrl ? ` ${order.trackingUrl}` : '') : ''
  const text = [intro, tracking, ...(kind === 'paid' ? [lines.join('\n'), totals.join('\n')] : []), `${t('emailSeeOrder')}: ${link}`, t('emailSignature', { shop: shopName })].filter(Boolean).join('\n\n')
  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#111;color:#e8c872;font-weight:bold;font-size:20px;padding:16px 20px;border-radius:12px 12px 0 0">${escapeHtml(shopName)}</div>
<div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;line-height:1.5;font-size:15px">
<p>${escapeHtml(intro)}</p>
${tracking ? `<p><strong>${escapeHtml(tracking)}</strong></p>` : ''}
${kind === 'paid' ? `<table style="width:100%;border-collapse:collapse;margin:12px 0">${order.items.map((i) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${i.quantity} × ${escapeHtml(i.name)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">${escapeHtml(money(i.price_cents * i.quantity))}</td></tr>`).join('')}</table><p style="text-align:right">${totals.map(escapeHtml).join('<br>')}</p>` : ''}
<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#111;color:#e8c872;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">${escapeHtml(t('emailSeeOrder'))}</a></p>
<p style="color:#666;font-size:13px">${escapeHtml(t('emailSignature', { shop: shopName }))}</p>
</div></div></body></html>`
  await sendEmail({ to: order.customerEmail, subject, html, text, idempotencyKey: `shop-${kind}-${order.id}` }).catch((e) => console.error('[Shop] email non inviata:', e))
}

export const ORDER_FLOW: Record<OrderStatus, OrderStatus[]> = {
  pending: [],
  paid: ['ready', 'shipped', 'cancelled'],
  ready: ['delivered', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
}

// Landing Page: indirizzo del negozio del titolare, se aperto e visibile
export async function openShopSlugForLanding(landingSlug: string): Promise<string | null> {
  try {
    const db = serviceDb()
    const { data: landing } = await db.from('landing_pages').select('owner_id').eq('slug', landingSlug).maybeSingle()
    if (!landing) return null
    const { data: shop } = await db.from('shop_settings').select('slug').eq('owner_id', landing.owner_id).eq('is_open', true).maybeSingle()
    if (!shop) return null
    return (await loadPublicShop(shop.slug as string)) ? (shop.slug as string) : null
  } catch {
    return null
  }
}
