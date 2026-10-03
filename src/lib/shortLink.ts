const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // unambiguous base32-ish

// Generatore casuale crittografico (non prevedibile come Math.random)
export function generateShortCode(length = 8): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  // 256 è multiplo di 32: nessuna lettera più probabile delle altre
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('')
}
