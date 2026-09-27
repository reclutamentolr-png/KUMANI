// Partite IVA: formato per paese, cifra di controllo italiana e verifica
// online sul VIES (servizio gratuito della Commissione Europea, solo UE).
// Fuori dall'UE si controlla solo il formato: il numero resta "da verificare".

// Paese → prefisso IVA (la Grecia usa EL) e formato del numero senza prefisso.
const EU_FORMATS: Record<string, { prefix: string; pattern: RegExp }> = {
  AT: { prefix: 'AT', pattern: /^U\d{8}$/ },
  BE: { prefix: 'BE', pattern: /^[01]\d{9}$/ },
  BG: { prefix: 'BG', pattern: /^\d{9,10}$/ },
  CY: { prefix: 'CY', pattern: /^\d{8}[A-Z]$/ },
  CZ: { prefix: 'CZ', pattern: /^\d{8,10}$/ },
  DE: { prefix: 'DE', pattern: /^\d{9}$/ },
  DK: { prefix: 'DK', pattern: /^\d{8}$/ },
  EE: { prefix: 'EE', pattern: /^\d{9}$/ },
  GR: { prefix: 'EL', pattern: /^\d{9}$/ },
  ES: { prefix: 'ES', pattern: /^[A-Z0-9]\d{7}[A-Z0-9]$/ },
  FI: { prefix: 'FI', pattern: /^\d{8}$/ },
  FR: { prefix: 'FR', pattern: /^[A-HJ-NP-Z0-9]{2}\d{9}$/ },
  HR: { prefix: 'HR', pattern: /^\d{11}$/ },
  HU: { prefix: 'HU', pattern: /^\d{8}$/ },
  IE: { prefix: 'IE', pattern: /^(\d{7}[A-W][A-I]?|\d[A-Z+*]\d{5}[A-W])$/ },
  IT: { prefix: 'IT', pattern: /^\d{11}$/ },
  LT: { prefix: 'LT', pattern: /^(\d{9}|\d{12})$/ },
  LU: { prefix: 'LU', pattern: /^\d{8}$/ },
  LV: { prefix: 'LV', pattern: /^\d{11}$/ },
  MT: { prefix: 'MT', pattern: /^\d{8}$/ },
  NL: { prefix: 'NL', pattern: /^\d{9}B\d{2}$/ },
  PL: { prefix: 'PL', pattern: /^\d{10}$/ },
  PT: { prefix: 'PT', pattern: /^\d{9}$/ },
  RO: { prefix: 'RO', pattern: /^\d{2,10}$/ },
  SE: { prefix: 'SE', pattern: /^\d{12}$/ },
  SI: { prefix: 'SI', pattern: /^\d{8}$/ },
  SK: { prefix: 'SK', pattern: /^\d{10}$/ },
}

// Fuori UE: formati noti, altrimenti un codice alfanumerico ragionevole.
const OTHER_FORMATS: Record<string, RegExp> = {
  CH: /^CHE\d{9}$/, // numero IDI svizzero (CHE-123.456.789)
  LI: /^CHE\d{9}$|^\d{5}$/,
  GB: /^(\d{9}|\d{12}|GD\d{3}|HA\d{3})$/,
  NO: /^\d{9}(MVA)?$/,
}

export const VAT_COUNTRIES_EU = Object.keys(EU_FORMATS)
// Paesi extra-UE con un formato noto (verifica online non disponibile)
export const VAT_COUNTRIES_OTHER = Object.keys(OTHER_FORMATS)

// Esempi da mostrare nel modulo, per paese (senza paese noto: nessun esempio)
const VAT_EXAMPLES: Record<string, string> = {
  IT: '01234567890',
  DE: 'DE123456789',
  FR: 'FR12345678901',
  ES: 'ESX1234567X',
  AT: 'ATU12345678',
  BE: 'BE0123456789',
  NL: 'NL123456789B01',
  PT: 'PT123456789',
  GR: 'EL123456789',
  IE: 'IE1234567T',
  PL: 'PL1234567890',
  CH: 'CHE-123.456.789',
  LI: 'CHE-123.456.789',
  GB: 'GB123456789',
  NO: '123456789MVA',
}

export function vatExample(countryCode: string): string | null {
  const country = countryCode.toUpperCase()
  if (VAT_EXAMPLES[country]) return VAT_EXAMPLES[country]
  const eu = EU_FORMATS[country]
  return eu ? `${eu.prefix}…` : null
}

