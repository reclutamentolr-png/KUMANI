// Kumano del Giorno — tipi condivisi tra server actions, pagina di gestione
// (/app/spotlight) e vetrina pubblica (/spotlight).

export interface SpotlightProfile {
  id: string
  user_id: string
  display_name: string
  city: string | null
  country: string | null
  profession: string | null
  story: string
  favorite_tools: string[]
  is_opted_in: boolean
  moderation_status: SpotlightModerationStatus
  show_on_home: boolean
  home_consent_at: string | null
  story_locale: string | null
  created_at: string
  updated_at: string
}

export type SpotlightModerationStatus = 'pending' | 'approved' | 'rejected'

export const SPOTLIGHT_STORY_MAX_LENGTH = 400

// Tag di cache della fascia "Oggi in community" in home: ogni azione che
// cambia chi può comparire in home (revoca, eliminazione, moderazione)
// lo invalida subito, così una revoca non resta visibile in cache.
export const SPOTLIGHT_HOME_CACHE_TAG = 'spotlight-today'

// Soglia anti cold-start: sotto questo numero di storie approvate con
// consenso home, la landing mostra la storia di fallback curata.
export const SPOTLIGHT_HOME_MIN_POOL = 10

// Chip "lingua originale" della card: bandiera per ciascuna lingua del sito.
export const SPOTLIGHT_LOCALE_FLAGS: Record<string, string> = {
  it: '🇮🇹',
  en: '🇬🇧',
  fr: '🇫🇷',
  es: '🇪🇸',
  pt: '🇧🇷',
  de: '🇩🇪',
  ru: '🇷🇺',
}

/**
 * get_todays_kumano() è dichiarata "returns spotlight_profiles" (non
 * SETOF): quando non c'è ancora nessuno in vetrina, PostgREST restituisce
 * comunque un oggetto con tutti i campi a null invece di un null secco —
 * questo helper lo riconosce.
 */
export function isEmptySpotlightProfile(profile: SpotlightProfile | null | undefined): boolean {
  return !profile?.id
}
