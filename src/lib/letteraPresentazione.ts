import { CV_TEMPLATES, type CvTemplate } from '@/lib/cv'
import { LETTER_PHRASES, type PhraseToken } from '@/lib/letteraPresentazioneFrasi'

// Lettera di presentazione: dati, limiti e scritte fisse della lettera nella
// lingua della lettera (non in quella del sito), usati da anteprima e PDF.

export const LETTER_LANGS = ['it', 'en', 'es', 'fr', 'de', 'pt', 'ru'] as const
export type LetterLang = (typeof LETTER_LANGS)[number]

export const LETTER_LANG_NAMES: Record<LetterLang, string> = {
  it: 'Italiano',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ru: 'Русский',
}

export function asLetterLang(value: unknown): LetterLang {
  return (LETTER_LANGS as readonly string[]).includes(String(value)) ? (String(value) as LetterLang) : 'it'
}

export function asTemplate(value: unknown): CvTemplate {
  return (CV_TEMPLATES as readonly string[]).includes(String(value)) ? (String(value) as CvTemplate) : 'moderno'
}

// Lunghezze massime (le stesse della migrazione 20270615100000)
export const LETTER_LIMITS = {
  title: 120,
  position: 160,
  senderName: 120,
  senderRole: 160,
  senderEmail: 200,
  senderPhone: 40,
  senderCity: 120,
  recipientCompany: 160,
  recipientName: 160,
  recipientAddress: 300,
  place: 120,
  subject: 200,
  greeting: 160,
  body: 6000,
  closing: 160,
  signature: 120,
} as const

export interface CoverLetterForm {
  title: string
  language: LetterLang
  template: CvTemplate
  position: string
  senderName: string
  senderRole: string
  senderEmail: string
  senderPhone: string
  senderCity: string
  recipientCompany: string
  recipientName: string
  recipientAddress: string
  place: string
  letterDate: string // yyyy-mm-dd o vuoto
  subject: string
  greeting: string
  body: string
  closing: string
  signature: string
  attachCv: boolean
}

export type CoverLetterSummary = {
  id: string
  title: string
  recipient_company: string
  position: string
  content_language: string
  template: string
  letter_date: string | null
  updated_at: string
}

// Riga del database → modulo
export type CoverLetterRow = {
  id: string
  title: string
  content_language: string
  template: string
  position: string
  sender_name: string
  sender_role: string
  sender_email: string
  sender_phone: string
  sender_city: string
  recipient_company: string
  recipient_name: string
  recipient_address: string
  place: string
  letter_date: string | null
  subject: string
  greeting: string
  body: string
  closing: string
  signature: string
  attach_cv: boolean
  updated_at: string
}

export function rowToForm(row: CoverLetterRow): CoverLetterForm {
  return {
    title: row.title,
    language: asLetterLang(row.content_language),
    template: asTemplate(row.template),
    position: row.position ?? '',
    senderName: row.sender_name ?? '',
    senderRole: row.sender_role ?? '',
    senderEmail: row.sender_email ?? '',
    senderPhone: row.sender_phone ?? '',
    senderCity: row.sender_city ?? '',
    recipientCompany: row.recipient_company ?? '',
    recipientName: row.recipient_name ?? '',
    recipientAddress: row.recipient_address ?? '',
    place: row.place ?? '',
    letterDate: row.letter_date ?? '',
    subject: row.subject ?? '',
    greeting: row.greeting ?? '',
    body: row.body ?? '',
    closing: row.closing ?? '',
    signature: row.signature ?? '',
    attachCv: row.attach_cv !== false,
  }
}

// Oggi a Roma, yyyy-mm-dd
export function romeTodayIso(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())
}

// Mittente da precompilare (dal CV o dal profilo)
export type LetterSender = {
  name: string
  role: string
  email: string
  phone: string
  city: string
  template?: CvTemplate
  language?: LetterLang
}

