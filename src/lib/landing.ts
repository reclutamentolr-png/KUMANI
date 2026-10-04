// Landing Page (servizio Pro): struttura dei contenuti, modelli di stile e
// controlli dei dati. Usato dall'editor, dal server e dalla pagina pubblica.

export const LANDING_LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'] as const
export type LandingLocale = (typeof LANDING_LOCALES)[number]
export const LANDING_LOCALE_NAMES: Record<LandingLocale, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  ru: 'Русский',
}
export const isLandingLocale = (v: unknown): v is LandingLocale => typeof v === 'string' && (LANDING_LOCALES as readonly string[]).includes(v)

export const LANDING_TEMPLATES = ['scuro', 'chiaro', 'colore'] as const
export type LandingTemplate = (typeof LANDING_TEMPLATES)[number]
export const isLandingTemplate = (v: unknown): v is LandingTemplate => typeof v === 'string' && (LANDING_TEMPLATES as readonly string[]).includes(v)

export const LANDING_ACCENTS = ['#c79a3b', '#2563eb', '#0f766e', '#16a34a', '#dc2626', '#db2777', '#7c3aed', '#ea580c']

export const SECTION_KEYS = ['services', 'about', 'method', 'testimonials', 'gallery', 'hours', 'contacts'] as const
export type SectionKey = (typeof SECTION_KEYS)[number]

export const CTA_KINDS = ['whatsapp', 'phone', 'email', 'link', 'none'] as const
export type CtaKind = (typeof CTA_KINDS)[number]

export const REPORT_REASONS = ['scam', 'fake_reviews', 'offensive', 'copyright', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export type TitledText = { title: string; text: string }
export type Testimonial = { name: string; text: string; stars: number }
export type HoursRow = { day: string; hours: string }

export type LandingContent = {
  hero: { name: string; title: string; subtitle: string; text: string; photo: string; logo: string; ctaLabel: string; ctaKind: CtaKind; ctaValue: string }
  order: SectionKey[]
  services: { on: boolean; title: string; items: TitledText[] }
  about: { on: boolean; title: string; text: string; photo: string }
  method: { on: boolean; title: string; items: TitledText[] }
  testimonials: { on: boolean; title: string; items: Testimonial[]; googleUrl: string }
  gallery: { on: boolean; title: string; photos: string[] }
  hours: { on: boolean; title: string; rows: HoursRow[]; note: string }
  contacts: { on: boolean; title: string; phone: string; whatsapp: string; email: string; address: string; city: string; form: boolean }
  social: { instagram: string; facebook: string; linkedin: string; tiktok: string; youtube: string; website: string }
  links: { menu: boolean }
  footer: { businessName: string; vat: string }
  seo: { description: string }
}

export const LIMITS = {
  services: 6,
  method: 4,
  testimonials: 6,
  gallery: 8,
  hours: 8,
}

export function emptyLandingContent(name = ''): LandingContent {
  return {
    hero: { name, title: '', subtitle: '', text: '', photo: '', logo: '', ctaLabel: '', ctaKind: 'whatsapp', ctaValue: '' },
    order: [...SECTION_KEYS],
    services: { on: true, title: '', items: [] },
    about: { on: true, title: '', text: '', photo: '' },
    method: { on: false, title: '', items: [] },
    testimonials: { on: false, title: '', items: [], googleUrl: '' },
    gallery: { on: false, title: '', photos: [] },
    hours: { on: false, title: '', rows: [], note: '' },
    contacts: { on: true, title: '', phone: '', whatsapp: '', email: '', address: '', city: '', form: true },
    social: { instagram: '', facebook: '', linkedin: '', tiktok: '', youtube: '', website: '' },
    links: { menu: false },
    footer: { businessName: '', vat: '' },
    seo: { description: '' },
  }
}

// ---------------------------------------------------------------------------
// Pulizia dei dati (salvataggio e lettura): lunghezze massime, solo campi
// noti, link e foto validi. Quello che non torna viene scartato.
// ---------------------------------------------------------------------------

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '')
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])

