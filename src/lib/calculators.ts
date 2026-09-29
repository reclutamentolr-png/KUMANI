// Calcolatrici PRO: funzioni pure, senza dipendenze dal browser.
// Gli importi entrano ed escono in euro (number), ma i calcoli avvengono in
// centesimi interi con arrotondamento "half-up" (0,5 arrotonda per eccesso,
// in valore assoluto), così 1,005 diventa 1,01 e non 1,00.

/** Arrotonda half-up (lontano da zero) a `decimals` cifre, senza errori binari. */
export function roundHalfUp(value: number, decimals = 2): number {
  if (!Number.isFinite(value)) return value
  const sign = value < 0 ? -1 : 1
  const abs = Math.abs(value)
  if (abs >= 1e15) return sign * Math.round(abs)
  // toPrecision(15) toglie il "rumore" binario (es. 1.00499999999 -> 1.005)
  const normalized = Number(abs.toPrecision(15))
  const [mantissa, exponent = '0'] = normalized.toExponential().split('e')
  const shifted = Math.round(Number(`${mantissa}e${Number(exponent) + decimals}`))
  const [m2, e2 = '0'] = shifted.toExponential().split('e')
  return sign * Number(`${m2}e${Number(e2) - decimals}`)
}

/** Euro -> centesimi interi. */
export const toCents = (euros: number): number => Math.round(roundHalfUp(euros, 2) * 100)
/** Centesimi -> euro. */
export const fromCents = (cents: number): number => cents / 100
/** Percentuale di un importo in centesimi, arrotondata al centesimo. */
const percentOf = (cents: number, rate: number): number => roundHalfUp((cents * rate) / 100, 0)

/**
 * Legge un numero scritto a mano: accetta virgola o punto come separatore
 * decimale ("12,5", "12.5") e ignora spazi e separatori delle migliaia
 * ("1.234,56", "1,234.56", "1 234,56"). Restituisce null se non valido.
 */