// Città senza la sigla della provincia: «Milano (MI)» → «Milano» (per il luogo)
function placeFromCity(city: string): string {
  return city.replace(/\s*\([^)]*\)\s*$/, '').split(',')[0].trim()
}

export function newLetterForm(sender: LetterSender | null): CoverLetterForm {
  const language = sender?.language ?? 'it'
  return {
    title: '',
    language,
    template: sender?.template ?? 'moderno',
    position: '',
    senderName: sender?.name ?? '',
    senderRole: sender?.role ?? '',
    senderEmail: sender?.email ?? '',
    senderPhone: sender?.phone ?? '',
    senderCity: sender?.city ?? '',
    recipientCompany: '',
    recipientName: '',
    recipientAddress: '',
    place: sender?.city ? placeFromCity(sender.city) : '',
    letterDate: romeTodayIso(),
    subject: '',
    greeting: LETTER_PHRASES[language].greetings[0],
    body: '',
    closing: LETTER_PHRASES[language].closings[0],
    signature: sender?.name ?? '',
    attachCv: true,
  }
}

// ─── Scritte fisse della lettera ──────────────────────────────────────────

export type LetterLabels = {
  docTitle: string // «Lettera di presentazione»
  subjectPrefix: string // «Oggetto:» (vuoto in tedesco: oggetto solo in grassetto)
  attention: string // «c.a.» prima della persona o dell'ufficio (vuoto: niente)
  enclosure: string // «Allegato: curriculum vitae»
  autoSubject: string // con {position}
  datePrefix: string // «le » in francese
  namePlaceholder: string
  recipientRight: boolean // destinatario a destra (uso italiano, francese, spagnolo, portoghese)
  dateLeft: boolean // luogo e data a sinistra (uso inglese)
  tokens: Record<PhraseToken, string> // segnaposto tra parentesi quadre
}

const LABELS: Record<LetterLang, LetterLabels> = {
  it: {
    docTitle: 'Lettera di presentazione',
    subjectPrefix: 'Oggetto:',
    attention: 'C.a.',
    enclosure: 'Allegato: curriculum vitae',
    autoSubject: 'Candidatura per la posizione di {position}',
    datePrefix: '',
    namePlaceholder: '[Nome e cognome]',
    recipientRight: true,
    dateLeft: false,
    tokens: { company: '[azienda]', position: '[ruolo]', profession: '[mestiere]', recipient: '[nome]' },
  },
  en: {
    docTitle: 'Cover letter',
    subjectPrefix: 'Subject:',
    attention: 'Attn:',
    enclosure: 'Enclosure: CV',
    autoSubject: 'Application for the position of {position}',
    datePrefix: '',
    namePlaceholder: '[Full name]',
    recipientRight: false,
    dateLeft: true,
    tokens: { company: '[company]', position: '[position]', profession: '[profession]', recipient: '[name]' },
  },
  es: {
    docTitle: 'Carta de presentación',
    subjectPrefix: 'Asunto:',
    attention: 'A/A',
    enclosure: 'Anexo: currículum vitae',
    autoSubject: 'Candidatura para el puesto de {position}',
    datePrefix: '',
    namePlaceholder: '[Nombre y apellidos]',
    recipientRight: true,
    dateLeft: false,
    tokens: { company: '[empresa]', position: '[puesto]', profession: '[profesión]', recipient: '[nombre]' },
  },
  fr: {
    docTitle: 'Lettre de motivation',
    subjectPrefix: 'Objet :',
    attention: '',
    enclosure: 'Pièce jointe : CV',
    autoSubject: 'Candidature au poste de {position}',
    datePrefix: 'le ',
    namePlaceholder: '[Prénom et nom]',
    recipientRight: true,
    dateLeft: false,
    tokens: { company: '[entreprise]', position: '[poste]', profession: '[métier]', recipient: '[nom]' },
  },
  de: {
    docTitle: 'Anschreiben',
    subjectPrefix: '',
    attention: 'z. Hd.',
    enclosure: 'Anlage: Lebenslauf',
    autoSubject: 'Bewerbung als {position}',
    datePrefix: '',
    namePlaceholder: '[Vor- und Nachname]',
    recipientRight: false,
    dateLeft: false,
    tokens: { company: '[Firma]', position: '[Stelle]', profession: '[Beruf]', recipient: '[Name]' },
  },
  pt: {
    docTitle: 'Carta de apresentação',
    subjectPrefix: 'Assunto:',
    attention: 'A/C',
    enclosure: 'Anexo: curriculum vitae',
    autoSubject: 'Candidatura para a função de {position}',
    datePrefix: '',
    namePlaceholder: '[Nome completo]',
    recipientRight: true,
    dateLeft: false,
    tokens: { company: '[empresa]', position: '[função]', profession: '[profissão]', recipient: '[nome]' },
  },
  ru: {
    docTitle: 'Сопроводительное письмо',
    subjectPrefix: 'Тема:',
    attention: 'Кому:',
    enclosure: 'Приложение: резюме',
    autoSubject: 'Отклик на вакансию «{position}»',
    datePrefix: '',
    namePlaceholder: '[Имя и фамилия]',
    recipientRight: false,
    dateLeft: false,
    tokens: { company: '[компания]', position: '[должность]', profession: '[профессия]', recipient: '[имя]' },
  },
}

