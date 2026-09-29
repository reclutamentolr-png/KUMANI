// Verifica IBAN: funzioni pure, tutto nel browser, nessuna chiamata di rete.
//
// Auto-verifica fatta a mano (e con uno script node poi cancellato):
//   IT60X0542811101000000123456   -> valido (IT, CIN X, ABI 05428, CAB 11101, conto 000000123456)
//   GB82WEST12345698765432        -> valido (GB, 22 caratteri)
//   DE89370400440532013000        -> valido (DE, 22 caratteri)
//   FR1420041010050500013M02606   -> valido (FR, 27 caratteri)
//   CH9300762011623852957         -> valido (CH, 21 caratteri)
//   SM86U0322509800000000270100   -> valido (SM, stessa struttura italiana)
//   " it60 x054 2811 1010 0000 0123 456 " -> valido dopo la normalizzazione
//   IT60X0542811101000000123457   -> checksum errato (ultima cifra cambiata)
//   GB82WEST1234569876543         -> lunghezza errata: manca 1 carattere
//   IT60X05428111010000001234     -> lunghezza errata: mancano 2 caratteri
//   DE89370400440532013000123     -> lunghezza errata: 3 caratteri in più
//   XX82WEST12345698765432        -> paese sconosciuto
//   IT6OX0542811101000000123456   -> cifre di controllo non numeriche (O al posto di 0)
//   IT60X0542811101000000123.56   -> carattere non ammesso "."
//   IT6050542811101000000123456   -> CIN non è una lettera
//   NL91ABNA0417164300, TR330006100519786457841326, AE070331234567890123456,
//   SA0380000000608010167519, NO9386011117947 -> validi

/**
 * Lunghezze IBAN per paese, dal registro IBAN SWIFT (ISO 13616).
 * Copre tutti i paesi UE/SEE, Regno Unito, Svizzera e gli altri paesi
 * che aderiscono al registro.
 */
export const IBAN_LENGTHS: Readonly<Record<string, number>> = {
  AD: 24, AE: 23, AL: 28, AT: 20, AZ: 28, BA: 20, BE: 16, BG: 22, BH: 22, BI: 27,
  BR: 29, BY: 28, CH: 21, CR: 22, CY: 28, CZ: 24, DE: 22, DJ: 27, DK: 18, DO: 28,
  EE: 20, EG: 29, ES: 24, FI: 18, FK: 18, FO: 18, FR: 27, GB: 22, GE: 22, GI: 23,
  GL: 18, GR: 27, GT: 28, HN: 28, HR: 21, HU: 28, IE: 22, IL: 23, IQ: 23, IS: 26,
  IT: 27, JO: 30, KW: 30, KZ: 20, LB: 28, LC: 32, LI: 21, LT: 20, LU: 20, LV: 21,
  LY: 25, MC: 27, MD: 24, ME: 22, MK: 19, MN: 20, MR: 27, MT: 31, MU: 30, NI: 28,
  NL: 18, NO: 15, OM: 23, PK: 24, PL: 28, PS: 29, PT: 25, QA: 29, RO: 24, RS: 22,
  RU: 33, SA: 24, SC: 31, SD: 18, SE: 24, SI: 19, SK: 24, SM: 27, SO: 23, ST: 25,
  SV: 28, TL: 23, TN: 24, TR: 26, UA: 29, VA: 22, VG: 24, XK: 20, YE: 30,
}

/** Paesi con la struttura italiana: CIN (1 lettera) + ABI (5) + CAB (5) + conto (12). */
const ITALIAN_STRUCTURE = new Set(['IT', 'SM'])

export type IbanIssue =
  | { code: 'empty' }
  | { code: 'invalidChars'; chars: string[] }
  | { code: 'badCountryFormat' }
  | { code: 'unknownCountry'; country: string }
  | { code: 'badCheckDigits' }
  | { code: 'tooShort'; missing: number; expected: number }
  | { code: 'tooLong'; extra: number; expected: number }
  | { code: 'badItalianPart'; part: 'cin' | 'abi' | 'cab' | 'account' }
  | { code: 'checksum' }

