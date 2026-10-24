import { IBAN_LENGTHS, ibanMod97, normalizeIban } from '@/lib/iban'
import { italianVatChecksumOk } from '@/lib/vat'
import { FIRST_NAMES, NOT_SURNAME } from './names'

// Testo Protetto: trova i dati personali in un testo, tutto nel browser e
// senza IA (regole, controlli delle cifre di controllo e un elenco di nomi).
// Non è infallibile: l'utente rivede sempre il risultato prima di usarlo.

export const PII_TYPES = ['person', 'email', 'phone', 'cf', 'vat', 'iban', 'card', 'birth', 'date', 'address', 'plate', 'docnum', 'custom'] as const
export type PiiType = (typeof PII_TYPES)[number]

export type Finding = {
  start: number
  end: number
  type: PiiType
  // Testo trovato e chiave dell'entità (stessa persona, stesso IBAN… = stessa chiave)
  value: string
  key: string
}

export type DetectOptions = {
  // Tutte le date (non solo quelle di nascita)
  allDates?: boolean
  // Parole da nascondere sempre (es. nome della scuola o del paese)
  custom?: string[]
}

// Priorità quando due risultati si sovrappongono (più alto vince, poi il più lungo)
const PRIORITY: Record<PiiType, number> = { custom: 10, iban: 9, cf: 9, email: 9, card: 8, vat: 8, docnum: 7, plate: 6, birth: 6, phone: 5, address: 4, person: 3, date: 2 }

const UP = 'A-ZÀ-ÖØ-Ý'
const LOW = 'a-zà-öø-ÿ'
const WORD_CAP = `[${UP}][${LOW}'’]+`
const MONTHS = 'gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre'
const DATE = `(?:\\d{1,2}[/.\\-]\\d{1,2}[/.\\-]\\d{2,4}|\\d{1,2}°?\\s+(?:${MONTHS})\\s+\\d{4}|\\d{4}-\\d{2}-\\d{2})`

const digits = (s: string) => s.replace(/\D/g, '')

// ── Codice fiscale (con omocodia) ─────────────────────────────────────────
const CF_ODD: Record<string, number> = {
  0: 1, 1: 0, 2: 5, 3: 7, 4: 9, 5: 13, 6: 15, 7: 17, 8: 19, 9: 21,
  A: 1, B: 0, C: 5, D: 7, E: 9, F: 13, G: 15, H: 17, I: 19, J: 21, K: 2, L: 4, M: 18, N: 20, O: 11, P: 3, Q: 6, R: 8, S: 12, T: 14, U: 16, V: 10, W: 22, X: 25, Y: 24, Z: 23,
}
export function codiceFiscaleOk(raw: string) {
  const cf = raw.toUpperCase()
  if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[A-EHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false
  let sum = 0
  for (let i = 0; i < 15; i++) {
    const c = cf[i]
    if (i % 2 === 0) sum += CF_ODD[c]
    else sum += /\d/.test(c) ? Number(c) : c.charCodeAt(0) - 65
  }
  return String.fromCharCode(65 + (sum % 26)) === cf[15]
}

function luhnOk(num: string) {
  let sum = 0
  for (let i = 0; i < num.length; i++) {
    let n = Number(num[num.length - 1 - i])
    if (i % 2 === 1) {
      n *= 2
      if (n > 9) n -= 9
    }
    sum += n
  }
  return sum % 10 === 0
}

type Raw = Omit<Finding, 'key'> & { key?: string }

function each(text: string, re: RegExp, fn: (m: RegExpExecArray) => Raw | Raw[] | null) {
  const out: Raw[] = []
  re.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const r = fn(m)
    if (r) out.push(...(Array.isArray(r) ? r : [r]))
    if (m[0].length === 0) re.lastIndex++
  }
  return out
}

// Posizione di un gruppo dentro la corrispondenza
const groupAt = (m: RegExpExecArray, group: number) => m.index + m[0].indexOf(m[group])

