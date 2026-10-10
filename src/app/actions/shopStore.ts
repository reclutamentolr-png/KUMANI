'use server'

import { randomBytes } from 'node:crypto'
import { headers } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { getStripe } from '@/lib/stripe'
import { SITE_URL } from '@/lib/siteUrl'
import { localizedPath } from '@/lib/push'
import { clientIp } from '@/lib/securityCore'
import { limitError } from '@/lib/appLimits'
import { retrieveConnectedSession, serviceDb } from '@/lib/shopPayments'
import { inventoryStock, loadPublicShop, mapOrder, mapProduct, mapSettings, ORDER_FLOW, recordShopOrderPayment, sendOrderEmail } from '@/lib/shopServer'
import { EU_COUNTRIES, isValidSlug, SHOP_MAX, shippingCents, shopPath, type OrderStatus, type ShopOrder, type ShopProduct, type ShopSettings } from '@/lib/shop'

// KUMANI Shop (fase 2): azioni del venditore (negozio, prodotti, ordini) e
// del cliente (carrello e pagamento). I prezzi e le disponibilità si
// ricalcolano sempre qui sul server: dal browser arrivano solo id e quantità.

type Result<T = null> = { success: true; data: T } | { success: false; message: string; limitText?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clean = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().replace(/\r\n/g, '\n').slice(0, max) : '')
const cents = (value: unknown, min: number, max: number) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

async function owner() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !(await hasActiveToolAccess(supabase, user.id, 'shop'))) return null
  return { supabase, user }
}

async function sellerReady(userId: string) {
  const db = serviceDb()
  const [{ data: account }, { data: issuer }] = await Promise.all([
    db.from('seller_stripe_accounts').select('charges_enabled').eq('user_id', userId).maybeSingle(),
    db.from('quote_issuer_profiles').select('company_name, vat_number, address, email').eq('user_id', userId).maybeSingle(),
  ])
  return {
    stripeReady: !!account?.charges_enabled,
    profileReady: !!(issuer?.company_name?.trim() && issuer?.vat_number?.trim() && issuer?.address?.trim() && issuer?.email?.trim()),
  }
}

export type InventoryOption = { id: string; name: string; stock: number; salePriceCents: number }

export type MyShop = {
  settings: ShopSettings | null
  products: ShopProduct[]
  orders: ShopOrder[]
  inventory: InventoryOption[]
  stripeReady: boolean
  profileReady: boolean
}

export async function getMyShop(): Promise<MyShop | null> {
  const o = await owner()
  if (!o) return null
  const [{ data: settings }, { data: products }, { data: orders }, { data: inventory }, ready] = await Promise.all([
    o.supabase.from('shop_settings').select('*').eq('owner_id', o.user.id).maybeSingle(),
    o.supabase.from('shop_products').select('*').eq('owner_id', o.user.id).order('position').order('created_at'),
    o.supabase.from('shop_orders').select('*').eq('owner_id', o.user.id).neq('status', 'pending').order('created_at', { ascending: false }).limit(100),
    o.supabase.from('inventory_products').select('id, name, stock, sale_price').eq('owner_id', o.user.id).eq('is_active', true).order('name').limit(1000),
    sellerReady(o.user.id),
  ])
  const stock = new Map((inventory ?? []).map((i) => [i.id as string, Number(i.stock)]))
  return {
    settings: settings ? mapSettings(settings) : null,
    products: (products ?? []).map((p) => mapProduct(p, stock)),
    orders: (orders ?? []).map(mapOrder),
    inventory: (inventory ?? []).map((i) => ({ id: i.id as string, name: i.name as string, stock: Math.floor(Number(i.stock)), salePriceCents: Math.round(Number(i.sale_price) * 100) })),
    ...ready,
  }
}

export type ShopSettingsInput = Omit<ShopSettings, 'coverPath'> & { coverPath: string | null }

