// Angolo Bambini: blocco del genitore. Mentre il bambino gioca, il gioco
// lascia questo cookie con l'id dell'account; il proxy riporta ogni altra
// pagina di KUMANI all'Angolo Bambini finché il genitore non lo toglie con il
// suo codice. Il codice non va mai al server: resta nel telefono (storage.ts).
// Senza dipendenze dal browser: lo usa anche il proxy.

export const KIDS_LOCK_COOKIE = 'kumani_kids_lock'
export const KIDS_PATH = '/app/angolo-bambini'

// Pagine raggiungibili anche con il blocco attivo (il gioco stesso, l'uscita
// dall'account e le pagine tecniche)
export const KIDS_LOCK_ALLOWED = /^\/(app\/angolo-bambini|auth|login|logout|maintenance)(\/|$)/
