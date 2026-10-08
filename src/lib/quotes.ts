export interface QuoteItem {
  description: string
  quantity: number
  unitPrice: number
  // Riga presa dal Magazzino (id di inventory_products): serve allo scarico
  productId?: string
}

// Prodotto del Magazzino proposto nel preventivo (solo Pro)
export interface QuoteInventoryProduct {
  id: string
  name: string
  sku: string | null
  unit: string
  sale_price: number | null
  stock: number
}

// Due modalità: tabella di voci (quantità × prezzo) o documento descrittivo a sezioni
export type QuoteLayout = 'table' | 'descriptive'
export const QUOTE_LAYOUTS: QuoteLayout[] = ['table', 'descriptive']
// Posizione del logo nel PDF: a sinistra, al centro, a destra o su una fascia
export type QuoteLogoPosition = 'left' | 'center' | 'right' | 'band'
export const QUOTE_LOGO_POSITIONS: QuoteLogoPosition[] = ['left', 'center', 'right', 'band']
// Come si legge il prezzo: «+ IVA», «IVA inclusa» o nessuna indicazione
export type QuoteVatMode = 'plus' | 'included' | 'none'
export const QUOTE_VAT_MODES: QuoteVatMode[] = ['plus', 'included', 'none']

// Sezione del preventivo descrittivo: titolo, testo libero o elenco (una
// riga per voce) e importo facoltativo
// 'image': foto o disegno caricato (body = didascalia)
// 'layers': stratigrafia / composizione a strati disegnata da KUMANI, dal
// basso (supporto) verso l'alto (body = nota sotto il disegno)
export type QuoteSectionKind = 'text' | 'numbered' | 'bullets' | 'image' | 'layers'
export const QUOTE_SECTION_KINDS: QuoteSectionKind[] = ['text', 'numbered', 'bullets', 'image', 'layers']
export interface QuoteLayer {
  label: string
  color: string
}
export interface QuoteSection {
  title: string
  kind: QuoteSectionKind
  body: string
  amount: number | null
  // Percorso dell'immagine nello spazio dei loghi (sezione 'image')
  image?: string | null
  // Strati dal basso verso l'alto (sezione 'layers')
  layers?: QuoteLayer[]
}
// Sezione pronta salvata nel profilo azienda (senza importo)
export interface QuotePreset {
  title: string
  kind: QuoteSectionKind
  body: string
  layers?: QuoteLayer[]
}

export const MAX_QUOTE_LAYERS = 12
// Colori proposti per gli strati (dal supporto in su)
export const QUOTE_LAYER_COLORS = ['#9ca3af', '#d9e8b8', '#c9c3e6', '#b9b0dc', '#e8d6a8', '#bcd7ea', '#f2c4b0', '#cfcfcf', '#8fb996', '#e6b980']

