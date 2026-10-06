// Avvisi di sicurezza nei messaggi della chat: funzioni pure, nessuna rete.
// Cerca nel testo un IBAN, un'email e un link (al massimo uno per tipo) per
// proporre il controllo con lo strumento giusto.
//
// Esempi (verificati a mano):
//   "IBAN IT60 X054 2811 1010 0000 0123 456 grazie" -> iban IT60X0542811101000000123456, valido
//   "paga su IT60X0542811101000000123457"         -> iban non valido (checksum)
//   "scrivimi a mario.rossi@example.com"          -> email, nessun link
//   "guarda www.esempio.it/offerta."              -> url www.esempio.it/offerta
//   "ci vediamo alle 10.30"                       -> niente

import { IBAN_LENGTHS, normalizeIban, validateIban } from '@/lib/iban'

export interface MessageSafety {
  iban?: { normalized: string; valid: boolean; country: string | null }
  email?: string
  url?: string
}

// 2 lettere + 2 cifre + 11..30 caratteri, con spazi singoli ammessi
const IBAN_RE = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/gi
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,24}/i
// Link con http(s):// o www., oppure dominio "nudo" con estensioni comuni
const URL_RE =
  /\bhttps?:\/\/[^\s<>"]+|\bwww\.[^\s<>"]+|\b(?:[a-z0-9-]+\.)+(?:com|it|net|org|eu|io|info|biz|co|me|app|shop|store|online|site|xyz|de|fr|es|pt|ru|uk|ch|at|be|nl)\b(?:\/[^\s<>"]*)?/i

function findIban(text: string): MessageSafety['iban'] {
  for (const match of text.matchAll(IBAN_RE)) {
    let normalized = normalizeIban(match[0])
    // Pochi numeri = probabilmente parole normali, non un IBAN
    if ((normalized.slice(4).match(/\d/g) ?? []).length < 6) continue
    // Se dopo l'IBAN c'è una parola attaccata, si taglia alla lunghezza del paese
    const expected = IBAN_LENGTHS[normalized.slice(0, 2)]
    if (expected && normalized.length > expected) normalized = normalized.slice(0, expected)
    const result = validateIban(normalized)
    return { normalized, valid: result.valid, country: result.country }
  }
  return undefined
}

export function detectMessageSafety(text: string): MessageSafety {
  const out: MessageSafety = {}
  if (!text) return out

  const iban = findIban(text)
  if (iban) out.iban = iban

  const email = EMAIL_RE.exec(text)
  if (email) out.email = email[0].slice(0, 200)

  // Il dominio delle email non conta come link
  const withoutEmails = text.replace(new RegExp(EMAIL_RE.source, 'gi'), ' ')
  const url = URL_RE.exec(withoutEmails)
  if (url) {
    // Via la punteggiatura finale della frase
    const clean = url[0].replace(/[.,;:!?)\]}'»]+$/, '').slice(0, 200)
    if (clean) out.url = clean
  }

  return out
}
