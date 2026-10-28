// Biglietto da visita «classico»: i dati stampati sul biglietto (nome, ruolo,
// contatti…), 6 stili, colori, logo, QR facoltativo, solo fronte o fronte e
// retro. Le scelte stanno in business_cards.classic; i dati arrivano da
// profilo e Scheda attività e si possono correggere solo per il biglietto.

export const CLASSIC_FIELDS = ['name', 'role', 'company', 'phone', 'mobile', 'email', 'website', 'address', 'vat', 'social'] as const
export type ClassicField = (typeof CLASSIC_FIELDS)[number]
// Dati di contatto (con l'icona), gli altri sono l'intestazione
export const CONTACT_FIELDS: ClassicField[] = ['phone', 'mobile', 'email', 'website', 'address', 'vat', 'social']

export const CLASSIC_LAYOUTS = ['centered', 'elegant', 'band', 'minimal', 'vertical', 'verticalBand'] as const
export type ClassicLayout = (typeof CLASSIC_LAYOUTS)[number]
export const isVertical = (l: ClassicLayout) => l === 'vertical' || l === 'verticalBand'

export const CLASSIC_PALETTES = ['brand', 'kumani', 'white'] as const
export type ClassicPalette = (typeof CLASSIC_PALETTES)[number]
export const CLASSIC_LOGOS = ['business', 'kumani', 'none'] as const
export type ClassicLogo = (typeof CLASSIC_LOGOS)[number]
export const CLASSIC_LOGO_SIZES = ['S', 'M', 'L'] as const
export type ClassicLogoSize = (typeof CLASSIC_LOGO_SIZES)[number]
export const CLASSIC_QR = ['none', 'front', 'back'] as const
export type ClassicQr = (typeof CLASSIC_QR)[number]
export const CLASSIC_QR_TARGETS = ['card', 'bio', 'website'] as const
export type ClassicQrTarget = (typeof CLASSIC_QR_TARGETS)[number]
export const CLASSIC_BACKS = ['logo', 'qr', 'slogan', 'color'] as const
export type ClassicBack = (typeof CLASSIC_BACKS)[number]

export type ClassicSettings = {
  layout: ClassicLayout
  palette: ClassicPalette
  logo: ClassicLogo
  logoSize: ClassicLogoSize
  qr: ClassicQr
  qrTarget: ClassicQrTarget
  sides: 'front' | 'both'
  back: ClassicBack
  fields: Record<ClassicField, boolean>
  // Testi corretti a mano solo per il biglietto (vuoto = quello del profilo)
  values: Partial<Record<ClassicField, string>>
  slogan: string
}

export const DEFAULT_CLASSIC: ClassicSettings = {
  layout: 'elegant',
  palette: 'kumani',
  logo: 'business',
  logoSize: 'M',
  qr: 'none',
  qrTarget: 'card',
  sides: 'front',
  back: 'logo',
  fields: { name: true, role: true, company: true, phone: true, mobile: false, email: true, website: true, address: false, vat: false, social: false },
  values: {},
  slogan: '',
}

const pick = <T extends string>(list: readonly T[], v: unknown, d: T): T => (list.includes(v as T) ? (v as T) : d)
const text = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// Scelte salvate (anche vecchie o incomplete) → scelte valide
export function cleanClassic(raw: unknown): ClassicSettings {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const f = v.fields && typeof v.fields === 'object' ? (v.fields as Record<string, unknown>) : {}
  const vals = v.values && typeof v.values === 'object' ? (v.values as Record<string, unknown>) : {}
  return {
    layout: pick(CLASSIC_LAYOUTS, v.layout, DEFAULT_CLASSIC.layout),
    palette: pick(CLASSIC_PALETTES, v.palette, DEFAULT_CLASSIC.palette),
    logo: pick(CLASSIC_LOGOS, v.logo, DEFAULT_CLASSIC.logo),
    logoSize: pick(CLASSIC_LOGO_SIZES, v.logoSize, DEFAULT_CLASSIC.logoSize),
    qr: pick(CLASSIC_QR, v.qr, DEFAULT_CLASSIC.qr),
    qrTarget: pick(CLASSIC_QR_TARGETS, v.qrTarget, DEFAULT_CLASSIC.qrTarget),
    sides: v.sides === 'both' ? 'both' : 'front',
    back: pick(CLASSIC_BACKS, v.back, DEFAULT_CLASSIC.back),
    fields: Object.fromEntries(CLASSIC_FIELDS.map((k) => [k, typeof f[k] === 'boolean' ? f[k] : DEFAULT_CLASSIC.fields[k]])) as Record<ClassicField, boolean>,
    values: Object.fromEntries(CLASSIC_FIELDS.map((k) => [k, text(vals[k], 120)]).filter(([, s]) => s)) as Partial<Record<ClassicField, string>>,
    slogan: text(v.slogan, 90),
  }
}

// Dati di partenza dal profilo e dalla Scheda attività
export type ClassicSource = Partial<Record<ClassicField, string>>
