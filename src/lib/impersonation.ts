// Impersonificazione dello Staff: i dati temporanei (link per tornare
// all'account admin e nome dell'admin) stanno nella memoria della SOLA
// scheda (sessionStorage), che si cancella chiudendola: niente tracce nel
// browser se si chiude senza "Torna Admin". Prima erano in localStorage e
// restavano anche per chi usava il browser dopo.
const RESTORE_KEY = 'kumani_impersonation_restore'
const ADMIN_NAME_KEY = 'kumani_impersonation_admin'
// Sigillo della scheda: i link di accesso valgono solo nella scheda che li ha chiesti
const NONCE_KEY = 'kumani_impersonation_nonce'
const LEGACY_KEYS = ['impersonation_restore', 'impersonatingAdmin']

function clearLegacy() {
  try {
    for (const key of LEGACY_KEYS) localStorage.removeItem(key)
  } catch {
    // memoria del browser non disponibile
  }
}

// Prima di chiedere i link: crea e salva il sigillo di questa scheda
export function newImpersonationNonce(): string {
  const nonce = crypto.randomUUID()
  try {
    sessionStorage.setItem(NONCE_KEY, nonce)
  } catch {
    // memoria del browser non disponibile: il rientro verrà rifiutato
  }
  return nonce
}

export function checkImpersonationNonce(nonce: string | null): boolean {
  try {
    const saved = sessionStorage.getItem(NONCE_KEY)
    return !!nonce && !!saved && saved === nonce
  } catch {
    return false
  }
}

export function clearImpersonationNonce() {
  try {
    sessionStorage.removeItem(NONCE_KEY)
  } catch {
    // memoria del browser non disponibile
  }
}

export function startImpersonation(restoreUrl: string, adminName: string) {
  clearLegacy()
  try {
    sessionStorage.setItem(RESTORE_KEY, restoreUrl)
    sessionStorage.setItem(ADMIN_NAME_KEY, adminName)
  } catch {
    // memoria del browser non disponibile
  }
}

export function readImpersonation(): { restoreUrl: string; adminName: string } | null {
  clearLegacy()
  try {
    const restoreUrl = sessionStorage.getItem(RESTORE_KEY)
    if (!restoreUrl) return null
    return { restoreUrl, adminName: sessionStorage.getItem(ADMIN_NAME_KEY) ?? '' }
  } catch {
    return null
  }
}

export function endImpersonation() {
  clearLegacy()
  try {
    sessionStorage.removeItem(RESTORE_KEY)
    sessionStorage.removeItem(ADMIN_NAME_KEY)
  } catch {
    // memoria del browser non disponibile
  }
}