// Forma leggibile del numero salvato: toglie il marcatore "CH:" dei paesi extra-UE.
export function prettyVat(normalized: string | null | undefined): string {
  if (!normalized) return ''
  const m = /^[A-Z]{2}:(.+)$/.exec(normalized)
  return m ? m[1] : normalized
}

// Ricerca manuale (staff) della partita IVA italiana su Ufficio Camerale.
// Il sito non ha un'API pubblica e blocca le richieste automatiche; le schede
// hanno un id interno (/5791/nome-srl), quindi si passa da una ricerca Google
// limitata al sito, che porta direttamente alla scheda dell'azienda.
export function registryLookupUrl(normalized: string | null | undefined): string | null {
  const m = /^IT(\d{11})$/.exec(normalized ?? '')
  if (!m) return null
  return `https://www.google.com/search?q=${encodeURIComponent(`site:ufficiocamerale.it ${m[1]}`)}`
}

export type VatCheck =
  | { ok: true; country: string; normalized: string; eu: boolean }
  | { ok: false; reason: 'format' | 'checksum' | 'country' }

// Cifra di controllo della partita IVA italiana (algoritmo ufficiale).
export function italianVatChecksumOk(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    let n = Number(digits[i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return (10 - (sum % 10)) % 10 === Number(digits[10])
}

// Pulisce e controlla il numero; restituisce la forma salvata "IT12345678901".
export function checkVat(countryCode: string, rawVat: string): VatCheck {
  const country = countryCode.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, reason: 'country' }
  let value = rawVat.toUpperCase().replace(/[\s.\-/]/g, '')
  const eu = EU_FORMATS[country]
  if (eu) {
    if (value.startsWith(eu.prefix)) value = value.slice(eu.prefix.length)
    if (!eu.pattern.test(value)) return { ok: false, reason: 'format' }
    if (country === 'IT' && !italianVatChecksumOk(value)) return { ok: false, reason: 'checksum' }
    return { ok: true, country, normalized: `${eu.prefix}${value}`, eu: true }
  }
  if (value.startsWith(country) && country !== 'CH') value = value.slice(country.length)
  const other = OTHER_FORMATS[country]
  if (other ? !other.test(value) : !/^[A-Z0-9]{4,20}$/.test(value)) return { ok: false, reason: 'format' }
  return { ok: true, country, normalized: `${country}:${value}`, eu: false }
}

// Riconosce una partita IVA scritta "libera" (es. in SVAT): 11 cifre = Italia,
// altrimenti prefisso UE + numero. Restituisce null se non sembra una partita IVA.
export function parseVatInput(raw: string): VatCheck | null {
  // Indirizzi web (es. de.wikipedia.org, https://…) non sono partite IVA
  if (/[:/@]|[a-z]\.[a-z]/i.test(raw.trim())) return null
  const value = raw.toUpperCase().replace(/[\s.\-/]/g, '')
  if ((value.match(/\d/g) ?? []).length < 5) return null
  if (/^\d{11}$/.test(value)) return checkVat('IT', value)
  const m = /^([A-Z]{2})[A-Z0-9+*]{2,13}$/.exec(value)
  if (!m) return null
  const country = Object.keys(EU_FORMATS).find((c) => EU_FORMATS[c].prefix === m[1])
  return country ? checkVat(country, value) : null
}

export type ViesResult = { status: 'valid' | 'invalid' | 'unavailable'; name?: string | null; address?: string | null }

// Verifica online sul VIES (REST pubblico della Commissione Europea).
// Non blocca mai il salvataggio: se il servizio non risponde → "unavailable".
export async function verifyVies(normalized: string): Promise<ViesResult> {
  const prefix = normalized.slice(0, 2)
  const number = normalized.slice(2)
  if (!Object.values(EU_FORMATS).some((f) => f.prefix === prefix)) return { status: 'unavailable' }
  try {
    const res = await fetch(`https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${prefix}/vat/${encodeURIComponent(number)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(6000),
      cache: 'no-store',
    })
    if (!res.ok) return { status: 'unavailable' }
    const data = (await res.json()) as { isValid?: boolean; valid?: boolean; name?: string; address?: string; userError?: string }
    const valid = data.isValid ?? data.valid
    const clean = (v?: string) => (v && v.trim() !== '---' ? v.replace(/\s*\n\s*/g, ', ').replace(/,\s*$/, '').trim() || null : null)
    if (valid === true) return { status: 'valid', name: clean(data.name), address: clean(data.address) }
    if (valid === false && (!data.userError || data.userError === 'INVALID')) return { status: 'invalid' }
    return { status: 'unavailable' }
  } catch {
    return { status: 'unavailable' }
  }
}
