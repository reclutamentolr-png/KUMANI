// Trova Lavoro: tipi condivisi tra il motore di ricerca (server) e la pagina.

// Paesi cercabili: codice paese → lingua della fonte (Careerjet) e valuta
export const JOB_COUNTRIES = {
  IT: { locale: 'it_IT', currency: 'EUR' },
  GB: { locale: 'en_GB', currency: 'GBP' },
  IE: { locale: 'en_IE', currency: 'EUR' },
  FR: { locale: 'fr_FR', currency: 'EUR' },
  BE: { locale: 'fr_BE', currency: 'EUR' },
  ES: { locale: 'es_ES', currency: 'EUR' },
  PT: { locale: 'pt_PT', currency: 'EUR' },
  BR: { locale: 'pt_BR', currency: 'BRL' },
  DE: { locale: 'de_DE', currency: 'EUR' },
  AT: { locale: 'de_AT', currency: 'EUR' },
  CH: { locale: 'de_CH', currency: 'CHF' },
  RU: { locale: 'ru_RU', currency: 'RUB' },
} as const
export type JobCountry = keyof typeof JOB_COUNTRIES
export const isJobCountry = (v: unknown): v is JobCountry => typeof v === 'string' && v in JOB_COUNTRIES

export type ContractType = 'any' | 'permanent' | 'contract' | 'temporary' | 'internship'
export type WorkHours = 'any' | 'full' | 'part'
export type Depth = 'quick' | 'deep' | 'max'
export type SortBy = 'relevance' | 'date' | 'salary'

export interface JobFilters {
  country: JobCountry
  keywords: string
  // Altri nomi dello stesso ruolo, separati da virgola (fino a 3)
  synonyms: string
  location: string
  radiusKm: number
  contract: ContractType
  hours: WorkHours
  // Stipendio minimo al mese, nella valuta del paese (0 = nessun minimo)
  minSalary: number
  includeNoSalary: boolean
  postedDays: number
  remoteOnly: boolean
  exclude: string
  hideSuspicious: boolean
  depth: Depth
  sort: SortBy
}

export const DEFAULT_FILTERS: Omit<JobFilters, 'country'> = {
  keywords: '',
  synonyms: '',
  location: '',
  radiusKm: 25,
  contract: 'any',
  hours: 'any',
  minSalary: 0,
  includeNoSalary: true,
  postedDays: 0,
  remoteOnly: false,
  exclude: '',
  hideSuspicious: false,
  depth: 'deep',
  sort: 'relevance',
}

// Pagine chieste alla fonte per ogni nome del ruolo, secondo la profondità
export const JOB_SEARCH_PAGES: Record<Depth, number> = { quick: 2, deep: 5, max: 10 }

// Nomi cercati: il ruolo principale più gli altri nomi indicati (al massimo 4)
export const jobSearchVariants = (filters: Pick<JobFilters, 'keywords' | 'synonyms'>) =>
  [filters.keywords.trim(), ...filters.synonyms.split(',').map((x) => x.trim())].filter(Boolean).slice(0, 4)

// Costo massimo di una ricerca in pagine del credito settimanale (una pagina
// = una richiesta alla fonte); alla fine si paga solo quello che si è usato
export const jobSearchCost = (filters: Pick<JobFilters, 'keywords' | 'synonyms' | 'depth'>) =>
  Math.max(jobSearchVariants(filters).length, 1) * JOB_SEARCH_PAGES[filters.depth]

const pickValue = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback)
const textValue = (value: unknown, max: number) => String(value ?? '').slice(0, max).trim()
const numValue = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
}

// Filtri arrivati dal browser: solo i campi previsti, con valori ammessi
export function readJobFilters(body: Record<string, unknown>): JobFilters | null {
  if (!isJobCountry(body.country)) return null
  const keywords = textValue(body.keywords, 80)
  if (keywords.length < 2) return null
  return {
    country: body.country,
    keywords,
    synonyms: textValue(body.synonyms, 200),
    location: textValue(body.location, 80),
    radiusKm: numValue(body.radiusKm, 0, 200, DEFAULT_FILTERS.radiusKm),
    contract: pickValue(body.contract, ['any', 'permanent', 'contract', 'temporary', 'internship'] as const, 'any'),
    hours: pickValue(body.hours, ['any', 'full', 'part'] as const, 'any'),
    minSalary: numValue(body.minSalary, 0, 10_000_000, 0),
    includeNoSalary: body.includeNoSalary !== false,
    postedDays: numValue(body.postedDays, 0, 60, 0),
    remoteOnly: body.remoteOnly === true,
    exclude: textValue(body.exclude, 200),
    hideSuspicious: body.hideSuspicious === true,
    depth: pickValue(body.depth, ['quick', 'deep', 'max'] as const, 'deep'),
    sort: pickValue(body.sort, ['relevance', 'date', 'salary'] as const, 'relevance'),
  }
}

// Motivi per cui un annuncio va guardato con attenzione
export type ScamFlag = 'payToApply' | 'chatOnly' | 'easyMoney' | 'unrealisticPay' | 'noCompany' | 'personalData'

export interface JobResult {
  key: string
  title: string
  company: string
  location: string
  salaryText: string
  // Stipendio stimato al mese (minimo della forbice), se ricavabile
  salaryMonthly: number | null
  date: string | null
  // Riassunto della fonte; le parti tra ** ** sono le parole cercate
  snippet: string
  url: string
  remote: boolean
  flags: ScamFlag[]
  // Perché corrisponde: parole trovate nel titolo
  matched: string[]
  score: number
}

export interface JobStats {
  fetched: number
  unique: number
  filteredOut: number
  suspicious: number
  shown: number
}

// Messaggi inviati alla pagina mentre la ricerca procede (una riga JSON ciascuno)
// Ricerche usate negli ultimi 7 giorni; limit null = nessun limite (Staff)
export type JobQuota = { used: number; limit: number | null; nextAt: string | null }

export type JobSearchEvent =
  | { type: 'quota'; quota: JobQuota }
  | { type: 'progress'; step: 'search'; done: number; total: number; found: number }
  | { type: 'progress'; step: 'dedupe' | 'filter' | 'check' | 'rank'; count: number }
  | { type: 'result'; jobs: JobResult[]; stats: JobStats }
  | { type: 'error'; code: 'unavailable' | 'invalid' | 'forbidden' | 'failed' }
  | { type: 'error'; code: 'quota'; quota: JobQuota }
