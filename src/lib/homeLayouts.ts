// Versioni della homepage (Admin → Aspetto homepage). Ogni versione
// memorizzata è una copia congelata della Home (components/home/versions) con
// i suoi sfondi e le sue foto; «bozza» è la Home su cui si lavora
// (components/home/HomeLanding.tsx), da vedere con Anteprima prima di usarla.

export const HOME_LAYOUTS = ['v1', 'v2', 'bozza'] as const
export type HomeLayoutKey = (typeof HOME_LAYOUTS)[number]
export const DEFAULT_HOME_LAYOUT: HomeLayoutKey = 'v1'

// Sfondo di una sezione: scuro o chiaro, con una trama o una foto
export type SectionBg = {
  tone: 'dark' | 'light'
  // shade = nero leggermente più scuro, cream/paper = chiari
  variant?: 'plain' | 'shade' | 'dots' | 'lines' | 'glow' | 'radial' | 'cream' | 'paper' | 'cta'
  image?: string
  // Velatura sopra la foto: soft lascia vedere di più l'immagine
  overlay?: 'strong' | 'soft'
}

export type HomeBand = { image: string; kind: 'quote' | 'community'; quote?: 'bandHelp' | 'bandTogether' | 'bandWork'; position?: string }

export interface HomeLayoutConfig {
  marketplace: SectionBg
  community: SectionBg
  share: SectionBg
  bonus: SectionBg
  benefits: SectionBg
  cta: SectionBg
  bandAfterMarketplace?: HomeBand
  bandAfterBonus?: HomeBand
}

export const HOME_LAYOUT_CONFIG: Record<HomeLayoutKey, HomeLayoutConfig> = {
  // Homepage 1 (foto Pexels, vedi public/home/CREDITS.md)
  v1: {
    marketplace: { tone: 'dark', variant: 'plain' },
    bandAfterMarketplace: { image: '/home/band-circle-table.webp', kind: 'quote', quote: 'bandTogether' },
    community: { tone: 'light', variant: 'cream' },
    share: { tone: 'dark', variant: 'lines' },
    bonus: { tone: 'light', variant: 'paper' },
    benefits: { tone: 'dark', variant: 'plain' },
    cta: { tone: 'dark', image: '/home/band-hands-wood.webp', overlay: 'soft' },
  },
  // Homepage 2: stesse sezioni, apertura con le schede che girano
  v2: {
    marketplace: { tone: 'dark', variant: 'plain' },
    bandAfterMarketplace: { image: '/home/band-circle-table.webp', kind: 'quote', quote: 'bandTogether' },
    community: { tone: 'light', variant: 'cream' },
    share: { tone: 'dark', variant: 'lines' },
    bonus: { tone: 'light', variant: 'paper' },
    benefits: { tone: 'dark', variant: 'plain' },
    cta: { tone: 'dark', image: '/home/band-hands-wood.webp', overlay: 'soft' },
  },
  bozza: {
    marketplace: { tone: 'dark', variant: 'plain' },
    bandAfterMarketplace: { image: '/home/band-circle-table.webp', kind: 'quote', quote: 'bandTogether' },
    community: { tone: 'light', variant: 'cream' },
    share: { tone: 'dark', variant: 'lines' },
    bonus: { tone: 'light', variant: 'paper' },
    benefits: { tone: 'dark', variant: 'plain' },
    cta: { tone: 'dark', image: '/home/band-hands-wood.webp', overlay: 'soft' },
  },
}

// Nomi e descrizioni per l'Admin (area solo in italiano)
export const HOME_LAYOUT_INFO: Record<HomeLayoutKey, { name: string; description: string }> = {
  v1: { name: 'Homepage 1 · 18 ottobre 2026', description: 'Apertura con il logo che gira e le tre porte, KU Karma con «Li guadagni / Li spendi», otto motivi per scegliere KUMANI, sezioni chiare e scure alternate.' },
  v2: { name: 'Homepage 2 · 18 ottobre 2026', description: 'Apertura «un’app sola al posto di tante»: dal computer le schede dei servizi e delle truffe girano attorno al logo e cambiano a caso; dal telefono logo e quattro schede fisse. Il resto come la Homepage 1.' },
  bozza: { name: 'Bozza in lavorazione', description: 'La Home su cui prepariamo le modifiche. Guardala con «Anteprima»: quando va bene la memorizziamo come nuova versione.' },
}

export function isHomeLayout(value: unknown): value is HomeLayoutKey {
  return typeof value === 'string' && (HOME_LAYOUTS as readonly string[]).includes(value)
}