export function letterLabels(lang: string): LetterLabels {
  return LABELS[asLetterLang(lang)]
}

// Oggetto proposto dal ruolo cercato (vuoto se il ruolo non c'è)
export function autoSubject(lang: string, position: string): string {
  const p = midSentence(position.trim(), asLetterLang(lang))
  // Con una funzione: un «$» nel ruolo resta com'è (niente sostituzioni speciali)
  return p ? letterLabels(lang).autoSubject.replace('{position}', () => p) : ''
}

export function formatLetterDate(iso: string, lang: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [y, m, d] = iso.split('-').map(Number)
  try {
    const text = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)))
    return letterLabels(lang).datePrefix + text
  } catch {
    return iso
  }
}

// ─── Segnaposto ───────────────────────────────────────────────────────────

type TokenValues = Record<PhraseToken, string>

// Ruolo e mestiere a metà frase con la minuscola («come addetta alle vendite»),
// tranne in tedesco (nomi maiuscoli) e in russo (tra virgolette); le sigle restano
function midSentence(value: string, lang: LetterLang): string {
  if (lang === 'de' || lang === 'ru') return value
  return /^\p{Lu}\p{Ll}/u.test(value) ? value.charAt(0).toLocaleLowerCase(lang) + value.slice(1) : value
}

function tokenValues(form: CoverLetterForm): TokenValues {
  const lang = asLetterLang(form.language)
  return {
    company: form.recipientCompany.trim(),
    position: midSentence(form.position.trim(), lang),
    profession: midSentence(form.senderRole.trim(), lang),
    recipient: form.recipientName.trim(),
  }
}

