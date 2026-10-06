import { parse, TYPE, type MessageFormatElement } from '@formatjs/icu-messageformat-parser'

// Strumenti comuni dell'Area Traduttori (browser e server): testi "piatti"
// con chiave a punti (es. "landingHome.heroTitle"), controllo dei
// segnaposto e impronta del testo italiano.

// Costanti senza parser in translationLocales.ts (le usano anche i
// componenti client); qui ri-esportate per chi le importava da questo file
export { LOCALE_LABELS, SECTION_LABELS, TRANSLATOR_LOCALES, isTranslatorLocale, type TranslatorLocale } from '@/lib/translationLocales'

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