export interface ItalianParts {
  cin: string
  abi: string
  cab: string
  account: string
}

export interface IbanResult {
  /** IBAN senza spazi, in maiuscolo. */
  normalized: string
  /** IBAN a gruppi di 4 caratteri. */
  formatted: string
  /** Codice paese (prime 2 lettere) se riconoscibile, altrimenti null. */
  country: string | null
  /** Lunghezza attesa per il paese, se il paese è nel registro. */
  expectedLength: number | null
  valid: boolean
  issues: IbanIssue[]
  /** Solo per IT e SM, quando la struttura è leggibile. */
  italian: ItalianParts | null
}

/** Toglie spazi (anche non separabili), trattini e mette in maiuscolo. */
export function normalizeIban(input: string): string {
  return input.replace(/[\s  -]+/g, '').toUpperCase()
}

/** Raggruppa a blocchi di 4 caratteri. */
export function formatIban(normalized: string): string {
  return normalized.replace(/(.{4})(?=.)/g, '$1 ')
}

/**
 * Resto mod 97 (ISO 13616 / ISO 7064) calcolato a pezzi: sposta i primi 4
 * caratteri in fondo, converte le lettere in numeri (A=10 … Z=35) e riduce
 * cifra per cifra, così non servono numeri grandi. Richiede solo A-Z e 0-9.
 */
export function ibanMod97(normalized: string): number {
  const rearranged = normalized.slice(4) + normalized.slice(0, 4)
  let remainder = 0
  for (const char of rearranged) {
    const code = char.charCodeAt(0)
    const value = code >= 65 && code <= 90 ? String(code - 55) : char
    for (const digit of value) {
      remainder = (remainder * 10 + (digit.charCodeAt(0) - 48)) % 97
    }
  }
  return remainder
}

/** Divide un IBAN italiano o sammarinese già normalizzato e della lunghezza giusta. */
export function splitItalianIban(normalized: string): ItalianParts {
  return {
    cin: normalized.slice(4, 5),
    abi: normalized.slice(5, 10),
    cab: normalized.slice(10, 15),
    account: normalized.slice(15, 27),
  }
}

export function hasItalianStructure(country: string | null): boolean {
  return country !== null && ITALIAN_STRUCTURE.has(country)
}

/** Controlla un IBAN inserito dall'utente e spiega ogni problema. */
export function validateIban(input: string): IbanResult {
  const normalized = normalizeIban(input)
  const formatted = formatIban(normalized)
  const issues: IbanIssue[] = []
  const base = { normalized, formatted }

  if (normalized.length === 0) {
    return { ...base, country: null, expectedLength: null, valid: false, issues: [{ code: 'empty' }], italian: null }
  }

  const invalid = Array.from(new Set(normalized.replace(/[A-Z0-9]/g, '').split(''))).filter(Boolean)
  if (invalid.length > 0) issues.push({ code: 'invalidChars', chars: invalid })

  const prefix = normalized.slice(0, 2)
  let country: string | null = null
  let expectedLength: number | null = null
  if (prefix.length < 2) {
    // Solo una lettera: lo segnala il controllo di lunghezza qui sotto
  } else if (!/^[A-Z]{2}$/.test(prefix)) {
    issues.push({ code: 'badCountryFormat' })
  } else if (IBAN_LENGTHS[prefix] === undefined) {
    issues.push({ code: 'unknownCountry', country: prefix })
  } else {
    country = prefix
    expectedLength = IBAN_LENGTHS[prefix]
  }

  if (normalized.length >= 4 && !/^[0-9]{2}$/.test(normalized.slice(2, 4))) {
    issues.push({ code: 'badCheckDigits' })
  }

  if (expectedLength !== null) {
    if (normalized.length < expectedLength) {
      issues.push({ code: 'tooShort', missing: expectedLength - normalized.length, expected: expectedLength })
    } else if (normalized.length > expectedLength) {
      issues.push({ code: 'tooLong', extra: normalized.length - expectedLength, expected: expectedLength })
    }
  } else if (country === null && normalized.length < 4) {
    // Troppo corto anche solo per paese e cifre di controllo
    issues.push({ code: 'tooShort', missing: 4 - normalized.length, expected: 4 })
  }

  let italian: ItalianParts | null = null
  const lengthOk = expectedLength !== null && normalized.length === expectedLength
  if (hasItalianStructure(country) && lengthOk && invalid.length === 0) {
    italian = splitItalianIban(normalized)
    if (!/^[A-Z]$/.test(italian.cin)) issues.push({ code: 'badItalianPart', part: 'cin' })
    if (!/^[0-9]{5}$/.test(italian.abi)) issues.push({ code: 'badItalianPart', part: 'abi' })
    if (!/^[0-9]{5}$/.test(italian.cab)) issues.push({ code: 'badItalianPart', part: 'cab' })
    if (!/^[A-Z0-9]{12}$/.test(italian.account)) issues.push({ code: 'badItalianPart', part: 'account' })
  }

  // Il checksum ha senso solo se la struttura di base è corretta
  if (issues.length === 0 && ibanMod97(normalized) !== 1) {
    issues.push({ code: 'checksum' })
  }

  return { ...base, country, expectedLength, valid: issues.length === 0, issues, italian }
}

