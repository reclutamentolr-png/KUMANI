import { IBAN_LENGTHS, normalizeIban } from '@/lib/iban'
import { italianVatChecksumOk, parseVatInput } from '@/lib/vat'

// «Controlla prima di fidarti»: riconosce cosa ha incollato l'utente (un
// valore solo oppure un messaggio intero: SMS, WhatsApp, email) e porta allo
// strumento giusto già compilato. Tutto nel browser, a costo zero.
// Percorsi senza lingua.

export type QuickCheckKind = 'site' | 'email' | 'iban' | 'phone' | 'vat'
export type QuickCheckFinding = { kind: QuickCheckKind; value: string; path: string }

const pathFor = (kind: QuickCheckKind, value: string): string => {
  const v = encodeURIComponent(value)
  switch (kind) {
    case 'iban':
      return `/app/verifica-iban?iban=${v}`
    case 'email':
      return `/app/checkmail?sender=${v}`
    case 'vat':
      return `/app/svat?vat=${v}`
    case 'phone':
      return `/app/rete-antitruffa?tab=numero&n=${v}`
    case 'site':
      return `/app/svat?url=${v}`
  }
}

// Un valore solo (campo breve): lo strumento giusto, oppure null
export function quickCheckTarget(raw: string): string | null {
  const one = classifyOne(raw)
  return one ? one.path : null
}

function classifyOne(raw: string): QuickCheckFinding | null {
  const value = raw.trim().slice(0, 200)
  if (!value) return null

  // IBAN: 2 lettere + 2 cifre all'inizio e almeno 15 caratteri (l'esito,
  // valido o no, lo mostra la pagina Verifica IBAN)
  const iban = normalizeIban(value)
  if (/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban) && iban.length >= 15 && iban.length <= 34) return { kind: 'iban', value: iban, path: pathFor('iban', iban) }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) return { kind: 'email', value, path: pathFor('email', value) }

  // Partita IVA (parseVatInput scarta già indirizzi web ed email); anche se
  // la cifra di controllo è sbagliata si va in SVAT, che spiega l'errore
  if (parseVatInput(value)) return { kind: 'vat', value, path: pathFor('vat', value) }

  if (/^(\+|00)?[\d\s().-]{6,20}$/.test(value) && value.replace(/\D/g, '').length >= 6) return { kind: 'phone', value, path: pathFor('phone', value) }

  // Sito: inizia con http oppure contiene un punto e nessuno spazio
  if (/^https?:\/\//i.test(value) || (value.includes('.') && !/\s/.test(value) && /[a-z]/i.test(value))) return { kind: 'site', value, path: pathFor('site', value) }
  return null
}

// Domini di primo livello riconosciuti nei testi senza «http» (evita di
// scambiare per siti parole come «ciao.come»)
const TLDS = new Set(
  'com it net org info biz eu io co app shop store online site xyz top club live link click me tv us uk de fr es ch at be nl pt pl ro ru cn ly tk ml ga cf gq pw cc ws to sh vip win bid icu buzz cfd sbs lat mobi pro space website fun digital email support help services world today news one'.split(' ')
)

const trimEnd = (s: string) => s.replace(/[.,;:!?)\]}»"'’]+$/, '')

