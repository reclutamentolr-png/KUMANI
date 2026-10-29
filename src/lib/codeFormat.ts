// Trattini dimenticati (GIFTAB12CD34, KVA ABCD…): rimessi al loro posto
// quando la forma del codice è inconfondibile.
const SHAPES: [RegExp, (m: string[]) => string][] = [
  [/^(GIFT|PASS|PR)-?([A-Z0-9]{4})-?([A-Z0-9]{4})$/, (m) => `${m[1]}-${m[2]}-${m[3]}`],
  [/^KVA-?([A-Z0-9]{14})$/, (m) => `KVA-${m[1]}`],
  [/^KV-?([A-Z0-9]{10})$/, (m) => `KV-${m[1]}`],
]

// Pulizia di un codice inserito a mano o incollato (WhatsApp, PDF, email):
// maiuscolo, senza spazi (anche quelli invisibili) e con i trattini lunghi
// (– —) trasformati in «-». Vale per voucher, Pass, regali e codici prova.
export const normalizeCode = (raw: string) => {
  const code = raw
    .normalize('NFKC')
    .replace(/[\s​-‍⁠﻿]+/g, '')
    .replace(/[‐-―−﹘﹣－]/g, '-')
    .toUpperCase()
  for (const [re, fix] of SHAPES) {
    const m = code.match(re)
    if (m) return fix(m)
  }
  return code
}

// Codice di prova di un servizio (/prova/CODICE): si apre dal link, non da
// «Hai un codice?»
export const TRIAL_CODE_RE = /^PR-[A-Z0-9]{4}-[A-Z0-9]{4}$/
