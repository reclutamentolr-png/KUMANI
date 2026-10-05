// Convivio — tipi condivisi.

export const CONVIVIO_CATEGORIES = ['food', 'tech', 'travel', 'energy', 'other'] as const
export type ConvivioCategory = (typeof CONVIVIO_CATEGORIES)[number]
export type ConvivioStatus = 'open' | 'awaiting_supplier' | 'declined' | 'reached' | 'failed' | 'ordered' | 'completed' | 'cancelled'
export type SupplierStatus = 'none' | 'pending' | 'counter' | 'confirmed' | 'declined'
export type Rating = { avg: number | null; count: number }

export type ConvivioCard = {
  id: string
  title: string
  category: ConvivioCategory
  city: string | null
  supplier_name: string
  supplier_kumani: boolean
  supplier_status: SupplierStatus
  supplier_is_leader: boolean
  supplier_rating: Rating | null
  unit_label: string
  retail_price: number | null
  group_price: number
  min_participants: number
  max_participants: number | null
  expires_at: string
  status: ConvivioStatus
  people: number
  quantity: number
  leader_name: string | null
  leader_rating: Rating
  is_leader: boolean
  is_supplier: boolean
  my_quantity: number | null
}

export type ConvivioDetail = ConvivioCard & {
  description: string
  pickup_info: string
  created_at: string
  leader_since: string
  counter_price: number | null
  counter_min: number | null
  is_member: boolean
  my_note: string | null
  my_share_phone: boolean | null
  my_reviews: ('supplier' | 'leader')[]
  participants: { name: string | null; quantity: number; note: string | null; phone: string | null }[]
}

export type ConvivioPublic = ConvivioCard & { description: string; leader_referral: string | null }

export type ConvivioMessage = { id: string; name: string | null; mine: boolean; is_leader: boolean; body: string; created_at: string }

export type ConvivioLeaderStatus = {
  account_age: boolean
  subscription: boolean
  profile: boolean
  tax_code: boolean
  terms: boolean
  blocked: boolean
  days_left: number
  // Identità: tax_code = verificata (codice fiscale o documento approvato)
  has_tax_code?: boolean
  identity_pending?: boolean
  identity_last_status?: 'pending' | 'approved' | 'rejected' | null
  identity_rejected_note?: string | null
  verified: boolean
}

export function savingPercent(card: Pick<ConvivioCard, 'retail_price' | 'group_price'>): number | null {
  if (!card.retail_price || card.retail_price <= 0 || card.group_price >= card.retail_price) return null
  return Math.round((1 - card.group_price / card.retail_price) * 100)
}

export function formatEuro(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value)
}

export type ConvivioSupplier = {
  business_name: string
  vat_number: string
  // Paese della partita IVA ed esito della verifica (scritto solo dal server)
  vat_country?: string
  vat_status?: 'unverified' | 'valid' | 'invalid'
  vat_checked_at?: string | null
  vat_registered_name?: string | null
  city: string
  category: ConvivioCategory
  description: string
  accepts_group_orders: boolean
}

export type MySupplierInfo = {
  is_pro: boolean
  supplier: ConvivioSupplier | null
  prefill: { business_name: string | null; vat_number: string | null; city: string | null } | null
}

export type SupplierSearchResult = { id: string; business_name: string; city: string; category: ConvivioCategory; description: string; rating: Rating }

// ---------- Vetrina in homepage ----------

// Capocordata o fornitore chiedono di mostrare il lotto in homepage; lo Staff
// approva. In homepage al massimo 3 lotti aperti e ancora sotto il minimo.
export const SHOWCASE_CACHE_TAG = 'kordata-showcase'
export const SHOWCASE_REJECT_REASONS = ['photo', 'description', 'price', 'other'] as const
export type ShowcaseRejectReason = (typeof SHOWCASE_REJECT_REASONS)[number]
export type ShowcaseStatus = 'none' | 'requested' | 'approved' | 'rejected' | 'removed'

export type ShowcaseInfo = {
  can_manage: boolean
  eligible: boolean
  status: ShowcaseStatus
  reason: ShowcaseRejectReason | null
  photo_path: string | null
}

export type ShowcaseCard = Omit<ConvivioCard, 'is_leader' | 'is_supplier' | 'my_quantity' | 'supplier_status' | 'supplier_is_leader'> & {
  photo_path: string | null
  vat_valid: boolean
}

export const convivioPhotoUrl = (path: string | null | undefined) =>
  path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/convivio-photos/${path}` : null