// Foto caricate dall'utente: solo percorsi nella sua cartella del bucket
const PHOTO_RE = /^[0-9a-f-]{36}\/[a-f0-9]{20}\.(jpg|png|webp)$/
export const cleanPhoto = (v: unknown, ownerId?: string) => {
  const s = str(v, 200)
  if (!PHOTO_RE.test(s)) return ''
  return ownerId && !s.startsWith(`${ownerId}/`) ? '' : s
}

export function cleanUrl(v: unknown): string {
  const s = str(v, 300)
  if (!s) return ''
  const withScheme = /^https?:\/\//i.test(s) ? s : `https://${s}`
  try {
    const u = new URL(withScheme)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return ''
    if (!u.hostname.includes('.')) return ''
    return u.toString()
  } catch {
    return ''
  }
}

export const cleanPhone = (v: unknown) => str(v, 30).replace(/[^\d+ ]/g, '').trim()
export const cleanEmail = (v: unknown) => {
  const s = str(v, 120)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) ? s : ''
}
const titled = (v: unknown, max: number): TitledText[] =>
  arr(v)
    .map((x) => ({ title: str(obj(x).title, 80), text: str(obj(x).text, 400) }))
    .filter((x) => x.title || x.text)
    .slice(0, max)

export function cleanLandingContent(raw: unknown, ownerId?: string): LandingContent {
  const c = obj(raw)
  const base = emptyLandingContent()
  const hero = obj(c.hero)
  const ctaKind = (CTA_KINDS as readonly string[]).includes(hero.ctaKind as string) ? (hero.ctaKind as CtaKind) : 'whatsapp'
  const order = arr(c.order).filter((k): k is SectionKey => (SECTION_KEYS as readonly string[]).includes(k as string))
  const fullOrder = [...new Set([...order, ...SECTION_KEYS])]
  const s = (k: string) => obj(c[k])

  return {
    hero: {
      name: str(hero.name, 80),
      title: str(hero.title, 100),
      subtitle: str(hero.subtitle, 160),
      text: str(hero.text, 600),
      photo: cleanPhoto(hero.photo, ownerId),
      logo: cleanPhoto(hero.logo, ownerId),
      ctaLabel: str(hero.ctaLabel, 40),
      ctaKind,
      ctaValue: ctaKind === 'link' ? cleanUrl(hero.ctaValue) : ctaKind === 'email' ? cleanEmail(hero.ctaValue) : ctaKind === 'none' ? '' : cleanPhone(hero.ctaValue),
    },
    order: fullOrder,
    services: { on: bool(s('services').on, base.services.on), title: str(s('services').title, 80), items: titled(s('services').items, LIMITS.services) },
    about: { on: bool(s('about').on, base.about.on), title: str(s('about').title, 80), text: str(s('about').text, 1500), photo: cleanPhoto(s('about').photo, ownerId) },
    method: { on: bool(s('method').on, base.method.on), title: str(s('method').title, 80), items: titled(s('method').items, LIMITS.method) },
    testimonials: {
      on: bool(s('testimonials').on, base.testimonials.on),
      title: str(s('testimonials').title, 80),
      items: arr(s('testimonials').items)
        .map((x) => {
          const stars = Math.round(Number(obj(x).stars))
          return { name: str(obj(x).name, 60), text: str(obj(x).text, 500), stars: stars >= 1 && stars <= 5 ? stars : 0 }
        })
        .filter((x) => x.text)
        .slice(0, LIMITS.testimonials),
      googleUrl: cleanUrl(s('testimonials').googleUrl),
    },
    gallery: {
      on: bool(s('gallery').on, base.gallery.on),
      title: str(s('gallery').title, 80),
      photos: arr(s('gallery').photos)
        .map((p) => cleanPhoto(p, ownerId))
        .filter(Boolean)
        .slice(0, LIMITS.gallery),
    },
    hours: {
      on: bool(s('hours').on, base.hours.on),
      title: str(s('hours').title, 80),
      rows: arr(s('hours').rows)
        .map((x) => ({ day: str(obj(x).day, 40), hours: str(obj(x).hours, 60) }))
        .filter((x) => x.day || x.hours)
        .slice(0, LIMITS.hours),
      note: str(s('hours').note, 200),
    },
    contacts: {
      on: bool(s('contacts').on, base.contacts.on),
      title: str(s('contacts').title, 80),
      phone: cleanPhone(s('contacts').phone),
      whatsapp: cleanPhone(s('contacts').whatsapp),
      email: cleanEmail(s('contacts').email),
      address: str(s('contacts').address, 160),
      city: str(s('contacts').city, 80),
      // Modulo "Scrivimi": il messaggio arriva nella casella del titolare
      form: bool(s('contacts').form, true),
    },
    social: {
      instagram: cleanUrl(s('social').instagram),
      facebook: cleanUrl(s('social').facebook),
      linkedin: cleanUrl(s('social').linkedin),
      tiktok: cleanUrl(s('social').tiktok),
      youtube: cleanUrl(s('social').youtube),
      website: cleanUrl(s('social').website),
    },
    links: { menu: bool(s('links').menu, false) },
    footer: { businessName: str(s('footer').businessName, 120), vat: str(s('footer').vat, 30) },
    seo: { description: str(s('seo').description, 170) },
  }
}

