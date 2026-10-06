// KUMANI Menu — tipi e regole condivise da builder, azioni e pagina pubblica.
import type { MenuTemplate } from '@/lib/menuThemes'

export const MENU_LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'] as const
export type MenuLocale = (typeof MENU_LOCALES)[number]

// Nome di ogni lingua nella lingua stessa (per il selettore del cliente).
export const MENU_LOCALE_NAMES: Record<MenuLocale, string> = {
  it: 'Italiano',
  en: 'English',
  fr: 'Français',
  es: 'Español',
  pt: 'Português',
  de: 'Deutsch',
  ru: 'Русский',
}

export const MENU_DIET_TAGS = ['vegetarian', 'vegan', 'gluten_free', 'spicy', 'chef', 'new'] as const
export type MenuDietTag = (typeof MENU_DIET_TAGS)[number]

// I 14 allergeni del Reg. UE 1169/2011 (Allegato II), nell'ordine ufficiale:
// il numero mostrato nel menù è la posizione in questa lista + 1.
export const MENU_ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const
export type MenuAllergen = (typeof MENU_ALLERGENS)[number]

export function allergenNumber(allergen: MenuAllergen): number {
  return MENU_ALLERGENS.indexOf(allergen) + 1
}

export type LocalizedText = Partial<Record<MenuLocale, string>>

// URL pubblico della foto di un piatto (bucket pubblico menu-photos).
export function menuPhotoUrl(path: string | null | undefined): string | null {
  if (!path) return null
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/menu-photos/${path}`
}

export type MenuItem = {
  id: string
  category_id: string
  position: number
  name: string
  names: LocalizedText
  descriptions: LocalizedText
  price: number | null
  diet_tags: MenuDietTag[]
  allergens: MenuAllergen[]
  photo_path: string | null
  available: boolean
  is_daily_special: boolean
  // Prodotto del Magazzino collegato (giacenza zero = esaurito)
  inventory_product_id?: string | null
}

export type MenuCategory = {
  id: string
  position: number
  names: LocalizedText
}

export type MenuSettings = {
  id: string
  restaurant_name: string
  tagline: string | null
  review_url: string | null
  template: MenuTemplate
  token: string
  default_locale: MenuLocale
  languages: MenuLocale[]
  is_active: boolean
}

export type MenuData = {
  menu: MenuSettings | null
  categories: MenuCategory[]
  items: MenuItem[]
}

export function isMenuLocale(value: unknown): value is MenuLocale {
  return typeof value === 'string' && (MENU_LOCALES as readonly string[]).includes(value)
}

// Testo nella lingua richiesta, altrimenti nella lingua principale del menù,
// altrimenti il primo disponibile.
export function pickText(texts: LocalizedText | null | undefined, lang: MenuLocale, fallback: MenuLocale): string {
  if (!texts) return ''
  return texts[lang]?.trim() || texts[fallback]?.trim() || Object.values(texts).find((v) => v?.trim())?.trim() || ''
}

// Pulisce un oggetto di testi per lingua: solo lingue note, testo tagliato.
export function cleanLocalized(input: unknown, maxLength: number): LocalizedText {
  const out: LocalizedText = {}
  if (!input || typeof input !== 'object') return out
  for (const locale of MENU_LOCALES) {
    const value = (input as Record<string, unknown>)[locale]
    if (typeof value === 'string' && value.trim()) out[locale] = value.trim().slice(0, maxLength)
  }
  return out
}

export function formatMenuPrice(price: number | null, lang: MenuLocale, currency = 'EUR'): string {
  if (price === null || price === undefined) return ''
  return new Intl.NumberFormat(lang, { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(price))
}

// Lingua del cliente dall'header Accept-Language, tra quelle del menù.
export function detectMenuLocale(acceptLanguage: string | null, available: MenuLocale[], fallback: MenuLocale): MenuLocale {
  if (!acceptLanguage) return fallback
  const wanted = acceptLanguage
    .split(',')
    .map((part) => part.split(';')[0].trim().slice(0, 2).toLowerCase())
    .filter(Boolean)
  return (wanted.find((code) => (available as string[]).includes(code)) as MenuLocale | undefined) ?? fallback
}
