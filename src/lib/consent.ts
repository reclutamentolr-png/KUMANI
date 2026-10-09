// Consenso ai cookie facoltativi (Linee guida del Garante, 10 giugno 2021).
//
// Oggi KUMANI usa solo cookie tecnici: OPTIONAL_CATEGORIES è vuoto, quindi il
// banner non compare e il link «Preferenze cookie» non si vede. Il giorno in
// cui si aggiungono statistiche o pixel:
//   1. aggiungere la categoria qui sotto (e alzare CONSENT_VERSION se cambia
//      qualcosa per chi ha già scelto, così il banner ricompare);
//   2. caricare gli script solo dentro <ConsentGate category="..."> (o con
//      useConsent), mai direttamente;
//   3. descrivere i nuovi cookie nell'informativa (privacyPage.s7list),
//      compreso «kumani_consent» che ricorda le scelte per 6 mesi.
// Regole già rispettate dal banner: «Accetta» e «Rifiuta» ugualmente visibili,
// la X vale come rifiuto, niente caselle già spuntate, scelta per categoria,
// scelte modificabili in ogni momento, nuova richiesta solo dopo 6 mesi.

export type ConsentCategory = 'analytics' | 'marketing'

export const OPTIONAL_CATEGORIES: ConsentCategory[] = []

export const CONSENT_COOKIE = 'kumani_consent'
export const CONSENT_VERSION = 1
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 182 // circa 6 mesi
export const CONSENT_CHANGED_EVENT = 'kumani:consent-changed'
export const OPEN_PREFERENCES_EVENT = 'kumani:cookie-preferences'

export type ConsentChoices = Partial<Record<ConsentCategory, boolean>>
export type ConsentState = { v: number; at: string; choices: ConsentChoices }

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

// Serve chiedere? Sì se ci sono categorie facoltative e manca una scelta
// valida per la versione attuale (o per una categoria aggiunta dopo)
export function needsConsent(state: ConsentState | null): boolean {
  if (!OPTIONAL_CATEGORIES.length) return false
  if (!state || state.v < CONSENT_VERSION) return true
  return OPTIONAL_CATEGORIES.some((c) => typeof state.choices[c] !== 'boolean')
}

export function writeConsent(choices: ConsentChoices): ConsentState {
  const clean: ConsentChoices = {}
  for (const c of OPTIONAL_CATEGORIES) clean[c] = choices[c] === true
  const state: ConsentState = { v: CONSENT_VERSION, at: new Date().toISOString(), choices: clean }
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(state))}; path=/; max-age=${CONSENT_MAX_AGE}; SameSite=Lax${secure}`
  window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: state }))
  return state
}

export function hasConsent(category: ConsentCategory, state: ConsentState | null = readConsent()): boolean {
  return OPTIONAL_CATEGORIES.includes(category) && !!state && state.v >= CONSENT_VERSION && state.choices[category] === true
}

export function openCookiePreferences() {
  window.dispatchEvent(new Event(OPEN_PREFERENCES_EVENT))
}
