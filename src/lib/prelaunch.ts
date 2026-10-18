// Pre-lancio (Admin → Impostazioni → Sistema): finché è acceso, chi non è
// iscritto vede «KUMANI sta arrivando» al posto delle pagine di presentazione
// del sito. Restano aperte le pagine legate a un codice o a un link (negozi,
// menù, CV, preventivi, ricevute, sorprese…), che i clienti degli iscritti
// devono poter aprire, e l'accesso. Si entra lo stesso con un account o con
// il link d'anteprima (/anteprima?chiave=…), che lascia un cookie nel browser.
// Usato dal proxy: niente import da Node.

export const PREVIEW_COOKIE = 'kumani_anteprima'
export const PREVIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 60 // 60 giorni

// Pagine di presentazione (indirizzo senza lingua): quelle nascoste
export const PRELAUNCH_HIDDEN =
  /^\/(?:(?:servizi|catalogo|chi-siamo|contact|pro|donazioni|controlla|test-truffa|regali|register|rewards|spotlight|viaggi|sorprese|events|recensioni(?:\/scrivi)?)|(?:strumenti|documenti|guida|manuale-antitruffa|pass|ref)(?:\/.*)?)?\/?$/

// Chiave del link d'anteprima: lettere, numeri, - e _ (da 12 a 64)
export const PRELAUNCH_KEY_PATTERN = /^[A-Za-z0-9_-]{12,64}$/

// Nel cookie va l'impronta della chiave, non la chiave: cambiando la chiave
// dall'Admin i cookie già dati smettono di valere
export async function previewToken(key: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`kumani-anteprima:${key}`))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
