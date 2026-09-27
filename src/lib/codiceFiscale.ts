// Verifica del codice fiscale italiano: formato, carattere di controllo e
// coerenza con cognome, nome e data di nascita del profilo. Gestisce
// l'omocodia (cifre sostituite da lettere). Non chiama servizi esterni.

const MONTHS = 'ABCDEHLMPRST'
const OMOCODIA = 'LMNPQRSTUV'
const OMOCODIA_POSITIONS = [6, 7, 9, 10, 12, 13, 14]

const ODD: Record<string, number> = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18,
  N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
}

function evenValue(char: string): number {
  return /\d/.test(char) ? Number(char) : char.charCodeAt(0) - 65
}

export function normalizeTaxCode(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

function checkChar(code15: string): string {
  let sum = 0
  for (let i = 0; i < 15; i++) {
    const c = code15[i]
    sum += i % 2 === 0 ? ODD[c] : evenValue(c)
  }
  return String.fromCharCode(65 + (sum % 26))
}

// Lettere "pulite" (senza accenti, spazi e apostrofi)
function letters(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
}

function split(value: string) {
  const l = letters(value)
  return { consonants: l.replace(/[AEIOU]/g, ''), vowels: l.replace(/[^AEIOU]/g, '') }
}

function surnameCode(surname: string): string {
  const { consonants, vowels } = split(surname)
  return (consonants + vowels + 'XXX').slice(0, 3)
}

function nameCode(name: string): string {
  const { consonants, vowels } = split(name)
  if (consonants.length >= 4) return consonants[0] + consonants[2] + consonants[3]
  return (consonants + vowels + 'XXX').slice(0, 3)
}

// Cifre al posto delle lettere di omocodia
function deOmocodia(code: string): string {
  const chars = code.split('')
  for (const i of OMOCODIA_POSITIONS) {
    const idx = OMOCODIA.indexOf(chars[i])
    if (idx >= 0) chars[i] = String(idx)
  }
  return chars.join('')
}

export type TaxCodeError = 'format' | 'checksum' | 'surname' | 'name' | 'birthdate'

export function validateTaxCode(
  raw: string,
  person: { firstName: string; lastName: string; birthDate: string | null }
): TaxCodeError | null {
  const code = normalizeTaxCode(raw)
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(code)) return 'format'
  if (checkChar(code.slice(0, 15)) !== code[15]) return 'checksum'
  if (code.slice(0, 3) !== surnameCode(person.lastName)) return 'surname'
  if (code.slice(3, 6) !== nameCode(person.firstName)) return 'name'

  if (person.birthDate && /^\d{4}-\d{2}-\d{2}$/.test(person.birthDate)) {
    const plain = deOmocodia(code)
    const year = plain.slice(6, 8)
    const month = MONTHS.indexOf(plain[8]) + 1
    const day = Number(plain.slice(9, 11))
    const [by, bm, bd] = person.birthDate.split('-').map(Number)
    const dayOk = day === bd || day === bd + 40
    if (year !== String(by).slice(2) || month !== bm || !dayOk) return 'birthdate'
  }
  return null
}