export function parseDecimal(input: string): number | null {
  let s = input.trim().replace(/[\s  '€%]/g, '')
  if (!s) return null
  let negative = false
  if (s.startsWith('-')) {
    negative = true
    s = s.slice(1)
  }
  if (!/^[\d.,]+$/.test(s)) return null
  const lastComma = s.lastIndexOf(',')
  const lastDot = s.lastIndexOf('.')
  let normalized: string
  if (lastComma >= 0 && lastDot >= 0) {
    // Entrambi presenti: l'ultimo è il separatore decimale
    const decimalSep = lastComma > lastDot ? ',' : '.'
    const thousandSep = decimalSep === ',' ? '.' : ','
    normalized = s.split(thousandSep).join('').replace(decimalSep, '.')
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.'
    const parts = s.split(sep)
    if (parts.length > 2) {
      // "1.234.567": separatori delle migliaia
      if (parts.slice(1).some((p) => p.length !== 3)) return null
      normalized = parts.join('')
    } else {
      normalized = parts.join('.')
    }
  } else {
    normalized = s
  }
  if (normalized === '.' || normalized.split('.').length > 2) return null
  const value = Number(normalized)
  if (!Number.isFinite(value)) return null
  return negative ? -value : value
}

// ---------------------------------------------------------------- IVA

export type VatMode = 'add' | 'extract'

export interface VatResult {
  net: number
  vat: number
  gross: number
  rate: number
}

/** Netto -> lordo: aggiunge l'IVA. */
export function addVat(net: number, rate: number): VatResult {
  const netC = toCents(net)
  const vatC = percentOf(netC, rate)
  return { net: fromCents(netC), vat: fromCents(vatC), gross: fromCents(netC + vatC), rate }
}

/** Lordo -> netto: scorpora l'IVA (l'IVA è la differenza, così i conti tornano). */
export function extractVat(gross: number, rate: number): VatResult {
  const grossC = toCents(gross)
  const netC = roundHalfUp((grossC * 100) / (100 + rate), 0)
  return { net: fromCents(netC), vat: fromCents(grossC - netC), gross: fromCents(grossC), rate }
}

export function computeVat(mode: VatMode, amount: number, rate: number): VatResult {
  return mode === 'add' ? addVat(amount, rate) : extractVat(amount, rate)
}

// ------------------------------------------------- Ritenuta d'acconto

export interface WithholdingOptions {
  /** Aliquota della ritenuta in % (di norma 20). */
  withholdingRate: number
  /** Rivalsa INPS gestione separata in % (di norma 4, 0 = assente). Entra nella base della ritenuta. */
  inpsRate: number
  /** Contributo integrativo cassa in % sul compenso (es. 4, 0 = assente). NON soggetto a ritenuta. */
  cassaRate: number
  /** IVA in % su compenso + rivalsa + cassa (22, oppure 0 per il forfettario). */
  vatRate: number
}

export interface WithholdingResult {
  compenso: number
  rivalsaInps: number
  cassa: number
  vatBase: number
  vat: number
  total: number
  withholdingBase: number
  withholding: number
  netToPay: number
}

function withholdingFromCents(compensoC: number, o: WithholdingOptions): WithholdingResult {
  const rivalsaC = percentOf(compensoC, o.inpsRate)
  const cassaC = percentOf(compensoC, o.cassaRate)
  const vatBaseC = compensoC + rivalsaC + cassaC
  const vatC = percentOf(vatBaseC, o.vatRate)
  const totalC = vatBaseC + vatC
  const baseC = compensoC + rivalsaC
  const withholdingC = percentOf(baseC, o.withholdingRate)
  return {
    compenso: fromCents(compensoC),
    rivalsaInps: fromCents(rivalsaC),
    cassa: fromCents(cassaC),
    vatBase: fromCents(vatBaseC),
    vat: fromCents(vatC),
    total: fromCents(totalC),
    withholdingBase: fromCents(baseC),
    withholding: fromCents(withholdingC),
    netToPay: fromCents(totalC - withholdingC),
  }
}

/** Dal compenso (imponibile) alla fattura, secondo la prassi italiana. */
export function computeWithholding(compenso: number, options: WithholdingOptions): WithholdingResult {
  return withholdingFromCents(toCents(compenso), options)
}

/**
 * Inverso: "voglio incassare X netti, quanto fatturo?". Stima il compenso
 * con la formula chiusa e poi cerca, tra i centesimi vicini, quello che dà
 * esattamente (o il più vicino possibile) il netto richiesto.
 */
export function computeWithholdingFromNet(targetNet: number, options: WithholdingOptions): WithholdingResult | null {
  const targetC = toCents(targetNet)
  const i = options.inpsRate / 100
  const c = options.cassaRate / 100
  const v = options.vatRate / 100
  const r = options.withholdingRate / 100
  const factor = (1 + i + c) * (1 + v) - (1 + i) * r
  if (!(factor > 0)) return null
  const estimate = Math.round(targetC / factor)
  let best: WithholdingResult | null = null
  let bestDiff = Infinity
  for (let delta = -5; delta <= 5; delta++) {
    const candidate = estimate + delta
    if (candidate < 0) continue
    const result = withholdingFromCents(candidate, options)
    const diff = Math.abs(toCents(result.netToPay) - targetC)
    if (diff < bestDiff) {
      best = result
      bestDiff = diff
    }
  }
  return best
}

// --------------------------------------------------------------- Sconto

export interface DiscountResult {
  price: number
  finalPrice: number
  saving: number
  /** Sconto complessivo in % (per la cascata: lo sconto unico equivalente). */
  percent: number
}

/** Sconto percentuale singolo. */
export function discountByPercent(price: number, percent: number): DiscountResult {
  return cascadeDiscount(price, [percent])
}

/** Sconto in importo fisso. */
export function discountByAmount(price: number, amount: number): DiscountResult {
  const priceC = toCents(price)
  const savingC = Math.min(toCents(amount), priceC)
  return {
    price: fromCents(priceC),
    finalPrice: fromCents(priceC - savingC),
    saving: fromCents(savingC),
    percent: priceC > 0 ? roundHalfUp((savingC / priceC) * 100, 2) : 0,
  }
}

/** Sconti in cascata (es. 20% + 10% = 28% unico equivalente). */
export function cascadeDiscount(price: number, percents: number[]): DiscountResult {
  const priceC = toCents(price)
  const remaining = percents.reduce((acc, p) => acc * (1 - p / 100), 1)
  const finalC = roundHalfUp(priceC * remaining, 0)
  return {
    price: fromCents(priceC),
    finalPrice: fromCents(finalC),
    saving: fromCents(priceC - finalC),
    percent: roundHalfUp((1 - remaining) * 100, 2),
  }
}

// ---------------------------------------------------- Ricarico e margine

export interface MarginResult {
  cost: number
  price: number
  profit: number
  /** Ricarico % = utile / costo. null se il costo è 0. */
  markup: number | null
  /** Margine % = utile / prezzo. null se il prezzo è 0. */
  margin: number | null
}

/** Da costo e prezzo: ricarico e margine. */
export function marginFromCostAndPrice(cost: number, price: number): MarginResult {
  const costC = toCents(cost)
  const priceC = toCents(price)
  const profitC = priceC - costC
  return {
    cost: fromCents(costC),
    price: fromCents(priceC),
    profit: fromCents(profitC),
    markup: costC !== 0 ? roundHalfUp((profitC / costC) * 100, 2) : null,
    margin: priceC !== 0 ? roundHalfUp((profitC / priceC) * 100, 2) : null,
  }
}

/** Prezzo da margine desiderato: prezzo = costo / (1 - margine). null se margine >= 100%. */
export function priceFromMargin(cost: number, marginPercent: number): MarginResult | null {
  if (marginPercent >= 100) return null
  const priceC = roundHalfUp(toCents(cost) / (1 - marginPercent / 100), 0)
  return marginFromCostAndPrice(cost, fromCents(priceC))
}

/** Prezzo da ricarico desiderato: prezzo = costo × (1 + ricarico). */
export function priceFromMarkup(cost: number, markupPercent: number): MarginResult {
  const priceC = roundHalfUp(toCents(cost) * (1 + markupPercent / 100), 0)
  return marginFromCostAndPrice(cost, fromCents(priceC))
}
