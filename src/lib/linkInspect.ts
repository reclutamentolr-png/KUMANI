import { BRANDS, isOfficial, registrableDomain } from '@/lib/checkmail/engine'
import { safeFetch } from '@/lib/safeFetch'

// Ispezione di un link come lo aprirebbe una persona: si seguono i rinvii
// (anche quelli scritti nella pagina) fino al sito d'arrivo e si guarda se la
// pagina è una finta pagina di accesso. Usata da SVAT, CheckMail, scanner QR
// e controllo degli annunci.
//
// Caso da cui nasce (ottobre 2026): un'email con giuseppebello.com/… (dominio
// vecchio e pulito, violato) che rinviava via flowto.it/flowcode.com a
// cliente-aggiornamentisicurezza-id.beibehaltungsgenehmigung.info, finta
// pagina di accesso Fineco. Guardando solo il primo dominio sembrava sicuro.

type Brand = (typeof BRANDS)[number]

export interface LinkInspection {
  startUrl: string
  startDomain: string
  finalUrl: string
  finalDomain: string
  // Il sito d'arrivo è un altro (dominio registrabile diverso da quello di partenza)
  redirected: boolean
  status: number
  html: string
  // Marchio imitato da una finta pagina di accesso o di pagamento
  phishingBrand: Brand | null
}

export const hostOf = (value: string) => {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return ''
  }
}

// Siti diversi ma dello stesso proprietario (fineco.it → finecobank.com): non
// è un «altro sito»
export function sameOwner(a: string, b: string) {
  return registrableDomain(a) === registrableDomain(b) || BRANDS.some((brand) => isOfficial(a, brand) && isOfficial(b, brand))
}

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

// Rinvii scritti nella pagina: <meta http-equiv="refresh"> e le righe di
// JavaScript che cambiano indirizzo, solo su pagine quasi vuote (le pagine
// vere hanno testo; quelle di passaggio no)
const META_REFRESH_RE = /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["']?\s*\d*\s*;?\s*url\s*=\s*['"]?([^"'>\s]+)/i
const JS_REDIRECT_RE = /(?:window\.|document\.|top\.|self\.)?location(?:\.href)?\s*=\s*["'`]([^"'`]+)["'`]|location\.(?:replace|assign)\(\s*["'`]([^"'`]+)["'`]/i

function pageText(html: string) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function inPageRedirect(html: string, base: string): string | null {
  if (pageText(html).length > 400) return null
  const m = html.match(META_REFRESH_RE) ?? html.match(JS_REDIRECT_RE)
  const target = m?.[1] ?? m?.[2]
  if (!target) return null
  try {
    const next = new URL(target, base)
    return next.protocol === 'http:' || next.protocol === 'https:' ? next.toString() : null
  } catch {
    return null
  }
}

/**
 * Apre il link dal server (mai indirizzi interni: vedi safeFetch) e restituisce
 * il sito d'arrivo e la pagina. null se il link non si apre.
 */
export async function inspectLink(raw: string, timeoutMs = 10_000): Promise<LinkInspection | null> {
  const startUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  const startDomain = hostOf(startUrl)
  if (!startDomain) return null
  const deadline = AbortSignal.timeout(timeoutMs)
  let current = startUrl
  let html = ''
  let status = 0
  try {
    for (let hop = 0; hop < 3; hop++) {
      const res = await safeFetch(current, {
        headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5' },
        cache: 'no-store',
        signal: deadline,
      })
      current = res.url || current
      status = res.status
      html = (await res.text()).slice(0, 2_000_000)
      const next = res.ok ? inPageRedirect(html, current) : null
      if (!next || next === current) break
      current = next
    }
  } catch {
    if (!html) return null
  }
  const finalDomain = hostOf(current) || startDomain
  return {
    startUrl,
    startDomain,
    finalUrl: current,
    finalDomain,
    redirected: !sameOwner(startDomain, finalDomain),
    status,
    html,
    phishingBrand: status >= 200 && status < 300 ? phishingBrand(html, finalDomain) : null,
  }
}

// Finta pagina di accesso o di pagamento: chiede la password (o i dati della
// carta) e si presenta come una banca o un servizio noto (titolo,
// intestazione, logo, logo preso dal sito vero) ma il dominio non è suo.
// Conta solo «chi dice di essere» la pagina, non il testo: un negozio che
// scrive «paghi con PayPal» non è un'imitazione di PayPal.
const PASSWORD_RE = /<input\b[^>]*\btype\s*=\s*["']?password\b/i
export const asksPassword = (html: string) => PASSWORD_RE.test(html)
const CARD_RE = /<input\b[^>]*\b(?:autocomplete=["']cc-(?:number|csc|exp)|(?:name|id|placeholder)=["'][^"']*(?:cvv|cvc|card.?number|numero.?(?:della.?)?carta|codice.?di.?sicurezza|scadenza.?carta))/i
// Marchi che compaiono anche sui siti onesti come pulsanti «Accedi con…» o
// bollini «Scarica su App Store»: per loro conta solo titolo e intestazione
const LOGIN_PROVIDERS = new Set(['Google', 'Facebook / Meta', 'Apple', 'Microsoft'])
// Marchi di pagamento: le pagine di cassa dei negozi veri li nominano accanto
// ai campi della carta, quindi per loro serve la richiesta della password
const PAYMENT_BRANDS = new Set(['PayPal', 'Nexi', 'Satispay', 'Amazon', 'Apple', 'Google'])

export function phishingBrand(html: string, domain: string): Brand | null {
  const password = PASSWORD_RE.test(html)
  const card = CARD_RE.test(html)
  if (!password && !card) return null
  const heading = [
    html.match(/<title[^>]*>([^<]*)/i)?.[1],
    html.match(/<meta[^>]+property=["']og:(?:site_name|title)["'][^>]+content=["']([^"']*)/i)?.[1],
    ...[...html.matchAll(/<h1\b[^>]*>([\s\S]{0,300}?)<\/h1>/gi)].map((m) => m[1].replace(/<[^>]+>/g, ' ')),
  ].filter(Boolean).join(' \n ')
  // Solo le immagini del logo (non icone social, bollini o collegamenti tecnici)
  const logos = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]).filter((tag) => /logo/i.test(tag))
  const logoAlts = logos.map((tag) => tag.match(/\balt=["']([^"']{1,80})["']/i)?.[1] ?? '').join(' \n ')
  const logoHosts = logos.map((tag) => hostOf(tag.match(/\bsrc=["'](https?:\/\/[^"']+)["']/i)?.[1] ?? ''))
  const named = (text: string, brand: Brand) => {
    const lower = text.toLowerCase().replace(/[’'`]/g, ' ')
    // I nomi dei marchi sono solo lettere, cifre e spazi: niente da proteggere nell'espressione
    return brand.words.some((w) => new RegExp(`(^|[^a-z0-9])${w}([^a-z0-9]|$)`).test(lower)) ||
      (brand.acronyms ?? []).some((a) => new RegExp(`\\b${a}\\b`).test(text))
  }
  for (const brand of BRANDS) {
    if (isOfficial(domain, brand)) continue
    if (!password && PAYMENT_BRANDS.has(brand.name)) continue
    if (named(heading, brand)) return brand
    if (LOGIN_PROVIDERS.has(brand.name)) continue
    // Logo che nomina il marchio o caricato direttamente dal suo sito
    if (named(logoAlts, brand) || logoHosts.some((h) => h && brand.domains.some((d) => h === d || h.endsWith(`.${d}`)))) return brand
  }
  return null
}