export function detect(text: string, opts: DetectOptions = {}): Finding[] {
  const found: Raw[] = []

  // Email
  found.push(...each(text, /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, (m) => ({ start: m.index, end: m.index + m[0].length, type: 'email', value: m[0], key: `email:${m[0].toLowerCase()}` })))

  // Codice fiscale: anche con la cifra di controllo sbagliata (un refuso resta
  // un dato personale), purché lettere e cifre siano al posto giusto
  found.push(
    ...each(text, /\b[A-Za-z]{6}[0-9LMNPQRSTUVlmnpqrstuv]{2}[ABCDEHLMPRSTabcdehlmprst][0-9LMNPQRSTUVlmnpqrstuv]{2}[A-Za-z][0-9LMNPQRSTUVlmnpqrstuv]{3}[A-Za-z]\b/g, (m) =>
      /\d/.test(m[0]) ? { start: m.index, end: m.index + m[0].length, type: 'cf', value: m[0], key: `cf:${m[0].toUpperCase()}` } : null
    )
  )

  // IBAN (con le cifre di controllo giuste)
  found.push(
    ...each(text, /\b[A-Za-z]{2}\d{2}(?:[ ]?[A-Za-z0-9]){11,30}\b/g, (m) => {
      const n = normalizeIban(m[0])
      const len = IBAN_LENGTHS[n.slice(0, 2)]
      if (!len) return null
      // Spazi finiti dentro la corrispondenza oltre la lunghezza giusta: si taglia
      let consumed = 0
      let end = m.index
      while (consumed < len && end < m.index + m[0].length) {
        if (/[A-Za-z0-9]/.test(text[end])) consumed++
        end++
      }
      const value = text.slice(m.index, end)
      const norm = normalizeIban(value)
      return norm.length === len && ibanMod97(norm) === 1 ? { start: m.index, end, type: 'iban', value, key: `iban:${norm}` } : null
    })
  )

  // Partita IVA (con la parola accanto o con «IT» davanti)
  found.push(
    ...each(text, /(?:(p\.?\s?iva|partita\s+iva|vat|c\.?f\.?\s*\/\s*p\.?\s?iva)[\s:.n°]*(?:IT)?\s?|\bIT)(\d{11})\b/gi, (m) =>
      italianVatChecksumOk(m[2]) ? { start: groupAt(m, 2), end: groupAt(m, 2) + 11, type: 'vat', value: m[2], key: `vat:${m[2]}` } : null
    )
  )

  // Carte di pagamento (Luhn)
  found.push(
    ...each(text, /\b\d(?:[ -]?\d){12,18}\b/g, (m) => {
      const n = digits(m[0])
      return n.length >= 13 && n.length <= 19 && luhnOk(n) && !/^(\d)\1+$/.test(n) ? { start: m.index, end: m.index + m[0].length, type: 'card', value: m[0], key: `card:${n}` } : null
    })
  )

  // Telefoni (italiani e internazionali)
  found.push(
    ...each(text, /(?:(?:\+|00)\d{1,3}[\s.-]?)?(?:\(?0\d{1,3}\)?|3\d{2})[\s./-]?\d{2,4}(?:[\s.-]?\d{2,4}){1,2}\b|(?:\+|00)\d{1,3}[\s.-]?\d{2,4}(?:[\s.-]?\d{2,4}){2,3}\b/g, (m) => {
      const n = digits(m[0])
      if (n.length < 8 || n.length > 15) return null
      // Una data (12.03.2015) non è un telefono
      if (new RegExp(`^${DATE}$`).test(m[0].trim())) return null
      return { start: m.index, end: m.index + m[0].length, type: 'phone', value: m[0], key: `phone:${n.slice(-9)}` }
    })
  )

  // Targhe (AB123CD) e documenti (carta d'identità, passaporto, patente)
  found.push(...each(text, /\b[A-Z]{2}\s?\d{3}\s?[A-Z]{2}\b/g, (m) => ({ start: m.index, end: m.index + m[0].length, type: 'plate', value: m[0], key: `plate:${m[0].replace(/\s/g, '')}` })))
  found.push(
    ...each(text, /\b(?:[A-Z]{2}\d{5}[A-Z]{2}|[A-Z]{2}\d{7}[A-Z]?|A[A-Z]\s?\d{7}|[A-Z]{2}\d{6,9})\b/g, (m) =>
      /^[A-Z]{2}\s?\d{3}\s?[A-Z]{2}$/.test(m[0]) ? null : { start: m.index, end: m.index + m[0].length, type: 'docnum', value: m[0], key: `doc:${m[0].replace(/\s/g, '')}` }
    )
  )

  // Date di nascita (e luogo: «nato a Roma il 12/03/2015»)
  found.push(
    ...each(text, new RegExp(`(nat[oaie]|data\\s+di\\s+nascita|nascita|born|né|née|nacid[oa]|geboren|d\\.?\\s?n\\.?)[^\\n]{0,40}?(${DATE})`, 'gi'), (m) => ({
      start: groupAt(m, 2),
      end: groupAt(m, 2) + m[2].length,
      type: 'birth',
      value: m[2],
      key: `birth:${m[2]}`,
    }))
  )
  found.push(
    ...each(text, new RegExp(`\\b(?:nat[oaie]|residente|domiciliat[oa])\\s+(?:a|in)\\s+(${WORD_CAP}(?:\\s+${WORD_CAP}){0,2})`, 'g'), (m) => ({
      start: groupAt(m, 1),
      end: groupAt(m, 1) + m[1].length,
      type: 'address',
      value: m[1],
      key: `place:${m[1].toLowerCase()}`,
    }))
  )
  if (opts.allDates) found.push(...each(text, new RegExp(DATE, 'gi'), (m) => ({ start: m.index, end: m.index + m[0].length, type: 'date', value: m[0], key: `date:${m[0]}` })))

  // Indirizzi: «via Roma 12», «piazza Garibaldi, 3», «00184 Roma (RM)»
  found.push(
    ...each(
      text,
      new RegExp(`\\b(?:[Vv]ia|[Vv]iale|[Vv]\\.le|[Pp]iazza|[Pp]\\.zza|[Pp]iazzale|[Cc]orso|[Cc]\\.so|[Vv]icolo|[Ll]argo|[Ss]trada|[Ll]ocalità|[Ll]oc\\.|[Cc]ontrada|[Bb]orgo|[Ll]ungomare|[Ss]alita|[Tt]raversa|[Rr]ue|[Cc]alle|[Rr]ua|[Ss]traße)\\s+(?:(?:${WORD_CAP}|[IVXLC]+|\\d{1,2}(?=\\s+[${UP}])|d[ei]|del(?:la|le|lo)?|degli|dei)\\s?){1,5}(?:,?\\s*(?:n\\.?\\s*)?\\d{1,4}[a-zA-Z]?(?:/[a-zA-Z0-9]+)?(?!\\d))?`, 'g'),
      (m) => (/[A-ZÀ-Ý\d]/.test(m[0].replace(/^\S+\s+/, '').charAt(0)) ? { start: m.index, end: m.index + m[0].trimEnd().length, type: 'address', value: m[0].trim(), key: `addr:${m[0].trim().toLowerCase()}` } : null)
    )
  )
  found.push(
    ...each(text, new RegExp(`\\b\\d{5}\\s+${WORD_CAP}(?:\\s+${WORD_CAP})?(?:\\s*\\(?[A-Z]{2}\\)?)?`, 'g'), (m) => ({ start: m.index, end: m.index + m[0].length, type: 'address', value: m[0], key: `addr:${m[0].toLowerCase()}` }))
  )

  // Persone: titoli («prof. Bianchi», «l'alunno Marco Verdi») e nomi propri
  const people: Raw[] = []
  people.push(
    ...each(
      text,
      new RegExp(`\\b(?:[Ss]ig\\.(?:ra|na)?|[Ss]ignor[ae]?|[Dd]ott\\.(?:ssa)?|[Dd]ottor(?:essa)?|[Pp]rof\\.(?:ssa)?|[Pp]rofessor(?:essa)?|[Aa]vv\\.|[Aa]vvocat[oa]|[Ii]ng\\.|[Aa]rch\\.|[Gg]eom\\.|[Rr]ag\\.|[Mm]aestr[oa]|[Aa]lunn[oa]|[Ss]tudent(?:e|essa)|[Bb]ambin[oa]|[Pp]aziente|[Mm]inore|[Mm]r\\.?|[Mm]rs\\.?|[Mm]s\\.?|[Dd]r\\.|[Mm]me|[Mm]\\.|[Ss]r\\.|[Ss]ra\\.|[Hh]err|[Ff]rau)\\s+(${WORD_CAP}(?:\\s+${WORD_CAP}){0,2})`, 'g'),
      (m) => ({ start: groupAt(m, 1), end: groupAt(m, 1) + m[1].length, type: 'person', value: m[1] })
    )
  )
  // Nome dell'elenco (anche TUTTO MAIUSCOLO), con i cognomi accanto
  const tokenRe = new RegExp(`[${UP}][${LOW}'’]+|[${UP}]{2,}`, 'g')
  const tokens = each(text, tokenRe, (m) => ({ start: m.index, end: m.index + m[0].length, type: 'person', value: m[0] }))
  const isSurname = (tok: Raw | undefined, prev: Raw) => {
    if (!tok) return false
    const between = text.slice(prev.end, tok.start)
    if (!/^[ \t]{1,2}$/.test(between) && !(between === ' ' || between === '  ')) return false
    if (NOT_SURNAME.has(tok.value.toLowerCase())) return false
    return true
  }
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]
    if (!FIRST_NAMES.has(tok.value.toLowerCase().replace(/[’']/g, ''))) continue
    let start = tok.start
    let end = tok.end
    // Cognome dopo (fino a due parole) …
    let j = i + 1
    while (j < tokens.length && j <= i + 2 && isSurname(tokens[j], tokens[j - 1])) {
      end = tokens[j].end
      j++
    }
    // … o prima («ROSSI Mario», «Rossi Mario» in un elenco)
    const prev = tokens[i - 1]
    if (prev && isSurname(tok, prev) && !FIRST_NAMES.has(prev.value.toLowerCase())) {
      const before = text.slice(Math.max(0, prev.start - 2), prev.start)
      const sentenceStart = prev.start === 0 || /[.!?:\n]\s*$/.test(before) || /^\s*$/.test(before) && prev.start <= 1
      if (/^[A-ZÀ-Ý]{2,}$/.test(prev.value) || (!sentenceStart && end === tok.end)) start = prev.start
    }
    people.push({ start, end, type: 'person', value: text.slice(start, end) })
  }

  // Parole da nascondere sempre
  for (const word of opts.custom ?? []) {
    const w = word.trim()
    if (w.length < 2) continue
    const re = new RegExp(`(?<![\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'giu')
    found.push(...each(text, re, (m) => ({ start: m.index, end: m.index + m[0].length, type: 'custom', value: m[0], key: `custom:${w.toLowerCase()}` })))
  }

  // Stessa persona in tutto il testo: «Mario Rossi», poi «Mario» o «Rossi» da
  // soli. Due persone con lo stesso cognome (fratelli, genitori) restano
  // distinte: un cognome da solo si collega solo se è di una persona sola.
  const byFirst = new Map<string, string>()
  const bySurname = new Map<string, Set<string>>()
  const linked: Raw[] = []
  for (const p of people.sort((a, b) => b.end - b.start - (a.end - a.start))) {
    const parts = p.value.split(/\s+/).map((w) => w.toLowerCase())
    const first = parts.find((w) => FIRST_NAMES.has(w))
    const surnames = parts.filter((w) => w !== first && !NOT_SURNAME.has(w))
    let key: string | undefined
    if (parts.length === 1) {
      const sur = bySurname.get(parts[0])
      key = byFirst.get(parts[0]) ?? (sur?.size === 1 ? [...sur][0] : undefined)
    } else if (first && surnames.length) {
      key = [...(bySurname.get(surnames[0]) ?? [])].find((k) => k.split(/[: ]/).includes(first))
    }
    key ??= `person:${[first, ...surnames].filter(Boolean).join(' ')}`
    if (first && !byFirst.has(first)) byFirst.set(first, key)
    for (const w of surnames) bySurname.set(w, new Set([...(bySurname.get(w) ?? []), key]))
    linked.push({ ...p, key })
  }
  for (const tok of tokens) {
    const w = tok.value.toLowerCase()
    const sur = bySurname.get(w)
    const key = byFirst.get(w) ?? (sur?.size === 1 ? [...sur][0] : sur && sur.size > 1 ? `person:${w}` : undefined)
    if (key) linked.push({ ...tok, key })
  }
  found.push(...linked)

  // Sovrapposizioni: vince la priorità più alta, poi il più lungo
  const sorted = found
    .filter((f) => f.end > f.start)
    .sort((a, b) => PRIORITY[b.type] - PRIORITY[a.type] || b.end - b.start - (a.end - a.start) || a.start - b.start)
  const taken: Finding[] = []
  for (const f of sorted) {
    if (taken.some((t) => f.start < t.end && t.start < f.end)) continue
    taken.push({ ...f, key: f.key ?? `${f.type}:${f.value.toLowerCase()}` })
  }
  return taken.sort((a, b) => a.start - b.start)
}

// ── Sostituzione con etichette e ripristino ──────────────────────────────

export type Protection = {
  text: string
  // Etichetta → testo originale (resta solo nel telefono, per rimettere i dati)
  map: Record<string, string>
  counts: Partial<Record<PiiType, number>>
}

// labels: nome dell'etichetta per tipo nella lingua dell'utente (es. PERSONA)
export function protect(text: string, findings: Finding[], labels: Record<PiiType, string>): Protection {
  const byKey = new Map<string, string>()
  const counters: Partial<Record<PiiType, number>> = {}
  const map: Record<string, string> = {}
  let out = ''
  let last = 0
  for (const f of findings) {
    let label = byKey.get(f.key)
    if (!label) {
      counters[f.type] = (counters[f.type] ?? 0) + 1
      label = `[${labels[f.type]} ${counters[f.type]}]`
      byKey.set(f.key, label)
      map[label] = f.value
    } else if (f.type === 'person' && f.value.length > map[label].length) {
      // Per le persone si ricorda la forma più completa («Mario Rossi»)
      map[label] = f.value
    }
    out += text.slice(last, f.start) + label
    last = f.end
  }
  out += text.slice(last)
  return { text: out, map, counts: counters }
}

// Rimette i dati veri nella risposta dell'IA (anche se ha cambiato maiuscole
// o spazi dentro le parentesi)
export function restore(answer: string, map: Record<string, string>) {
  const norm = (s: string) => s.replace(/[[\]\s]+/g, ' ').trim().toUpperCase()
  const lookup = new Map(Object.entries(map).map(([label, value]) => [norm(label), value]))
  let replaced = 0
  const text = answer.replace(/\[\s*([^\][\n]{1,40}?)\s+(\d{1,4})\s*\]/g, (whole, name: string, n: string) => {
    const value = lookup.get(norm(`${name} ${n}`))
    if (!value) return whole
    replaced++
    return value
  })
  return { text, replaced }
}

// Controllo finale: cosa potrebbe essere ancora un dato personale
export function leftovers(protectedText: string) {
  const longNumbers = (protectedText.match(/\d[\d\s./-]{6,}\d/g) ?? []).filter((s) => digits(s).length >= 7)
  const emails = protectedText.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g) ?? []
  return { longNumbers, emails }
}
