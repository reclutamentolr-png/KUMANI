// Righe a lettura automatica (MRZ) di passaporti e carte d'identità: le 2-3
// righe in fondo con i simboli «<<<». Contengono data di nascita e di
// scadenza, ognuna con una cifra di controllo: la data si accetta solo se il
// controllo torna, così una lettura sbagliata non diventa una scadenza
// sbagliata. Formati ICAO 9303: TD1 (carte, 3 righe da 30), TD2 (2 da 36),
// TD3 (passaporti, 2 da 44).

export type MrzDoc = 'passport' | 'id_card' | 'other'
export type MrzResult = { doc: MrzDoc; expiry: string; country: string | null }

const WEIGHTS = [7, 3, 1]
const charValue = (c: string) => (c === '<' ? 0 : /[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) - 55)
const checkDigit = (s: string) => String(s.split('').reduce((sum, c, i) => sum + charValue(c) * WEIGHTS[i % 3], 0) % 10)

// Nei campi numerici l'OCR scambia spesso lettere e cifre simili
const DIGIT_FIX: Record<string, string> = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', T: '1', Z: '2', S: '5', B: '8', G: '6' }
const digits = (s: string) => s.replace(/[A-Z]/g, (c) => DIGIT_FIX[c] ?? c)

// Data AAMMGG con la sua cifra di controllo
function dateField(line: string, at: number): string | null {
  const raw = digits(line.slice(at, at + 7))
  if (!/^\d{7}$/.test(raw)) return null
  const date = raw.slice(0, 6)
  if (checkDigit(date) !== raw[6]) return null
  const mm = Number(date.slice(2, 4))
  const dd = Number(date.slice(4, 6))
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null
  return date
}

// Scadenza: anni a due cifre, sempre in questo secolo (un documento valido non scade nel '900)
const expiryIso = (yymmdd: string) => `20${yymmdd.slice(0, 2)}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`

export function parseMrz(text: string): MrzResult | null {
  const lines = text
    .toUpperCase()
    .split(/\n+/)
    .map((l) => l.replace(/\s+/g, '').replace(/[«‹]/g, '<').replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 28)
  const first = lines.find((l) => /^[PIACV][A-Z<][A-Z<]{3}/.test(l)) ?? ''
  const doc: MrzDoc = first.startsWith('P') ? 'passport' : /^[IAC]/.test(first) ? 'id_card' : 'other'
  const country = first.length >= 5 ? first.slice(2, 5).replace(/</g, '') || null : null

  for (const line of lines) {
    // TD1 (carte d'identità): nascita in 0-6, scadenza in 8-14 della seconda riga
    if (line.length <= 33) {
      const birth = dateField(line, 0)
      const expiry = dateField(line, 8)
      if (birth && expiry) return { doc: doc === 'other' ? 'id_card' : doc, expiry: expiryIso(expiry), country }
    }
    // TD2/TD3 (passaporti e simili): nascita in 13-19, scadenza in 21-27 della seconda riga
    if (line.length >= 34) {
      const birth = dateField(line, 13)
      const expiry = dateField(line, 21)
      if (birth && expiry) return { doc: doc === 'other' && line.length >= 42 ? 'passport' : doc, expiry: expiryIso(expiry), country }
    }
  }
  return null
}
