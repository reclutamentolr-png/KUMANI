// Errori di Supabase Auth (registrazione, codici, password) tradotti nella
// lingua dell'utente: Supabase li restituisce solo in inglese. Si riconoscono
// dal codice (error.code) e, per le versioni che non lo mandano, dal testo.
// Restituisce la chiave nel namespace "auth" dei messaggi, oppure null se
// l'errore non viene da Supabase (es. un messaggio già tradotto dal sito).
const BY_CODE: Record<string, string> = {
  same_password: 'samePasswordError',
  weak_password: 'weakPasswordError',
  over_email_send_rate_limit: 'tooManyEmailsError',
  over_request_rate_limit: 'tooManyRequestsError',
  email_address_invalid: 'invalidEmailError',
  email_address_not_authorized: 'invalidEmailError',
  validation_failed: 'invalidEmailError',
  otp_expired: 'invalidVerificationCode',
  otp_disabled: 'invalidVerificationCode',
}

const BY_TEXT: [RegExp, string][] = [
  [/different from the old password/i, 'samePasswordError'],
  [/password should (be at least|contain)|weak password/i, 'weakPasswordError'],
  [/email rate limit|security purposes, you can only request/i, 'tooManyEmailsError'],
  [/rate limit|too many requests/i, 'tooManyRequestsError'],
  [/invalid (format|email)|email address .* is invalid|unable to validate email/i, 'invalidEmailError'],
  [/token has expired|otp.*(expired|invalid)/i, 'invalidVerificationCode'],
]

export function authErrorKey(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const { code, message, name } = error as { code?: string; message?: string; name?: string }
  if (code && BY_CODE[code]) return BY_CODE[code]
  if (message) {
    for (const [pattern, key] of BY_TEXT) if (pattern.test(message)) return key
  }
  // Altro errore di Supabase non previsto: messaggio generico, mai l'inglese
  if (name?.startsWith('Auth') || code) return 'genericAuthError'
  return null
}

// Testo da mostrare: errore Supabase tradotto, altrimenti il messaggio così
// com'è (già tradotto dal sito), altrimenti il testo di riserva
export function authErrorText(t: (key: string) => string, error: unknown, fallback: string): string {
  const key = authErrorKey(error)
  if (key) return t(key)
  return (error instanceof Error && error.message) || fallback
}
