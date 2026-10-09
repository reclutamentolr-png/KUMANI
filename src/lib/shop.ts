// KUMANI Shop (fase 2): tipi e calcoli condivisi tra pagina del venditore,
// pagina pubblica del negozio e server. I prezzi sono sempre in centesimi.

export type ShopSettings = {
  slug: string
  name: string
  description: string
  coverPath: string | null
  isOpen: boolean
  pickupEnabled: boolean
  pickupInfo: string
  shippingEnabled: boolean
  shippingItCents: number
  shippingEuCents: number | null
  freeShippingOverCents: number | null
  returnsPolicy: string
}

export type ShopProduct = {
  id: string
  name: string
  description: string
  priceCents: number
  imagePath: string | null
  inventoryProductId: string | null
  // Disponibili: dal Magazzino se collegato, altrimenti quelli indicati (null = senza limite)
  stock: number | null
  isActive: boolean
  position: number
}

export const ORDER_STATUSES = ['pending', 'paid', 'ready', 'shipped', 'delivered', 'cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

export type ShopOrderItem = { product_id: string; name: string; price_cents: number; quantity: number }
export type ShipAddress = { line: string; city: string; postal_code: string; province: string; country: string }

export type ShopOrder = {
  id: string
  number: number | null
  status: OrderStatus
  customerName: string
  customerEmail: string
  customerPhone: string | null
  delivery: 'pickup' | 'shipping'
  shipAddress: ShipAddress | null
  notes: string | null
  items: ShopOrderItem[]
  subtotalCents: number
  shippingCents: number
  totalCents: number
  trackingNumber: string | null
  trackingUrl: string | null
  createdAt: string
  paidAt: string | null
  shippedAt: string | null
}

export const SHOP_MAX = { name: 80, description: 600, pickupInfo: 300, policy: 2000, productName: 120, productDescription: 1500, notes: 500, cartLines: 30, quantity: 99 }

// Paesi per la spedizione: Italia e, se il venditore lo prevede, l'Unione Europea
export const EU_COUNTRIES = ['AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK']

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/
// Indirizzi riservati (pagine e parole che non devono sembrare negozi ufficiali)
const RESERVED = new Set(['admin', 'kumani', 'shop', 'negozio', 'store', 'api', 'login', 'ordine', 'ordini', 'help', 'support', 'staff', 'official', 'ufficiale'])
export const isValidSlug = (slug: string) => SLUG_RE.test(slug) && !RESERVED.has(slug) && !slug.includes('--')

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

// Spedizione: costo per l'Italia o per l'Europa; gratis sopra la soglia; ritiro gratis
export function shippingCents(settings: Pick<ShopSettings, 'shippingItCents' | 'shippingEuCents' | 'freeShippingOverCents'>, subtotal: number, delivery: 'pickup' | 'shipping', country: string): number | null {
  if (delivery === 'pickup') return 0
  if (settings.freeShippingOverCents != null && subtotal >= settings.freeShippingOverCents) return 0
  if (country === 'IT') return settings.shippingItCents
  if (EU_COUNTRIES.includes(country) && settings.shippingEuCents != null) return settings.shippingEuCents
  return null
}

export const formatCents = (cents: number, locale: string) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100)

// Indirizzo pubblico del negozio
export const shopPath = (slug: string) => `/shop/${slug}`
