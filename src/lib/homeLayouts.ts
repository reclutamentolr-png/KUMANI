// Layout della homepage scelti dall'Admin (Admin → Aspetto homepage).
// Cambiano solo sfondi, foto, trame e alternanza chiaro/scuro: testi,
// titoli, link e struttura restano identici (nessun effetto sulla SEO).

export const HOME_LAYOUTS = ['classic', 'hands_walk', 'hands', 'night', 'cream_bands', 'workshops', 'night_bands'] as const
export type HomeLayoutKey = (typeof HOME_LAYOUTS)[number]
export const DEFAULT_HOME_LAYOUT: HomeLayoutKey = 'classic'

// Sfondo di una sezione: scuro o chiaro, con una trama o una foto
export type SectionBg = {
  tone: 'dark' | 'light'
  // shade = nero leggermente più scuro (come oggi), cream/paper = chiari
  variant?: 'plain' | 'shade' | 'dots' | 'lines' | 'glow' | 'radial' | 'cream' | 'paper' | 'cta'
  image?: string
  // Velatura sopra la foto: soft lascia vedere di più l'immagine
  overlay?: 'strong' | 'soft'
}

export type HomeBand = { image: string; kind: 'quote' | 'community'; quote?: 'bandHelp' | 'bandTogether' | 'bandWork'; position?: string }

export interface HomeLayoutConfig {
  hero: { kind: 'classic' | 'photo' | 'split'; image?: string; video?: boolean; variant?: SectionBg['variant'] }
  marketplace: SectionBg
  community: SectionBg
  share: SectionBg
  bonus: SectionBg
  benefits: SectionBg
  cta: SectionBg
  bandAfterMarketplace?: HomeBand
  bandAfterBonus?: HomeBand
}

const IMG = {
  circle: '/home/circle.webp',
  heart: '/home/heart.webp',
  volunteer: '/home/volunteer.webp',
  artisan: '/home/artisan.webp',
  cafe: '/home/cafe.webp',
  toast: '/home/toast.webp',
  phone: '/home/phone.webp',
  walk: '/home/walk-together.webp',
}

const classic: HomeLayoutConfig = {
  hero: { kind: 'classic', video: true },
  marketplace: { tone: 'dark', variant: 'plain' },
  community: { tone: 'dark', variant: 'shade' },
  share: { tone: 'dark', variant: 'plain' },
  bonus: { tone: 'dark', variant: 'shade' },
  benefits: { tone: 'dark', variant: 'plain' },
  cta: { tone: 'dark', variant: 'cta' },
}

export const HOME_LAYOUT_CONFIG: Record<HomeLayoutKey, HomeLayoutConfig> = {
  classic,
  hands_walk: {
    hero: { kind: 'photo', image: IMG.circle, video: true },
    marketplace: { tone: 'dark', variant: 'dots' },
    community: { tone: 'light', variant: 'cream' },
    share: { tone: 'dark', variant: 'lines' },
    bonus: { tone: 'light', variant: 'paper' },
    benefits: { tone: 'dark', variant: 'lines' },
    cta: { tone: 'dark', image: IMG.walk, overlay: 'soft' },
  },
  hands: {
    hero: { kind: 'photo', image: IMG.circle, video: true },
    marketplace: { tone: 'dark', variant: 'dots' },
    community: { tone: 'light', variant: 'cream' },
    share: { tone: 'dark', variant: 'lines' },
    bonus: { tone: 'light', variant: 'paper' },
    benefits: { tone: 'dark', variant: 'lines' },
    cta: { tone: 'dark', image: IMG.circle },
  },
  night: {
    hero: { kind: 'classic', variant: 'radial', video: true },
    marketplace: { tone: 'dark', variant: 'dots' },
    community: { tone: 'dark', variant: 'lines' },
    share: { tone: 'dark', variant: 'dots' },
    bandAfterMarketplace: { image: IMG.heart, kind: 'community' },
    bonus: { tone: 'dark', variant: 'lines' },
    benefits: { tone: 'dark', variant: 'plain' },
    cta: { tone: 'dark', variant: 'glow' },
  },
  cream_bands: {
    hero: { kind: 'photo', image: IMG.volunteer, video: true },
    marketplace: { tone: 'light', variant: 'paper' },
    community: { tone: 'dark', variant: 'dots' },
    share: { tone: 'light', variant: 'cream' },
    bandAfterMarketplace: { image: IMG.circle, kind: 'quote', quote: 'bandTogether' },
    bonus: { tone: 'light', variant: 'cream' },
    benefits: { tone: 'light', variant: 'paper' },
    cta: { tone: 'dark', image: IMG.heart },
  },
  workshops: {
    hero: { kind: 'photo', image: IMG.artisan, video: true },
    marketplace: { tone: 'light', variant: 'cream' },
    community: { tone: 'dark', variant: 'dots' },
    share: { tone: 'light', variant: 'paper' },
    bandAfterMarketplace: { image: IMG.circle, kind: 'quote', quote: 'bandHelp' },
    bonus: { tone: 'dark', variant: 'dots' },
    benefits: { tone: 'light', variant: 'paper' },
    cta: { tone: 'dark', image: IMG.cafe },
  },
  night_bands: {
    hero: { kind: 'photo', image: IMG.phone, video: true },
    marketplace: { tone: 'dark', variant: 'dots' },
    community: { tone: 'dark', variant: 'lines' },
    share: { tone: 'dark', variant: 'dots' },
    bandAfterMarketplace: { image: IMG.artisan, kind: 'quote', quote: 'bandWork', position: 'center 30%' },
    bonus: { tone: 'dark', variant: 'lines' },
    bandAfterBonus: { image: IMG.circle, kind: 'community' },
    benefits: { tone: 'dark', variant: 'plain' },
    cta: { tone: 'dark', image: IMG.toast },
  },
}

// Nomi e descrizioni per l'Admin (area solo in italiano)
export const HOME_LAYOUT_INFO: Record<HomeLayoutKey, { name: string; description: string }> = {
  classic: { name: 'Attuale', description: 'La homepage di sempre: tutta scura con dettagli oro.' },
  hands_walk: { name: 'Cerchio di mani + cammino insieme', description: 'Come “Cerchio di mani”, con la chiusura su due persone che camminano insieme al tramonto (“Il primo passo è tuo”).' },
  hands: { name: 'Cerchio di mani', description: 'Foto del cerchio di mani nell’apertura e nella chiusura, sezioni alternate crema e scure.' },
  night: { name: 'Notte dorata', description: 'Tutta scura con trame dorate e una fascia foto per la community.' },
  cream_bands: { name: 'Crema con fasce foto', description: 'Pagina chiara, foto di volontariato nell’apertura e fasce fotografiche.' },
  workshops: { name: 'Botteghe e mestieri', description: 'L’artigiano nell’apertura, sezioni alternate e chiusura sul bar.' },
  night_bands: { name: 'Scura con fasce foto', description: 'Scura e dorata con fasce fotografiche tra le sezioni.' },
}

export function isHomeLayout(value: unknown): value is HomeLayoutKey {
  return typeof value === 'string' && (HOME_LAYOUTS as readonly string[]).includes(value)
}
