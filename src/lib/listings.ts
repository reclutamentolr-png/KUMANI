// src/lib/listings.ts
import { EVENT_COUNTRIES } from '@/lib/events'

export const LISTING_COST = 10

// Nazioni proposte per la località degli annunci (le stesse degli Eventi;
// i nomi si mostrano nella lingua di chi guarda con countryName()).
export const LISTING_COUNTRIES: readonly string[] = EVENT_COUNTRIES

export function isListingCountry(code: string | null | undefined): code is string {
  return !!code && LISTING_COUNTRIES.includes(code)
}

// Città scritta dall'utente: spazi in ordine, massimo 80 caratteri, prima
// lettera maiuscola ("milano" -> "Milano"), apostrofi tenuti ("L'Aquila").
// Il confronto è senza maiuscole; nel filtro la città sta tra virgolette.
export function cleanListingCity(raw: string | null | undefined): string | null {
  const city = (raw ?? '').replace(/[,()*%\\:"`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80)
  return city ? city.charAt(0).toUpperCase() + city.slice(1) : null
}

// Mirrors subito.it's top-level category taxonomy (12 categories), replacing
// the earlier ad-hoc 4-category set.
export type ListingCategory =
  | 'veicoli'
  | 'immobili'
  | 'elettronica'
  | 'moda'
  | 'casa_persona'
  | 'tempo_libero'
  | 'colf_badanti'
  | 'agricoltura'
  | 'animali'
  | 'impresa'
  | 'servizi'

export interface CreateListingData {
  userId: string
  title: string
  description: string
  category: ListingCategory
  price?: number
  imageUrl?: string
  countryCode?: string
  city?: string
  isRemote?: boolean
  featureDurationDays?: 7 | 15
}

export interface UpdateListingData {
  title: string
  description: string
  category: ListingCategory
  price?: number
  imageUrl?: string
  countryCode?: string
  city?: string
  isRemote?: boolean
}

export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  veicoli: 'Veicoli',
  immobili: 'Immobili',
  elettronica: 'Elettronica',
  moda: 'Moda e Accessori',
  casa_persona: 'Casa e Persona',
  tempo_libero: 'Tempo Libero, Sport e Hobby',
  colf_badanti: 'Colf, Badanti e Baby Sitter',
  agricoltura: 'Agricoltura e Giardinaggio',
  animali: 'Animali',
  impresa: 'Per la tua Impresa',
  servizi: 'Servizi'
}

export const CATEGORY_ICONS: Record<ListingCategory, string> = {
  veicoli: '🚗',
  immobili: '🏠',
  elettronica: '📱',
  moda: '👗',
  casa_persona: '🛋️',
  tempo_libero: '⚽',
  colf_badanti: '🧹',
  agricoltura: '🌱',
  animali: '🐾',
  impresa: '🏢',
  servizi: '🔧'
}

// Translation key (marketplace namespace) for each category, used wherever
// a category needs a localized label via t(CATEGORY_I18N_KEYS[cat]).
export const CATEGORY_I18N_KEYS: Record<ListingCategory, string> = {
  veicoli: 'catVeicoli',
  immobili: 'catImmobili',
  elettronica: 'catElettronica',
  moda: 'catModa',
  casa_persona: 'catCasaPersona',
  tempo_libero: 'catTempoLibero',
  colf_badanti: 'catColfBadanti',
  agricoltura: 'catAgricoltura',
  animali: 'catAnimali',
  impresa: 'catImpresa',
  servizi: 'catServizi'
}

export const ALL_LISTING_CATEGORIES: ListingCategory[] = [
  'veicoli',
  'immobili',
  'elettronica',
  'moda',
  'casa_persona',
  'tempo_libero',
  'colf_badanti',
  'agricoltura',
  'animali',
  'impresa',
  'servizi'
]
