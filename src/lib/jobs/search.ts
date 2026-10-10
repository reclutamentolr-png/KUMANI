import { SITE_URL } from '@/lib/siteUrl'
import { ProxyAgent, fetch as undiciFetch } from 'undici'
import {
  JOB_COUNTRIES,
  JOB_SEARCH_PAGES,
  jobSearchVariants,
  type JobFilters,
  type JobResult,
  type JobSearchEvent,
  type JobStats,
  type ScamFlag,
} from '@/lib/jobs/types'

// Motore di Trova Lavoro. KUMANI non ospita annunci: interroga Careerjet
// (programma partner), poi unisce, filtra, controlla e ordina i risultati.
// Careerjet restituisce solo titolo, azienda, luogo, stipendio, data e un
// breve riassunto: i filtri "fini" lavorano su questi campi.
const ENDPOINT = 'https://search.api.careerjet.net/v4/query'
const CONCURRENCY = 4

type CareerjetJob = {
  title?: string
  company?: string
  locations?: string
  salary?: string
  date?: string
  description?: string
  url?: string
}

type Caller = { ip: string; userAgent: string }

class SourceError extends Error {
  constructor(public code: 'unavailable' | 'failed') {
    super(code)
  }
}

// Parola aggiunta alla ricerca quando si vuole solo il lavoro da remoto, così
// la fonte restituisce soprattutto quegli annunci (poi li filtriamo comunque)
const REMOTE_WORD: Record<string, string> = { it: 'remoto', en: 'remote', fr: 'télétravail', es: 'remoto', pt: 'remoto', de: 'homeoffice', ru: 'удаленно' }

// Careerjet accetta solo IP autorizzati e Vercel non ha un IP fisso: se c'è
// FIXIE_URL (proxy con IP statici, es. http://utente:password@host:porta) le
// richieste a Careerjet escono da lì. Senza la variabile si va diretti (locale).
const PROXY_URL = process.env.FIXIE_URL || process.env.CAREERJET_PROXY_URL
let proxyAgent: ProxyAgent | null = null

async function careerjetFetch(url: string, init: { headers: Record<string, string>; signal: AbortSignal }) {
  if (!PROXY_URL) return fetch(url, { ...init, cache: 'no-store' })
  proxyAgent ??= new ProxyAgent(PROXY_URL)
  return undiciFetch(url, { ...init, dispatcher: proxyAgent })
}

async function fetchPage(filters: JobFilters, keywords: string, page: number, caller: Caller): Promise<CareerjetJob[]> {
  const key = process.env.CAREERJET_API_KEY
  if (!key) throw new SourceError('unavailable')
  const params = new URLSearchParams({
    locale_code: JOB_COUNTRIES[filters.country].locale,
    keywords: filters.remoteOnly ? `${keywords} ${REMOTE_WORD[JOB_COUNTRIES[filters.country].locale.slice(0, 2)] ?? 'remote'}` : keywords,
    location: filters.location,
    radius: String(filters.radiusKm || 0),
    sort: filters.sort === 'date' ? 'date' : filters.sort === 'salary' ? 'salary' : 'relevance',
    page: String(page),
    user_ip: caller.ip,
    user_agent: caller.userAgent,
  })
  const contract = { permanent: 'p', contract: 'c', temporary: 't', internship: 'i', any: '' }[filters.contract]
  if (contract) params.set('contract_type', contract)
  if (filters.hours !== 'any') params.set('work_hours', filters.hours === 'full' ? 'f' : 'p')

  const res = await careerjetFetch(`${ENDPOINT}?${params}`, {
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
      Referer: `${SITE_URL}/`,
    },
    signal: AbortSignal.timeout(20_000),
  })
  // 403: la fonte non accetta il server (IP non autorizzato o sito non dichiarato)
  if (res.status === 401 || res.status === 403) throw new SourceError('unavailable')
  if (!res.ok) throw new SourceError('failed')
  const data = (await res.json()) as { type?: string; jobs?: CareerjetJob[] }
  // LOCATIONS = luogo ambiguo: la fonte propone dei luoghi invece degli annunci
  return data.type === 'JOBS' ? (data.jobs ?? []) : []
}