export async function saveShopSettings(input: ShopSettingsInput): Promise<Result<ShopSettings>> {
  const o = await owner()
  if (!o) return { success: false, message: 'notAllowed' }
  const slug = clean(input.slug, 40).toLowerCase()
  const name = clean(input.name, SHOP_MAX.name)
  if (!isValidSlug(slug)) return { success: false, message: 'slugInvalid' }
  if (name.length < 2) return { success: false, message: 'nameRequired' }
  const pickup = !!input.pickupEnabled
  const shipping = !!input.shippingEnabled
  if (!pickup && !shipping) return { success: false, message: 'deliveryRequired' }
  const shipIt = cents(input.shippingItCents, 0, 100000)
  const shipEu = input.shippingEuCents == null ? null : cents(input.shippingEuCents, 0, 100000)
  const free = input.freeShippingOverCents == null ? null : cents(input.freeShippingOverCents, 0, 10000000)
  if (shipIt == null || (input.shippingEuCents != null && shipEu == null) || (input.freeShippingOverCents != null && free == null)) return { success: false, message: 'priceInvalid' }
  const policy = clean(input.returnsPolicy, SHOP_MAX.policy)
  const isOpen = !!input.isOpen
  if (isOpen) {
    const ready = await sellerReady(o.user.id)
    if (!ready.stripeReady || !ready.profileReady) return { success: false, message: 'notReadyToOpen' }
    if (!policy) return { success: false, message: 'policyRequired' }
  }
  const coverPath = input.coverPath && input.coverPath.startsWith(`${o.user.id}/`) ? input.coverPath : null
  const row = {
    owner_id: o.user.id,
    slug,
    name,
    description: clean(input.description, SHOP_MAX.description),
    cover_path: coverPath,
    is_open: isOpen,
    pickup_enabled: pickup,
    pickup_info: clean(input.pickupInfo, SHOP_MAX.pickupInfo),
    shipping_enabled: shipping,
    shipping_it_cents: shipIt,
    shipping_eu_cents: shipEu,
    free_shipping_over_cents: free,
    returns_policy: policy,
  }
  const { data, error } = await o.supabase.from('shop_settings').upsert(row, { onConflict: 'owner_id' }).select('*').single()
  if (error) return { success: false, message: error.code === '23505' ? 'slugTaken' : 'saveError' }
  return { success: true, data: mapSettings(data) }
}

export type ShopProductInput = {
  id?: string
  name: string
  description: string
  priceCents: number
  imagePath: string | null
  inventoryProductId: string | null
  stock: number | null
  isActive: boolean
}

export async function saveShopProduct(input: ShopProductInput): Promise<Result<ShopProduct>> {
  const o = await owner()
  if (!o) return { success: false, message: 'notAllowed' }
  const name = clean(input.name, SHOP_MAX.productName)
  if (!name) return { success: false, message: 'nameRequired' }
  const price = cents(input.priceCents, 50, 10000000)
  if (price == null) return { success: false, message: 'priceInvalid' }
  const inventoryId = input.inventoryProductId && UUID_RE.test(input.inventoryProductId) ? input.inventoryProductId : null
  const stock = inventoryId || input.stock == null ? null : cents(input.stock, 0, 1000000)
  if (!inventoryId && input.stock != null && stock == null) return { success: false, message: 'stockInvalid' }
  const imagePath = input.imagePath && input.imagePath.startsWith(`${o.user.id}/`) ? input.imagePath : null
  const row = {
    owner_id: o.user.id,
    name,
    description: clean(input.description, SHOP_MAX.productDescription),
    price_cents: price,
    image_path: imagePath,
    inventory_product_id: inventoryId,
    stock,
    is_active: !!input.isActive,
  }
  const query =
    input.id && UUID_RE.test(input.id)
      ? o.supabase.from('shop_products').update(row).eq('id', input.id).eq('owner_id', o.user.id).select('*').single()
      : o.supabase.from('shop_products').insert(row).select('*').single()
  const { data, error } = await query
  if (error) {
    return (await limitError(error)) ?? { success: false, message: error.code === '23505' ? 'inventoryTaken' : 'saveError' }
  }
  const stockMap = inventoryId ? await inventoryStock(o.user.id, [inventoryId]) : undefined
  return { success: true, data: mapProduct(data, stockMap) }
}

export async function deleteShopProduct(id: string): Promise<Result> {
  const o = await owner()
  if (!o || !UUID_RE.test(id)) return { success: false, message: 'notAllowed' }
  const { data } = await o.supabase.from('shop_products').delete().eq('id', id).eq('owner_id', o.user.id).select('image_path')
  const path = data?.[0]?.image_path as string | null | undefined
  if (path) await o.supabase.storage.from('shop-media').remove([path])
  return { success: true, data: null }
}