// Indirizzo pubblico di un'immagine di sezione (stesso spazio dei loghi)
export function quoteImageUrl(path: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/quote-logos-v2/${path}`
}

// Aspetto della «Fascia» del logo: colore della fascia, della riga sotto e altezza (pt)
export interface QuoteBandStyle {
  band: string
  line: string
  height: number
  // Spessore della riga sotto la fascia (pt)
  lineHeight: number
}
export const BAND_HEIGHT_MIN = 14
export const BAND_HEIGHT_MAX = 60
export const LINE_HEIGHT_MIN = 1
export const LINE_HEIGHT_MAX = 14
export const DEFAULT_BAND_STYLE: QuoteBandStyle = { band: '#969696', line: '#c79a3b', height: 30, lineHeight: 3 }
export const BAND_COLORS = ['#969696', '#171717', '#1f3a5f', '#2f5d50', '#7a1f2b', '#c79a3b', '#e7e2d6', '#ffffff']
export const LINE_COLORS = ['#c79a3b', '#f0a830', '#e11d48', '#2563eb', '#16a34a', '#171717', '#ffffff', '#969696']

// Valori sicuri (colori esadecimali, altezza nei limiti)
export function cleanBandStyle(v: unknown): QuoteBandStyle | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Partial<QuoteBandStyle>
  const hex = (c: unknown, d: string) => (typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c) ? c : d)
  const h = Math.round(Number(o.height))
  const lh = Math.round(Number(o.lineHeight))
  return {
    lineHeight: Number.isFinite(lh) ? Math.min(LINE_HEIGHT_MAX, Math.max(LINE_HEIGHT_MIN, lh)) : DEFAULT_BAND_STYLE.lineHeight,
    band: hex(o.band, DEFAULT_BAND_STYLE.band),
    line: hex(o.line, DEFAULT_BAND_STYLE.line),
    height: Number.isFinite(h) ? Math.min(BAND_HEIGHT_MAX, Math.max(BAND_HEIGHT_MIN, h)) : DEFAULT_BAND_STYLE.height,
  }
}

export const MAX_QUOTE_SECTIONS = 30
export const MAX_QUOTE_PRESETS = 20

export function emptyQuoteSection(kind: QuoteSectionKind = 'text'): QuoteSection {
  return { title: '', kind, body: '', amount: null }
}

export function computeSectionsTotal(sections: QuoteSection[]): number {
  return sections.reduce((sum, s) => sum + (typeof s.amount === 'number' && Number.isFinite(s.amount) ? s.amount : 0), 0)
}

// Righe dell'elenco (una per riga, senza righe vuote né numeri/trattini già scritti a mano)
export function sectionLines(body: string): string[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-–•*])\s+/, '').trim())
    .filter(Boolean)
}

export interface QuoteFormData {
  layout: QuoteLayout
  logoPosition: QuoteLogoPosition
  bandStyle: QuoteBandStyle | null
  subject: string
  intro: string
  sections: QuoteSection[]
  showTotal: boolean
  vatMode: QuoteVatMode
  closing: string
  signature: boolean
  clientName: string
  clientEmail: string
  clientPhone: string
  clientAddress: string
  clientCity: string
  clientPostalCode: string
  clientPec: string
  clientVat: string
  issueDate: string // ISO date
  validUntil: string // ISO date, optional (empty string = none)
  items: QuoteItem[]
  paymentInfo: string
  notes: string
  // Pagamento online (KUMANI Shop): nessuno, totale o acconto in percentuale
  paymentMode: QuotePaymentMode
  depositPercent: number
}

export const QUOTE_PAYMENT_MODES = ['none', 'full', 'deposit'] as const
export type QuotePaymentMode = (typeof QUOTE_PAYMENT_MODES)[number]
export const DEFAULT_DEPOSIT_PERCENT = 30

// Importo da pagare online (centesimi): tutto o l'acconto
export function quoteAmountDueCents(total: number, mode: QuotePaymentMode, depositPercent: number | null): number {
  const cents = Math.round(Number(total) * 100)
  if (mode === 'deposit') return Math.round((cents * Math.min(100, Math.max(1, depositPercent ?? DEFAULT_DEPOSIT_PERCENT))) / 100)
  return mode === 'full' ? cents : 0
}

// A client saved once and recalled on future quotes instead of retyping —
// same "fill once, reuse" idea as the issuer's Business Profile.
export interface SavedClientFormData {
  name: string
  vat: string
  address: string
  city: string
  postalCode: string
  pec: string
  email: string
  phone: string
}

export interface SavedClientRow {
  id: string
  user_id: string
  name: string
  vat: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  pec: string | null
  email: string | null
  phone: string | null
  updated_at: string
}

export interface IssuerProfileFormData {
  companyName: string
  vatNumber: string
  address: string
  city: string
  postalCode: string
  province: string
  pec: string
  email: string
  phone: string
}

export interface IssuerProfileRow {
  user_id: string
  company_name: string | null
  vat_number: string | null
  address: string | null
  city: string | null
  postal_code: string | null
  province: string | null
  pec: string | null
  email: string | null
  phone: string | null
  logo_path: string | null
  updated_at: string
}

export function emptyQuoteItem(): QuoteItem {
  return { description: '', quantity: 1, unitPrice: 0 }
}

export function computeQuoteTotal(items: QuoteItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
}

export const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024 // 5MB
export const ACCEPTED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']

export function validateLogoFile(file: File): string | null {
  if (!ACCEPTED_LOGO_TYPES.includes(file.type) && !file.type.startsWith('image/')) {
    return 'invalidLogoType'
  }
  if (file.size > MAX_LOGO_SIZE_BYTES) {
    return 'logoTooLarge'
  }
  return null
}

export function logoExtension(file: File): string {
  const fromName = file.name.split('.').pop()
  if (fromName && /^[a-z0-9]{2,5}$/i.test(fromName)) return fromName.toLowerCase()
  // Fallback to the MIME subtype (e.g. "svg+xml" for SVGs) — strip anything
  // after "+" or ";" so the storage key extension stays a plain alnum token.
  const fromType = file.type.split('/')[1]?.split(/[+;]/)[0]
  return fromType || 'png'
}
