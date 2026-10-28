// Bollette italiane lette con l'OCR: chi la emette, l'importo da pagare e la
// scadenza. Si cercano le formule tipiche («Totale da pagare», «Scadenza»,
// «da pagare entro il»…); se una voce non si trova resta vuota e si scrive a
// mano. Il testo non lascia il telefono.

export type BillGuess = { provider: string | null; amount: string | null; dueDate: string | null }

// Chi emette la bolletta (nome mostrato → parole da cercare)
const PROVIDERS: [string, RegExp][] = [
  ['Enel Energia', /\benel\b/i],
  ['Eni Plenitude', /\b(plenitude|eni gas e luce|eni\b)/i],
  ['A2A', /\ba2a\b/i],
  ['Hera', /\bhera\b/i],
  ['Iren', /\biren\b/i],
  ['Acea', /\bacea\b/i],
  ['Edison', /\bedison\b/i],
  ['Sorgenia', /\bsorgenia\b/i],
  ['Engie', /\bengie\b/i],
  ['Illumia', /\billumia\b/i],
  ['Octopus Energy', /\boctopus\b/i],
  ['E.ON', /\be\.?on\b/i],
  ['Servizio Elettrico Nazionale', /servizio elettrico nazionale/i],
  ['TIM', /\b(tim|telecom italia)\b/i],
  ['Vodafone', /\bvodafone\b/i],
  ['WindTre', /\bwind\s?tre\b/i],
  ['Iliad', /\biliad\b/i],
  ['Fastweb', /\bfastweb\b/i],
  ['Sky', /\bsky\b/i],
  ['Tari', /\btari\b/i],
  ['Acqua', /\b(servizio idrico|acquedotto)\b/i],
]

const AMOUNT = /(\d{1,3}(?:[.\s]\d{3})*|\d+)[,.](\d{2})\b/
const DATE = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/
const MONTHS: Record<string, number> = { gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12 }
const DATE_WORDS = /\b(\d{1,2})\s+(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic)[a-z]*\.?\s+(\d{4})\b/i

// Correzioni tipiche dell'OCR dentro i numeri
const fixDigits = (s: string) => s.replace(/(?<=\d)[oO](?![a-zA-Z])/g, '0').replace(/(?<=\d)[lI](?=\d)/g, '1')

function toIso(d: number, m: number, y: number): string | null {
  const year = y < 100 ? 2000 + y : y
  if (m < 1 || m > 12 || d < 1 || d > 31 || year < 2000 || year > 2100) return null
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function dateIn(text: string): string | null {
  const n = text.match(DATE)
  if (n) return toIso(Number(n[1]), Number(n[2]), Number(n[3]))
  const w = text.match(DATE_WORDS)
  if (w) return toIso(Number(w[1]), MONTHS[w[2].toLowerCase()], Number(w[3]))
  return null
}

// «1.234,56» o «45,20» → «1234,56» / «45,20» (come si scrive nel modulo)
const amountIn = (text: string): string | null => {
  // Le date (05.01.27, 15/11/2026) non sono importi
  const m = text.replace(new RegExp(DATE.source, 'g'), ' ').match(AMOUNT)
  if (!m) return null
  const value = `${m[1].replace(/[.\s]/g, '')},${m[2]}`
  return Number(value.replace(',', '.')) > 0 ? value : null
}

// Parole che precedono l'importo e la scadenza, dalla più sicura
const AMOUNT_LABELS = [/totale\s+da\s+pagare/i, /importo\s+da\s+pagare/i, /da\s+pagare/i, /importo\s+totale/i, /totale\s+(?:bolletta|fattura|documento)/i, /\btotale\b/i, /\bimporto\b/i]
const DUE_LABELS = [/scadenza(?:\s+(?:pagamento|fattura|bolletta))?/i, /pagare\s+entro(?:\s+il)?/i, /entro\s+il/i, /data\s+(?:di\s+)?scadenza/i]

export function parseBill(raw: string): BillGuess {
  const text = fixDigits(raw).replace(/€/g, ' € ')
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
  const provider = PROVIDERS.find(([, re]) => re.test(text))?.[0] ?? null

  // Importo: sulla riga dell'etichetta o su quella subito dopo
  let amount: string | null = null
  for (const label of AMOUNT_LABELS) {
    const i = lines.findIndex((l) => label.test(l))
    if (i < 0) continue
    const after = lines[i].split(label)[1] ?? ''
    amount = amountIn(after) ?? amountIn(lines[i + 1] ?? '')
    if (amount) break
  }
  // Altrimenti il primo importo con il simbolo dell'euro
  amount ??= amountIn(text.match(/€\s*\d[\d.,\s]*/)?.[0] ?? '') ?? amountIn(text.match(/\d[\d.,]*\s*€/)?.[0] ?? '')

  let dueDate: string | null = null
  for (const label of DUE_LABELS) {
    const i = lines.findIndex((l) => label.test(l))
    if (i < 0) continue
    dueDate = dateIn(lines[i].split(label)[1] ?? '') ?? dateIn(lines[i + 1] ?? '')
    if (dueDate) break
  }
  return { provider, amount, dueDate }
}