// Stato dell'ordine: pronto per il ritiro, spedito (con tracciamento),
// consegnato, annullato (con rimborso del pagamento)
export async function updateShopOrder(id: string, status: OrderStatus, tracking?: { number?: string; url?: string }): Promise<Result<ShopOrder>> {
  const o = await owner()
  if (!o || !UUID_RE.test(id)) return { success: false, message: 'notAllowed' }
  const { data: current } = await o.supabase.from('shop_orders').select('*').eq('id', id).eq('owner_id', o.user.id).maybeSingle()
  if (!current) return { success: false, message: 'notFound' }
  if (!ORDER_FLOW[current.status as OrderStatus]?.includes(status)) return { success: false, message: 'badStatus' }
  const now = new Date().toISOString()
  const trackingUrl = clean(tracking?.url, 500)
  const patch: Record<string, unknown> = { status }
  if (status === 'shipped') {
    patch.shipped_at = now
    patch.tracking_number = clean(tracking?.number, 80) || null
    patch.tracking_url = /^https:\/\//i.test(trackingUrl) ? trackingUrl : null
  }
  if (status === 'delivered') patch.delivered_at = now
  if (status === 'cancelled') {
    // Rimborso completo sul conto del venditore
    const db = serviceDb()
    const { data: account } = await db.from('seller_stripe_accounts').select('stripe_account_id').eq('user_id', o.user.id).maybeSingle()
    if (current.stripe_payment_intent && account?.stripe_account_id) {
      try {
        await getStripe().refunds.create(
          { payment_intent: current.stripe_payment_intent as string },
          { stripeAccount: account.stripe_account_id as string, idempotencyKey: `shop-refund-${id}` }
        )
      } catch (error) {
        console.error('[Shop] rimborso non riuscito:', error instanceof Error ? error.message : error)
        return { success: false, message: 'refundFailed' }
      }
    }
    patch.cancelled_at = now
  }
  const { data, error } = await serviceDb().from('shop_orders').update(patch).eq('id', id).eq('owner_id', o.user.id).eq('status', current.status).select('*').single()
  if (error || !data) return { success: false, message: 'saveError' }
  const order = mapOrder(data)
  if (status === 'shipped' || status === 'ready') {
    const { data: shop } = await o.supabase.from('shop_settings').select('slug, name').eq('owner_id', o.user.id).maybeSingle()
    if (shop) await sendOrderEmail(order, data.public_token as string, shop.slug as string, shop.name as string, (data.locale as string) || 'it', status)
  }
  return { success: true, data: order }
}

// ---------------------------------------------------------------------------
// Cliente: carrello e pagamento
// ---------------------------------------------------------------------------

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

export type CheckoutInput = {
  slug: string
  cart: { id: string; quantity: number }[]
  name: string
  email: string
  phone: string
  delivery: 'pickup' | 'shipping'
  address: { line: string; city: string; postal_code: string; province: string; country: string }
  notes: string
  acceptTerms: boolean
}

