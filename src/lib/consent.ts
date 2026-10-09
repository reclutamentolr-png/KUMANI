// Consenso ai cookie facoltativi (Linee guida del Garante, 10 giugno 2021).
//
// Le categorie attive si accendono da Admin → Impostazioni → «Cookie
// facoltativi» (system_settings.cookie_consent_categories). Nessuna attiva =
// nessun banner e nessun link «Preferenze cookie»: oggi KUMANI usa solo
// cookie tecnici. Prima di accendere una categoria:
//   1. caricare gli script (statistiche, pixel…) solo dentro
//      <ConsentGate category="..."> o con useConsent, mai direttamente;
//   2. descrivere i nuovi cookie nell'informativa (privacyPage.s7list).
// Se si accende una categoria nuova, il banner ricompare a chi aveva già
// scelto (manca la scelta per quella categoria).
// Regole rispettate dal banner: «Accetta» e «Rifiuta» ugualmente visibili,
// la X vale come rifiuto, niente caselle già spuntate, scelta per categoria,
// scelte modificabili in ogni momento, nuova richiesta solo dopo 6 mesi.

export type ConsentCategory = 'analytics' | 'marketing'

export const ALL_CONSENT_CATEGORIES: ConsentCategory[] = ['analytics', 'marketing']

export const CONSENT_COOKIE = 'kumani_consent'
export const CONSENT_VERSION = 1
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 182 // circa 6 mesi
export const CONSENT_CHANGED_EVENT = 'kumani:consent-changed'
export const OPEN_PREFERENCES_EVENT = 'kumani:cookie-preferences'

export type ConsentChoices = Partial<Record<ConsentCategory, boolean>>
export type ConsentState = { v: number; at: string; choices: ConsentChoices }

export function isConsentCategory(value: unknown): value is ConsentCategory {
  return typeof value === 'string' && (ALL_CONSENT_CATEGORIES as string[]).includes(value)
}

export function parseConsent(raw: string | undefined | null): ConsentState | null {
  if (!raw) return null
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as ConsentState
    if (typeof value?.v !== 'number' || typeof value.at !== 'string' || typeof value.choices !== 'object') return null
    return value
  } catch {
    return null
  }
}

export function readConsent(): ConsentState | null {
  if (typeof document === 'undefined') return null
  const entry = document.cookie.split(';').find((c) => c.trim().startsWith(`${CONSENT_COOKIE}=`))
  return parseConsent(entry?.trim().slice(CONSENT_COOKIE.length + 1))
}

// Serve chiedere? Sì se ci sono categorie attive e manca una scelta valida
// per la versione attuale o per una categoria accesa dopo
export function needsConsent(state: ConsentState | null, active: ConsentCategory[]): boolean {
  if (!active.length) return false
  if (!state || state.v < CONSENT_VERSION) return true
  return active.some((c) => typeof state.choices[c] !== 'boolean')
}

export function writeConsent(choices: ConsentChoices, active: ConsentCategory[]): ConsentState {
  // Si conservano le scelte già fatte per categorie oggi spente
  const clean: ConsentChoices = { ...(readConsent()?.choices ?? {}) }
  for (const c of active) clean[c] = choices[c] === true
  const state: ConsentState = { v: CONSENT_VERSION, at: new Date().toISOString(), choices: clean }
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(state))}; path=/; max-age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: state }))
  return state
}

export function hasConsent(category: ConsentCategory, active: ConsentCategory[], state: ConsentState | null = readConsent()): boolean {
  return active.includes(category) && !!state && state.v >= CONSENT_VERSION && state.choices[category] === true
}

export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))
}
