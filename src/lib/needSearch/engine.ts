// «Scrivi cosa ti serve»: dal bisogno scritto con parole proprie ai servizi
// giusti, senza IA e senza server. Si confrontano le parole della richiesta
// (senza accenti, parole vuote e finali di parola) con le frasi di tutti i
// giorni di ogni servizio (phrases.ts), il nome e la descrizione; tollera
// un errore di battitura nelle parole lunghe.

import { NEED_PHRASES } from './phrases'

// extra: testi «dentro» il servizio (guida «Come si usa», volantino), letti sul server
export type NeedDoc = { id: string; title: string; name?: string; description: string; extra?: string }
// note: spiegazione scritta dall'IA (solo nella ricerca approfondita)
// strong: trovata una frase intera di almeno due parole (corrispondenza sicura)
export type NeedHit = { id: string; score: number; reason: string | null; note?: string; strong?: boolean }

const STOP = new Set(
  (
    // it
    'il lo la i gli le un una uno di da in con su per tra fra e o ed od che chi mi ti si ci vi ne non ho hai ha abbiamo hanno sono sei è era come cosa voglio vorrei devo posso puoi mio mia miei mie tuo tua suo sua del dello della dei degli delle al allo alla ai agli alle dal dalla nel nella nei nelle sul sulla questo questa quello quella ma anche molto poco più meno se perché quando dove qualcosa qualcuno fare avere essere un po aiuto aiutami serve servirebbe bisogno ' +
    // en
    'the a an to of for and or i my me is are am was how what want need can could do does it this that in on with from please help some '+
    // fr es pt de
    'le la les un une des de du et ou je mon ma mes est pour avec el los las unos unas y o yo mi mis es para con um uma os as eu meu minha para com der die das ein eine und oder ich mein ist für mit '
  ).split(/\s+/),
)

export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, ' ')
    .replace(/[^a-z0-9Ѐ-ӿ]+/g, ' ')
    .trim()

// Radice semplice: toglie le finali più comuni (truffa/truffe/truffato → truff)
function stem(w: string) {
  if (/^[Ѐ-ӿ]+$/.test(w)) return w.length > 4 ? w.replace(/[аеиоуыяюйь]+$/u, '') : w
  if (w.length <= 3 || /^\d+$/.test(w)) return w
  let s = w.replace(/(zioni|zione|mente|ing|ies)$/, '')
  if (s.length > 4) s = s.replace(/(ati|ato|ate|ata|ito|ita|uto|uta|ed|es)$/, '')
  if (s.length > 3) s = s.replace(/[aeios]$/, '')
  return s
}

export const tokens = (text: string) =>
  normalize(text)
    .split(' ')
    .filter((w) => w.length >= 2 && !STOP.has(w))
    .map(stem)

// Distanza tra due parole (quante lettere cambiano), fermandosi presto
function close(a: string, b: string) {
  if (a === b) return true
  const min = Math.min(a.length, b.length)
  // Una parola che comincia come l'altra conta solo se sono quasi uguali (mand ≠ mandala)
  if (min >= 5 && min / Math.max(a.length, b.length) >= 0.7 && (a.startsWith(b) || b.startsWith(a))) return true
  if (min < 5) return false
  const max = min >= 8 ? 2 : 1
  if (Math.abs(a.length - b.length) > max) return false
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    let rowMin = prev[0]
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
      rowMin = Math.min(rowMin, prev[j])
    }
    if (rowMin > max) return false
  }
  return prev[b.length] <= max
}

type Indexed = { id: string; phrases: { text: string; tokens: string[] }[]; title: string[]; desc: string[]; extra: string[] }

export function buildIndex(docs: NeedDoc[], locale: string): Indexed[] {
  return docs.map((d) => {
    // Le sezioni della Community in Home si chiamano «community-…»
    const own = NEED_PHRASES[d.id] ?? NEED_PHRASES[d.id.replace(/^community-/, '')] ?? {}
    // Lingua della pagina, più inglese (molte parole sono internazionali) e italiano
    const list = [...(own[locale as keyof typeof own] ?? []), ...(locale !== 'en' ? (own.en ?? []) : []), ...(locale !== 'it' ? (own.it ?? []) : [])]
    return {
      id: d.id,
      phrases: list.map((text) => ({ text, tokens: tokens(text) })).filter((p) => p.tokens.length),
      title: [...new Set(tokens(`${d.title} ${d.name ?? ''}`))],
      desc: [...new Set(tokens(d.description))],
      extra: d.extra ? [...new Set(tokens(d.extra))] : [],
    }
  })
}

// Ricerca da approfondire: niente trovato, poco sicuro su una o due parole,
// oppure una frase intera senza una corrispondenza sicura
export function isWeak(query: string, hits: NeedHit[]) {
  if (!hits.length) return true
  if (tokens(query).length <= 2) return hits[0].score < 6
  return hits[0].score < 8 || !hits[0].strong
}

export function searchNeeds(index: Indexed[], query: string, limit = 3): NeedHit[] {
  const q = [...new Set(tokens(query))]
  if (!q.length) return []
  const has = (list: string[], w: string) => list.some((x) => close(w, x))
  const hits: NeedHit[] = []
  for (const doc of index) {
    let score = 0
    let reason: string | null = null
    let best = 0
    let strong = false
    for (const p of doc.phrases) {
      const matched = p.tokens.filter((t) => q.some((w) => close(w, t))).length
      if (matched === p.tokens.length) {
        // Frase intera: conta molto, di più se lunga
        const gain = 4 + 2 * p.tokens.length
        if (gain > best) {
          best = gain
          reason = p.text
          strong = p.tokens.length >= 2
        }
      } else if (matched > 0 && p.tokens.length > 1) best = Math.max(best, 1.5 * matched)
    }
    score += best
    let extraHits = 0
    for (const w of q) {
      if (has(doc.title, w)) score += 3
      else if (has(doc.desc, w)) score += 1
      else if (doc.extra.length && has(doc.extra, w)) extraHits++
    }
    // Dentro la guida e il volantino: conta se ci sono più parole della richiesta
    if (extraHits) score += extraHits * (extraHits / q.length >= 0.5 ? 1.5 : 0.7)
    if (score >= 3) hits.push({ id: doc.id, score, reason, strong })
  }
  hits.sort((a, b) => b.score - a.score)
  // Solo risultati vicini al migliore (niente proposte deboli)
  const top = hits[0]?.score ?? 0
  return hits.filter((h) => h.score >= top * 0.45).slice(0, limit)
}