// --- Testo ---

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' }
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
// Il grassetto della fonte (<b>) diventa **…**, il resto dei tag sparisce
const cleanSnippet = (s: string) =>
  decode(s.replace(/<b>/gi, '**').replace(/<\/b>/gi, '**').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
const words = (s: string) =>
  norm(s)
    .split(/[^a-z0-9а-яё]+/i)
    .filter((w) => w.length > 2)
const list = (s: string) =>
  s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

// --- Stipendio: "€1580 per month", "£28000 - 33000 per year", "€12.31 per hour" ---

function monthlySalary(text: string): number | null {
  if (!text) return null
  const nums = (text.replace(/(\d)[.,](\d{3})\b/g, '$1$2').match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')))
  if (nums.length === 0) return null
  const low = nums[0]
  const t = text.toLowerCase()
  if (/year|annum|an\b|año|ano|jahr|год/.test(t)) return Math.round(low / 12)
  if (/hour|heure|hora|stunde|ora|час/.test(t)) return Math.round(low * 160)
  if (/day|jour|día|dia|tag|giorno|день/.test(t)) return Math.round(low * 21)
  if (/week|semaine|semana|woche|settimana|недел/.test(t)) return Math.round(low * 4.33)
  return Math.round(low)
}

// --- Remoto, nelle lingue delle fonti ---

const REMOTE = /\b(remote|remotely|work from home|wfh|home ?office|smart ?working|telelavoro|da remoto|da casa|t[ée]l[ée]travail|teletrabajo|en remoto|teletrabalho|remoto|homeoffice|удал[её]нн)/i

// --- Segnali di possibile truffa (titolo, azienda, riassunto) ---

const SCAM: [ScamFlag, RegExp][] = [
  ['payToApply', /(quota|costo|pagamento|anticipo) (di )?(iscrizione|adesione|ingresso|formazione)|pay (a|the) (fee|deposit)|registration fee|frais d'inscription|cuota de inscripci[oó]n|taxa de inscri[cç][aã]o|anmeldegeb[üu]hr|вступительн(ый|ого) взнос/i],
  ['chatOnly', /(solo|only|uniquement|s[oó]lo|apenas|nur|только).{0,20}(whatsapp|telegram)|contatt\w+ (su|via) (whatsapp|telegram)|(whatsapp|telegram)\s*\+?\d{6,}/i],
  ['easyMoney', /guadagn\w+ (facil|subit|da casa)|soldi facili|easy money|earn \$?\d+.{0,12}(a|per) day|argent facile|dinero f[áa]cil|dinheiro f[áa]cil|schnell(es)? geld|л[её]гкие деньги|без опыта.{0,20}высок/i],
  ['personalData', /(invia|send|envoyez|env[ií]a|envie|sende|отправ\w+).{0,30}(documento|carta d'identit|passport|passaporto|iban|carte d'identit|dni|bank details|codice fiscale)/i],
]

function scamFlags(job: { title: string; company: string; snippet: string; salaryMonthly: number | null }, country: JobFilters['country']): ScamFlag[] {
  const text = `${job.title} ${job.company} ${job.snippet}`
  const flags = SCAM.filter(([, re]) => re.test(text)).map(([flag]) => flag)
  if (!job.company.trim()) flags.push('noCompany')
  // Stipendio molto sopra il normale per il paese (soglia larga, solo indizio)
  const high: Record<string, number> = { EUR: 15000, GBP: 13000, CHF: 20000, BRL: 60000, RUB: 900000 }
  if (job.salaryMonthly && job.salaryMonthly > (high[JOB_COUNTRIES[country].currency] ?? Infinity)) flags.push('unrealisticPay')
  return flags
}

// --- Ricerca completa ---

// meter.calls: richieste davvero fatte alla fonte (per il credito settimanale)
export async function* searchJobs(filters: JobFilters, caller: Caller, meter: { calls: number } = { calls: 0 }): AsyncGenerator<JobSearchEvent> {
  const variants = jobSearchVariants(filters)
  const pages = JOB_SEARCH_PAGES[filters.depth]
  const tasks = variants.flatMap((kw) => Array.from({ length: pages }, (_, i) => ({ kw, page: i + 1 })))
  const total = tasks.length

  // Chiamate in parallelo, poche alla volta; una variante si ferma quando
  // una pagina torna vuota (non ci sono altri annunci)
  const raw: CareerjetJob[] = []
  const exhausted = new Set<string>()
  let done = 0
  const state: { fatal: SourceError | null } = { fatal: null }
  yield { type: 'progress', step: 'search', done, total, found: 0 }
  for (let i = 0; i < tasks.length; i += CONCURRENCY) {
    const batch = tasks.slice(i, i + CONCURRENCY).filter((task) => !exhausted.has(task.kw))
    meter.calls += batch.length
    const results = await Promise.allSettled(batch.map((task) => fetchPage(filters, task.kw, task.page, caller)))
    results.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        raw.push(...r.value)
        if (r.value.length === 0) exhausted.add(batch[j].kw)
      } else if (r.reason instanceof SourceError && r.reason.code === 'unavailable') {
        state.fatal = r.reason
      }
    })
    done = Math.min(total, i + CONCURRENCY)
    if (state.fatal) break
    yield { type: 'progress', step: 'search', done, total, found: raw.length }
  }
  if (state.fatal && raw.length === 0) {
    yield { type: 'error', code: 'unavailable' }
    return
  }

  // Doppioni: stesso titolo, azienda e luogo
  const seen = new Map<string, CareerjetJob>()
  for (const job of raw) {
    const key = norm(`${job.title ?? ''}|${job.company ?? ''}|${job.locations ?? ''}`)
    if (!seen.has(key)) seen.set(key, job)
  }
  yield { type: 'progress', step: 'dedupe', count: seen.size }

  const keywordWords = [...new Set(variants.flatMap(words))]
  const excludeWords = list(filters.exclude).map(norm)
  const maxAgeMs = filters.postedDays > 0 ? filters.postedDays * 86_400_000 : 0
  const now = Date.now()

  let filteredOut = 0
  const jobs: JobResult[] = []
  for (const [key, job] of seen) {
    const title = decode(job.title ?? '').trim()
    if (!title || !job.url) continue
    const snippet = cleanSnippet(job.description ?? '')
    const company = decode(job.company ?? '').trim()
    const salaryText = (job.salary ?? '').replace(/\s+/g, ' ').trim()
    const salaryMonthly = monthlySalary(salaryText)
    const haystack = norm(`${title} ${company} ${snippet}`)
    const time = job.date ? Date.parse(job.date) : NaN
    const remote = REMOTE.test(`${title} ${snippet}`)

    // Filtri dell'utente
    if (excludeWords.some((w) => haystack.includes(w))) { filteredOut++; continue }
    if (maxAgeMs && Number.isFinite(time) && now - time > maxAgeMs) { filteredOut++; continue }
    if (filters.remoteOnly && !remote) { filteredOut++; continue }
    if (filters.minSalary > 0) {
      if (salaryMonthly === null ? !filters.includeNoSalary : salaryMonthly < filters.minSalary) { filteredOut++; continue }
    }

    // Pertinenza: parole cercate nel titolo (contano di più) e nel riassunto
    const titleWords = norm(title)
    const matched = keywordWords.filter((w) => titleWords.includes(w))
    const inSnippet = keywordWords.filter((w) => !matched.includes(w) && norm(snippet).includes(w)).length
    const ageDays = Number.isFinite(time) ? (now - time) / 86_400_000 : 30
    const score =
      matched.length * 4 +
      inSnippet +
      (matched.length > 0 && matched.length === keywordWords.length ? 3 : 0) +
      Math.max(0, 3 - ageDays / 5) +
      (salaryMonthly ? 1 : 0)

    jobs.push({
      key,
      title,
      company,
      location: decode(job.locations ?? '').trim(),
      salaryText,
      salaryMonthly,
      date: Number.isFinite(time) ? new Date(time).toISOString() : null,
      snippet,
      url: job.url,
      remote,
      flags: [],
      matched,
      score,
    })
  }
  yield { type: 'progress', step: 'filter', count: jobs.length }

  // Controllo anti-truffa
  let suspicious = 0
  for (const job of jobs) {
    job.flags = scamFlags(job, filters.country)
    if (job.flags.length) suspicious++
  }
  yield { type: 'progress', step: 'check', count: suspicious }
  const visible = filters.hideSuspicious ? jobs.filter((job) => job.flags.length === 0) : jobs

  // Ordinamento: gli annunci senza nessuna parola cercata nel titolo vanno in fondo
  visible.sort((a, b) => {
    if (filters.sort === 'date') return (b.date ?? '').localeCompare(a.date ?? '')
    if (filters.sort === 'salary') return (b.salaryMonthly ?? -1) - (a.salaryMonthly ?? -1)
    return b.score - a.score
  })
  yield { type: 'progress', step: 'rank', count: visible.length }

  const stats: JobStats = {
    fetched: raw.length,
    unique: seen.size,
    filteredOut,
    suspicious,
    shown: Math.min(visible.length, 300),
  }
  yield { type: 'result', jobs: visible.slice(0, 300), stats }
}