// ---------------------------------------------------------------------------
// Indirizzo della pagina: kumani.io/p/<slug>
// ---------------------------------------------------------------------------

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/
const RESERVED = new Set([
  'admin', 'api', 'app', 'kumani', 'staff', 'support', 'supporto', 'help', 'aiuto', 'info', 'privacy', 'termini', 'terms',
  'login', 'register', 'dashboard', 'pro', 'base', 'official', 'ufficiale', 'test', 'demo', 'www', 'mail', 'polizia', 'banca',
])

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

export function slugProblem(slug: string): 'slugInvalid' | 'slugReserved' | null {
  if (!SLUG_RE.test(slug) || slug.includes('--')) return 'slugInvalid'
  if (RESERVED.has(slug) || slug.startsWith('kumani')) return 'slugReserved'
  return null
}

// ---------------------------------------------------------------------------
// Stile: tre modelli, un colore principale scelto dall'utente
// ---------------------------------------------------------------------------

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export type LandingTheme = {
  bg: string
  surface: string
  text: string
  muted: string
  line: string
  accent: string
  onAccent: string
  heroBg: string
  heroText: string
  heroMuted: string
}

export function landingTheme(template: LandingTemplate, accent: string): LandingTheme {
  const a = /^#[0-9a-f]{6}$/i.test(accent) ? accent.toLowerCase() : '#c79a3b'
  const onAccent = luminance(a) > 0.45 ? '#141414' : '#ffffff'
  if (template === 'chiaro') {
    return { bg: '#faf8f4', surface: '#ffffff', text: '#1c1b19', muted: '#5f5a52', line: 'rgba(28,27,25,0.12)', accent: a, onAccent, heroBg: '#ffffff', heroText: '#1c1b19', heroMuted: '#5f5a52' }
  }
  if (template === 'colore') {
    return { bg: '#f7f7f5', surface: '#ffffff', text: '#1c1b19', muted: '#5f5a52', line: 'rgba(28,27,25,0.12)', accent: a, onAccent, heroBg: a, heroText: onAccent, heroMuted: onAccent === '#ffffff' ? 'rgba(255,255,255,0.82)' : 'rgba(20,20,20,0.75)' }
  }
  return { bg: '#141414', surface: 'rgba(255,255,255,0.05)', text: '#f5f3ee', muted: 'rgba(245,243,238,0.7)', line: 'rgba(255,255,255,0.12)', accent: a, onAccent, heroBg: '#141414', heroText: '#f5f3ee', heroMuted: 'rgba(245,243,238,0.72)' }
}

export const landingPhotoUrl = (path: string) => (path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/landing-photos/${path}` : '')

// Pulsante principale: indirizzo in base al tipo scelto
export function ctaHref(kind: CtaKind, value: string): string {
  if (!value || kind === 'none') return ''
  if (kind === 'whatsapp') return `https://wa.me/${value.replace(/[^\d]/g, '')}`
  if (kind === 'phone') return `tel:${value.replace(/\s/g, '')}`
  if (kind === 'email') return `mailto:${value}`
  return value
}

export type PublicLanding = {
  slug: string
  template: LandingTemplate
  accent: string
  content_locale: LandingLocale
  content: LandingContent
  updated_at: string
  referral_code: string | null
  menu_token: string | null
}