/** Bandiera emoji dal codice paese (lettere "indicatore regionale"). */
export function countryFlag(country: string): string {
  if (!/^[A-Z]{2}$/.test(country)) return ''
  return String.fromCodePoint(...Array.from(country, (char) => 0x1f1e6 + char.charCodeAt(0) - 65))
}

/** Nome del paese nella lingua dell'utente, con ripiego sul codice. */
export function countryName(country: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(country) ?? country
  } catch {
    return country
  }
}

// --- Segnali di contesto -------------------------------------------------

export const PAYMENT_CONTEXTS = [
  'privateSeller',
  'holidayRental',
  'onlineShop',
  'investment',
  'bill',
  'familyFriend',
  'other',
] as const

export type PaymentContext = (typeof PAYMENT_CONTEXTS)[number]

export type SignalLevel = 'strong' | 'warning' | 'info'

export interface ContextSignal {
  /** Chiave di traduzione del segnale. */
  key: string
  level: SignalLevel
}

/**
 * Combina il motivo del pagamento con il paese dell'IBAN e il paese
 * dell'utente. Non giudica mai una banca o un paese: segnala solo situazioni
 * tipiche delle truffe più diffuse (vedi il Manuale Anti-Truffa).
 */
export function contextSignals(context: PaymentContext, ibanCountry: string, homeCountry: string): ContextSignal[] {
  const foreign = ibanCountry !== homeCountry
  switch (context) {
    case 'privateSeller':
      return [
        ...(foreign ? [{ key: 'privateSellerForeign', level: 'warning' as const }] : []),
        { key: 'privateSellerTip', level: 'info' },
      ]
    case 'holidayRental':
      return [
        ...(foreign ? [{ key: 'holidayRentalForeign', level: 'warning' as const }] : []),
        { key: 'holidayRentalTip', level: 'info' },
      ]
    case 'onlineShop':
      return [
        ...(foreign ? [{ key: 'onlineShopForeign', level: 'info' as const }] : []),
        { key: 'onlineShopTip', level: 'warning' },
      ]
    case 'investment':
      return [
        { key: 'investmentStrong', level: 'strong' },
        { key: 'investmentCheck', level: 'warning' },
      ]
    case 'bill':
      return [
        { key: 'billCheck', level: 'warning' },
        { key: 'billChanged', level: 'info' },
      ]
    case 'familyFriend':
      return [
        { key: 'familyCall', level: 'warning' },
        { key: 'familyPassword', level: 'info' },
      ]
    case 'other':
      return [{ key: 'otherTip', level: 'info' }]
  }
}
