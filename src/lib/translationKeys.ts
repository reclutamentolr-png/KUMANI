import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'

// Strumenti comuni dell'Area Traduttori (browser e server): testi "piatti"
// con chiave a punti (es. "landingHome.heroTitle"), controllo dei
// segnaposto e impronta del testo italiano.

export const TRANSLATOR_LOCALES = ['en', 'fr', 'es', 'pt', 'de', 'ru'] as const
export type TranslatorLocale = (typeof TRANSLATOR_LOCALES)[number]

export const LOCALE_LABELS: Record<TranslatorLocale, string> = {
  en: 'Inglese',
  fr: 'Francese',
  es: 'Spagnolo',
  pt: 'Portoghese',
  de: 'Tedesco',
  ru: 'Russo',
}

export function isTranslatorLocale(value: string): value is TranslatorLocale {
  return (TRANSLATOR_LOCALES as readonly string[]).includes(value)
}

type MessageTree = { [key: string]: string | MessageTree }

// { a: { b: "x" } } → { "a.b": "x" } (solo i testi)
export function flattenMessages(tree: MessageTree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'string') out[path] = value
    else if (value && typeof value === 'object') Object.assign(out, flattenMessages(value, path))
  }
  return out
}

// Impronta breve del testo italiano (non serve sicurezza, solo riconoscere
// quando cambia): FNV-1a a 32 bit in esadecimale
export function hashText(text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// Nomi dei segnaposto ({name}, {count}, <b>…</b>) presenti in un testo
function collectArguments(elements: MessageFormatElement[], out: Set<string>) {
  for (const el of elements) {
    if (el.type === TYPE.argument || el.type === TYPE.number || el.type === TYPE.date || el.type === TYPE.time) {
      out.add(`{${el.value}}`)
    } else if (el.type === TYPE.select || el.type === TYPE.plural) {
      out.add(`{${el.value}}`)
      for (const option of Object.values(el.options)) collectArguments(option.value, out)
    } else if (el.type === TYPE.tag) {
      out.add(`<${el.value}>`)
      collectArguments(el.children, out)
    }
  }
}

export function placeholdersOf(text: string): string[] | null {
  try {
    const out = new Set<string>()
    collectArguments(parse(text, { ignoreTag: false }), out)
    return [...out].sort()
  } catch {
    return null
  }
}

export type TranslationCheck =
  | { ok: true }
  | { ok: false; reason: 'empty' | 'tooLong' | 'syntax' | 'placeholders'; missing?: string[]; extra?: string[] }

// Una traduzione è valida se si legge senza errori e ha esattamente gli
// stessi segnaposto dell'italiano (le forme del plurale possono cambiare
// da lingua a lingua, i nomi no): altrimenti la pagina si romperebbe.
export function checkTranslation(italian: string, value: string): TranslationCheck {
  if (!value.trim()) return { ok: false, reason: 'empty' }
  if (value.length > 5000) return { ok: false, reason: 'tooLong' }
  const mine = placeholdersOf(value)
  if (!mine) return { ok: false, reason: 'syntax' }
  const expected = placeholdersOf(italian) ?? []
  const missing = expected.filter((p) => !mine.includes(p))
  const extra = mine.filter((p) => !expected.includes(p))
  if (missing.length || extra.length) return { ok: false, reason: 'placeholders', missing, extra }
  return { ok: true }
}

// Nomi comprensibili delle sezioni del sito (gli altri si mostrano così come sono)
export const SECTION_LABELS: Record<string, string> = {
  common: 'Testi comuni (pulsanti, errori…)',
  landingHome: 'Homepage',
  authRegister: 'Registrazione',
  auth: 'Accesso',
  dashboard: 'Dashboard',
  marketplace: 'Ecosistema: nomi e descrizioni dei servizi',
  aboutPage: 'Chi siamo',
  contactPage: 'Contatti',
  errorPages: 'Pagine di errore',
  billingPage: 'Abbonamento e pagamenti',
  plans: 'Piani Base e Pro',
  proArea: 'Area Professionisti',
  wallet: 'Wallet',
  rewards: 'Premi',
  kuRewards: 'KU Karma',
  voucherCard: 'Voucher',
  toolPass: 'Pass dei singoli servizi',
  toolTiers: 'Dashboard: servizi in fasce Gratis / Base / Pro',
  share: 'Pulsante Condividi… (menu del telefono)',
  referralLanding: 'Pagina di invito',
  toolShare: 'Condivisione dei servizi',
  adminMessage: 'Messaggi dello Staff',
  profileLock: 'Profilo e modifiche dei dati',
  accountDeletion: 'Cancellazione account',
  verification: 'Verifica identità',
  agenda: 'Agenda (prossimi giorni)',
  chat: 'Messaggi della Bacheca',
  qrGenerator: 'QR Code',
  qrCodePro: 'QR Code PRO',
  whatsappPage: 'Messaggi WhatsApp',
  memolife: 'MemoLife',
  neurobalance: 'NeuroBalance',
  mandala: 'Mandala',
  spotlight: 'Kumano del Giorno',
  spotlightHome: 'Kumano del Giorno (homepage)',
  aureya: 'Aureya',
  magazzino: 'Magazzino PRO',
  timebank: 'Banca del Tempo',
  verifoto: 'VeriFoto',
  svat: 'SVAT',
  offermaker: 'OfferMaker',
  lifeCalendar: 'Life Calendar',
  findo: 'Findo',
  digitalReceipt: 'Ricevute digitali',
  spendly: 'Spendly',
  preventivi: 'Preventivi',
  kumaniCv: 'KUMANI CV',
  fidelity: 'Kumi Card (fidelity)',
  affinity: 'Affinity',
  menuBuilder: 'KUMANI Menu (gestione)',
  menuPublic: 'KUMANI Menu (pagina pubblica)',
  veritas: 'Veritas',
  convivio: 'Kordata',
  travel: 'KUMANI Travel',
  events: 'KUMANI Events',
  eventsHome: 'KUMANI Events (homepage)',
  eventsOrganizer: 'KUMANI Events (organizzatori)',
  mosaic: 'Mosaic',
  fabula: 'Fabula',
  checkmail: 'CheckMail',
  oxygen: 'OXYGEN',
  antitruffa: 'Manuale Anti-Truffa (condivisione)',
  documentoSicuro: 'Documento Sicuro',
  verificaIban: 'Verifica IBAN',
  firmaEmail: 'Firma Email',
  calcolatrici: 'Calcolatrici PRO',
  focus: 'KUMANI Focus',
}