export async function startShopCheckout(input: CheckoutInput): Promise<Result<{ url: string }>> {
  const ip = clientIp(await headers()) ?? 'x'
  if (tooMany(`shop:${ip}`, 20, 60 * 60_000)) return { success: false, message: 'wait' }
  const shop = await loadPublicShop(String(input.slug ?? ''))
  if (!shop) return { success: false, message: 'shopClosed' }
  if (!input.acceptTerms) return { success: false, message: 'termsRequired' }
  const name = clean(input.name, 120)
  const email = clean(input.email, 200).toLowerCase()
  const phone = clean(input.phone, 40)
  if (name.length < 2) return { success: false, message: 'nameRequired' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { success: false, message: 'emailInvalid' }
  const delivery = input.delivery === 'shipping' ? 'shipping' : 'pickup'
  if (delivery === 'pickup' && !shop.settings.pickupEnabled) return { success: false, message: 'deliveryInvalid' }
  if (delivery === 'shipping' && !shop.settings.shippingEnabled) return { success: false, message: 'deliveryInvalid' }

  // Carrello: prodotti attivi del negozio, quantità entro la disponibilità
  const wanted = new Map<string, number>()
  for (const line of (input.cart ?? []).slice(0, SHOP_MAX.cartLines)) {
    const qty = Math.floor(Number(line?.quantity))
    if (UUID_RE.test(String(line?.id)) && qty > 0) wanted.set(line.id, Math.min((wanted.get(line.id) ?? 0) + qty, SHOP_MAX.quantity))
  }
  if (!wanted.size) return { success: false, message: 'cartEmpty' }
  const items = []
  for (const [id, quantity] of wanted) {
    const product = shop.products.find((p) => p.id === id)
    if (!product) return { success: false, message: 'productGone' }
    if (product.stock != null && product.stock < quantity) return { success: false, message: 'outOfStock' }
    items.push({ product_id: product.id, name: product.name, price_cents: product.priceCents, quantity })
  }
  const subtotal = items.reduce((sum, i) => sum + i.price_cents * i.quantity, 0)

  let address = null
  if (delivery === 'shipping') {
    const a = input.address ?? ({} as CheckoutInput['address'])
    const country = clean(a.country, 2).toUpperCase()
    address = { line: clean(a.line, 200), city: clean(a.city, 100), postal_code: clean(a.postal_code, 12), province: clean(a.province, 40), country }
    if (!address.line || !address.city || !address.postal_code || (country !== 'IT' && !EU_COUNTRIES.includes(country))) return { success: false, message: 'addressInvalid' }
  }
  const shipping = shippingCents(shop.settings, subtotal, delivery, address?.country ?? 'IT')
  if (shipping == null) return { success: false, message: 'countryNotServed' }
  const total = subtotal + shipping

  const locale = await getLocale()
  const t = await getTranslations('shopPublic')
  const token = randomBytes(18).toString('base64url')
  const db = serviceDb()
  const { data: order, error } = await db
    .from('shop_orders')
    .insert({
      owner_id: shop.ownerId,
      public_token: token,
      customer_name: name,
      customer_email: email,
      customer_phone: phone || null,
      delivery,
      ship_address: address,
      notes: clean(input.notes, SHOP_MAX.notes) || null,
      items,
      subtotal_cents: subtotal,
      shipping_cents: shipping,
      total_cents: total,
      locale,
    })
    .select('id')
    .single()
  if (error || !order) {
    console.error('[Shop] ordine non creato:', error?.message)
    return { success: false, message: 'saveError' }
  }

  // Pezzi da parte per 35 minuti; se intanto li ha presi un altro cliente,
  // l'ordine è già stato cancellato
  const { data: reserved, error: reserveError } = await db.rpc('shop_reserve_order', { p_order: order.id })
  if (reserveError) {
    console.error('[Shop] prenotazione non riuscita:', reserveError.message)
    await db.from('shop_orders').delete().eq('id', order.id).eq('status', 'pending')
    return { success: false, message: 'saveError' }
  }
  if (!reserved) return { success: false, message: 'outOfStock' }

  const base = `${SITE_URL}${localizedPath(locale, shopPath(shop.settings.slug))}`
  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: 'payment',
        locale: (['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'].includes(locale) ? locale : 'auto') as 'auto',
        customer_email: email,
        line_items: [
          ...items.map((i) => ({ quantity: i.quantity, price_data: { currency: 'eur', unit_amount: i.price_cents, product_data: { name: i.name } } })),
          ...(shipping > 0 ? [{ quantity: 1, price_data: { currency: 'eur', unit_amount: shipping, product_data: { name: t('shipping') } } }] : []),
        ],
        payment_intent_data: { description: `${shop.settings.name} · KUMANI Shop`, metadata: { order_id: order.id } },
        metadata: { kind: 'shop_order', order_id: order.id },
        success_url: `${base}/ordine/${token}?paid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}?cancelled=${token}`,
        // Il minimo di Stripe è 30 minuti; la prenotazione dura un po' di più
        expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      },
      { stripeAccount: shop.stripeAccountId }
    )
    await db.from('shop_orders').update({ stripe_session_id: session.id }).eq('id', order.id)
    return { success: true, data: { url: session.url! } }
  } catch (err) {
    console.error('[Shop] pagamento non avviato:', err instanceof Error ? err.message : err)
    await db.from('shop_orders').delete().eq('id', order.id).eq('status', 'pending')
    return { success: false, message: 'stripeError' }
  }
}

// Ritorno dal pagamento: conferma subito, senza aspettare il webhook
export async function confirmShopOrder(token: string, sessionId: string): Promise<boolean> {
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId) || !/^[A-Za-z0-9_-]{16,64}$/.test(token)) return false
  const db = serviceDb()
  const { data: order } = await db.from('shop_orders').select('id, owner_id, status, stripe_session_id').eq('public_token', token).maybeSingle()
  if (!order || order.stripe_session_id !== sessionId) return false
  if (order.status !== 'pending') return true
  const { data: account } = await db.from('seller_stripe_accounts').select('stripe_account_id').eq('user_id', order.owner_id).maybeSingle()
  if (!account) return false
  try {
    const session = await retrieveConnectedSession(sessionId, account.stripe_account_id as string)
    if (session.metadata?.order_id !== order.id) return false
    return await recordShopOrderPayment(session)
  } catch (error) {
    console.error('[Shop] conferma ordine:', error instanceof Error ? error.message : error)
    return false
  }
}