// Frase pronta → testo da inserire: {company} ecc. diventano i dati scritti
// nel modulo oppure il segnaposto tra parentesi quadre nella lingua della lettera
export function fillPhrase(phrase: string, form: CoverLetterForm): string {
  const values = tokenValues(form)
  const L = letterLabels(form.language)
  let text = phrase
  // Inglese: «a» o «an» secondo la parola che arriva («an electrician»)
  if (form.language === 'en') {
    text = text.replace(/\ba \{(company|position|profession|recipient)\}/g, (all, k: PhraseToken) => (/^[aeiou]/i.test(values[k]) ? `an {${k}}` : all))
  }
  return text.replace(/\{(company|position|profession|recipient)\}/g, (_, k: PhraseToken) => values[k] || L.tokens[k])
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Segnaposto noti (in tutte le lingue) sostituiti con i dati scritti dopo:
// chi inserisce una frase prima di scrivere l'azienda la vede comunque giusta
export function resolvePlaceholders(text: string, form: CoverLetterForm): string {
  const values = tokenValues(form)
  const en = asLetterLang(form.language) === 'en'
  let out = text
  for (const k of Object.keys(values) as PhraseToken[]) {
    const value = values[k]
    if (!value) continue
    const all = [...new Set(LETTER_LANGS.map((l) => LABELS[l].tokens[k]))]
    // Inglese: «a [profession]» diventa «an electrician» se serve; il valore
    // va con una funzione, così un «$» scritto dall'utente resta com'è
    out = out.replace(new RegExp(`(\\b[Aa] )?(?:${all.map(escapeRe).join('|')})`, 'gi'), (_, article: string | undefined) =>
      article ? `${en && /^[aeiou]/i.test(value) ? `${article.trim()}n` : article.trim()} ${value}` : value,
    )
  }
  return out
}

// Parti ancora da completare: testo tra parentesi quadre rimasto nella lettera
export const PLACEHOLDER_RE = /\[[^\][\n]{1,40}\]/g

export function missingPlaceholders(model: LetterModel): string[] {
  const texts = [model.subject, model.greeting, model.closing, model.signature, ...model.paragraphs, ...model.recipient.map((r) => r.text)]
  const found = new Set<string>()
  for (const t of texts) for (const m of t.matchAll(PLACEHOLDER_RE)) found.add(m[0])
  return [...found]
}

// ─── Lettera pronta da disegnare (anteprima e PDF) ────────────────────────

export type LetterModel = {
  lang: LetterLang
  template: CvTemplate
  L: LetterLabels
  name: string // vuoto se manca
  role: string
  contacts: string[] // email, telefono, città
  email: string
  phone: string
  city: string
  recipient: { text: string; bold?: boolean }[]
  placeDate: string
  subject: string
  greeting: string
  paragraphs: string[]
  closing: string
  signature: string
  enclosure: string
}

export function letterModel(form: CoverLetterForm): LetterModel {
  const lang = asLetterLang(form.language)
  const L = letterLabels(lang)
  const r = (s: string) => resolvePlaceholders(s.trim(), form)
  const recipient: { text: string; bold?: boolean }[] = []
  if (form.recipientCompany.trim()) recipient.push({ text: form.recipientCompany.trim(), bold: true })
  if (form.recipientName.trim()) recipient.push({ text: [L.attention, form.recipientName.trim()].filter(Boolean).join(' ') })
  form.recipientAddress
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((text) => recipient.push({ text }))
  const date = formatLetterDate(form.letterDate, lang)
  const place = form.place.trim()
  return {
    lang,
    template: form.template,
    L,
    name: form.senderName.trim(),
    role: form.senderRole.trim(),
    contacts: [form.senderEmail, form.senderPhone, form.senderCity].map((x) => x.trim()).filter(Boolean),
    email: form.senderEmail.trim(),
    phone: form.senderPhone.trim(),
    city: form.senderCity.trim(),
    recipient,
    placeDate: [place, date].filter(Boolean).join(', '),
    subject: r(form.subject),
    greeting: r(form.greeting),
    // Ogni riga del testo è un paragrafo (le righe vuote non contano)
    paragraphs: form.body
      .split(/\r?\n/)
      .map((l) => r(l))
      .filter(Boolean),
    closing: r(form.closing),
    signature: form.signature.trim() || form.senderName.trim(),
    enclosure: form.attachCv ? L.enclosure : '',
  }
}

// Nome del file: «Lettera di presentazione - Mario Rossi - Rossi Srl.pdf»
export function letterFileName(form: CoverLetterForm): string {
  const L = letterLabels(form.language)
  const parts = [L.docTitle, form.senderName.trim(), form.recipientCompany.trim()].filter(Boolean)
  const name = parts
    .join(' - ')
    .replace(/[\\/:*?"<>|\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
  return `${name || 'Lettera'}.pdf`
}