// Un messaggio intero: tutto quello che si può controllare (al massimo 8)
export function quickCheckFindings(raw: string): QuickCheckFinding[] {
  const text = raw.slice(0, 4000)
  if (!text.trim()) return []
  if (!/\s/.test(text.trim())) {
    const one = classifyOne(text)
    return one ? [one] : []
  }

  const found: QuickCheckFinding[] = []
  const seen = new Set<string>()
  let rest = text
  const take = (re: RegExp, accept: (match: string) => QuickCheckFinding | null) => {
    rest = rest.replace(re, (match) => {
      const finding = accept(match)
      if (!finding) return match
      const key = `${finding.kind}:${finding.value.toLowerCase()}`
      if (!seen.has(key)) {
        seen.add(key)
        found.push(finding)
      }
      return ' '.repeat(match.length)
    })
  }

  // IBAN (prima dei numeri, che altrimenti ne prenderebbero un pezzo)
  // (a gruppi di massimo 4 caratteri, come si scrivono; poi tagliato alla
  // lunghezza del suo paese, così la parola che segue non ci finisce dentro)
  take(/\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{1,4}){3,8}\b/gi, (m) => {
    let iban = normalizeIban(m)
    const length = IBAN_LENGTHS[iban.slice(0, 2)]
    if (length && iban.length > length) iban = iban.slice(0, length)
    return iban.length >= 15 && iban.length <= 34 && /\d{8}/.test(iban) ? { kind: 'iban', value: iban, path: pathFor('iban', iban) } : null
  })
  // Email (prima dei siti: il dominio dell'email non è un sito da controllare a parte)
  take(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, (m) => ({ kind: 'email', value: m, path: pathFor('email', m) }))
  // Link con http o www
  take(/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi, (m) => {
    const url = trimEnd(m)
    return url.length > 4 ? { kind: 'site', value: url, path: pathFor('site', url) } : null
  })
  // Domini scritti senza http (es. poste-verifica.com/accedi)
  take(/\b(?:[a-z0-9-]+\.)+([a-z]{2,24})(?:\/[^\s<>"']*)?/gi, (m) => {
    const url = trimEnd(m)
    const tld = /\.([a-z]{2,24})(?:\/|$)/i.exec(url)?.[1]?.toLowerCase()
    return tld && TLDS.has(tld) ? { kind: 'site', value: url, path: pathFor('site', url) } : null
  })
  // Partita IVA italiana solo se la cifra di controllo torna (altrimenti
  // potrebbe essere un numero di telefono)
  take(/\b(?:IT\s?)?\d{11}\b/gi, (m) => {
    const digits = m.replace(/\D/g, '')
    return italianVatChecksumOk(digits) ? { kind: 'vat', value: digits, path: pathFor('vat', digits) } : null
  })
  // Numeri di telefono: internazionali, cellulari, fissi e numeri a pagamento
  take(/(?:\+|\b00)\d[\d\s.\-()]{6,18}\d|\b3\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3,4}\b|\b0\d{1,4}[\s.\-/]?\d{4,8}\b|\b[89]\d{2}[\s.\-]?\d{3}[\s.\-]?\d{3,4}\b/g, (m) => {
    const digits = m.replace(/\D/g, '').length
    return digits >= 8 && digits <= 15 ? { kind: 'phone', value: m.trim(), path: pathFor('phone', m.trim()) } : null
  })

  return found.slice(0, 8)
}

// Un messaggio intero (SMS, WhatsApp, email) e non un valore solo: va a capo
// oppure ha più parole. In quel caso non si salta mai a uno strumento: si
// propone di analizzare tutto il messaggio con CheckMail, poi le singole cose.
export function isWholeMessage(raw: string): boolean {
  const s = raw.trim()
  return s.includes('\n') || s.split(/\s+/).length >= 6
}

// Il messaggio passa a CheckMail nella memoria della scheda (non
// nell'indirizzo: resta sul telefono e non finisce nella cronologia)
export const MESSAGE_HANDOFF_KEY = 'kumani_quickcheck_message'

// Mittente (riga «Da:» o la prima email) e oggetto (riga «Oggetto:»), in tutte le lingue del sito
export function messageParts(raw: string): { sender: string; subject: string; text: string } {
  const text = raw.slice(0, 4000)
  const from = /^\s*(?:da|from|de|von|от|mittente)\s*:\s*(.+)$/im.exec(text)?.[1] ?? ''
  const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  const sender = (email.exec(from)?.[0] ?? (from.trim() || email.exec(text)?.[0]) ?? '').slice(0, 300)
  const subject = (/^\s*(?:oggetto|subject|asunto|objet|assunto|betreff|тема)\s*:\s*(.+)$/im.exec(text)?.[1] ?? '').trim().slice(0, 500)
  return { sender, subject, text }
}
