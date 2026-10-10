'use client'

import { useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  AlertTriangle,
  Bookmark,
  BookmarkCheck,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  FileUser,
  Laptop,
  LoaderCircle,
  MapPin,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Star,
  Trash2,
  Wallet,
} from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { removeJobFavorite, removeJobSearch, saveJobFavorite, saveJobSearch } from '@/app/actions/jobs'
import {
  DEFAULT_FILTERS,
  JOB_COUNTRIES,
  jobSearchCost,
  type JobCountry,
  type JobFilters,
  type JobQuota,
  type JobResult,
  type JobSearchEvent,
  type JobStats,
} from '@/lib/jobs/types'

type Tab = 'search' | 'favorites' | 'saved'
type Progress = { step: 'search' | 'dedupe' | 'filter' | 'check' | 'rank'; done?: number; total?: number; found?: number; count?: number }
type SavedSearch = { id: string; name: string; filters: JobFilters }

const STEPS: Progress['step'][] = ['search', 'dedupe', 'filter', 'check', 'rank']

// Testo della fonte: le parole tra ** ** sono quelle cercate (in grassetto)
function Snippet({ text }: { text: string }) {
  const parts = text.split('**')
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i} className="text-[var(--ink)]">{part}</strong> : <span key={i}>{part}</span>))}
    </>
  )
}

export default function JobSearch({
  defaultCountry,
  initialFavorites,
  initialSearches,
  initialQuota,
}: {
  defaultCountry: JobCountry
  initialFavorites: JobResult[]
  initialSearches: SavedSearch[]
  initialQuota: JobQuota | null
}) {
  const t = useTranslations('jobs')
  const locale = useLocale()
  const [tab, setTab] = useState<Tab>('search')
  const [filters, setFilters] = useState<JobFilters>({ ...DEFAULT_FILTERS, country: defaultCountry })
  const [advanced, setAdvanced] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [results, setResults] = useState<JobResult[] | null>(null)
  const [stats, setStats] = useState<JobStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<JobResult[]>(initialFavorites)
  const [searches, setSearches] = useState<SavedSearch[]>(initialSearches)
  const [quota, setQuota] = useState<JobQuota | null>(initialQuota)
  const quotaLeft = quota && quota.limit !== null ? Math.max(0, quota.limit - quota.used) : null
  const quotaDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : ''
  const [notice, setNotice] = useState<string | null>(null)
  const [visibleCount, setVisibleCount] = useState(30)
  const resultsRef = useRef<HTMLDivElement>(null)

  const favoriteKeys = useMemo(() => new Set(favorites.map((f) => f.key)), [favorites])
  const regionName = useMemo(() => {
    try {
      const names = new Intl.DisplayNames([locale], { type: 'region' })
      return (code: string) => names.of(code) ?? code
    } catch {
      return (code: string) => code
    }
  }, [locale])
  const currency = JOB_COUNTRIES[filters.country].currency
  const ago = (iso: string | null) => {
    if (!iso) return ''
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000)
    return days <= 0 ? t('today') : t('daysAgo', { count: days })
  }
  // "€23000 - 25000 per year" → "€23000 - 25000 / anno" nella lingua dell'utente
  const salaryLabel = (text: string) =>
    text.replace(/\s*per\s+(year|month|week|day|hour)\b/i, (_m, unit: string) => ` / ${t(`per_${unit.toLowerCase()}`)}`)
  const set = <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => setFilters((f) => ({ ...f, [key]: value }))
  const flash = (text: string) => {
    setNotice(text)
    window.setTimeout(() => setNotice(null), 2500)
  }

  const run = async (override?: JobFilters) => {
    const query = override ?? filters
    if (query.keywords.trim().length < 2) {
      setError(t('errorKeywords'))
      return
    }
    // Credito settimanale in pagine: la ricerca deve starci tutta
    const cost = jobSearchCost(query)
    if (quotaLeft === 0) {
      setError(t('error_quota', { limit: quota?.limit ?? 0, date: quotaDate(quota?.nextAt ?? null) }))
      return
    }
    if (quotaLeft !== null && cost > quotaLeft) {
      setError(t('error_quotaCost', { cost, left: quotaLeft }))
      return
    }
    setTab('search')
    setRunning(true)
    setError(null)
    setResults(null)
    setStats(null)
    setVisibleCount(30)
    setProgress({ step: 'search', done: 0, total: 1, found: 0 })
    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      })
      if (!res.body) throw new Error('no body')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let counted = false
      const handle = (line: string) => {
        if (!line.trim()) return
        const event = JSON.parse(line) as JobSearchEvent
        if (event.type === 'quota') {
          setQuota(event.quota)
          counted = true
        }
        if (event.type === 'progress') setProgress(event)
        if (event.type === 'result') {
          setResults(event.jobs)
          setStats(event.stats)
          window.setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
        }
        if (event.type === 'error') {
          if (event.code === 'quota') {
            setQuota(event.quota)
            const left = Math.max((event.quota.limit ?? 0) - event.quota.used, 0)
            setError(
              left > 0
                ? t('error_quotaCost', { cost: jobSearchCost(query), left })
                : t('error_quota', { limit: event.quota.limit ?? 0, date: quotaDate(event.quota.nextAt) })
            )
          } else {
            setError(t(`error_${event.code}`))
            // Ricerca non riuscita: il server non la conta
            if (counted) setQuota((q) => (q ? { ...q, used: Math.max(0, q.used - 1) } : q))
          }
        }
      }
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        lines.forEach(handle)
      }
      // Le risposte di errore arrivano come una sola riga senza a capo
      handle(buffer)
    } catch {
      setError(t('error_failed'))
    } finally {
      setRunning(false)
      setProgress(null)
    }
  }

  const toggleFavorite = async (job: JobResult) => {
    if (favoriteKeys.has(job.key)) {
      setFavorites((list) => list.filter((f) => f.key !== job.key))
      await removeJobFavorite(job.key)
      return
    }
    setFavorites((list) => [job, ...list])
    const saved = await saveJobFavorite(job)
    if (!saved.success) {
      setFavorites((list) => list.filter((f) => f.key !== job.key))
      flash(t(saved.message === 'favoritesLimit' ? 'favoritesLimit' : 'saveError'))
    }
  }

  const saveSearch = async () => {
    const name = window.prompt(t('saveSearchPrompt'), `${filters.keywords}${filters.location ? ` · ${filters.location}` : ''}`)
    if (!name) return
    const saved = await saveJobSearch(name, filters)
    if (!saved.success) {
      flash(t(saved.message === 'searchesLimit' ? 'searchesLimit' : 'saveError'))
      return
    }
    setSearches((list) => [{ id: saved.data.id, name, filters }, ...list])
    flash(t('searchSaved'))
  }

  const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none'
  const label = 'mb-1 block text-xs font-bold uppercase tracking-wide text-[var(--muted)]'

  const card = (job: JobResult) => {
    const fav = favoriteKeys.has(job.key)
    return (
      <li key={job.key} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold leading-snug text-[var(--ink)]">{job.title}</h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-[var(--muted)]">
              {job.company && <span className="font-semibold text-[var(--ink)]/80">{job.company}</span>}
              {job.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {job.location}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void toggleFavorite(job)}
            aria-label={fav ? t('removeFavorite') : t('addFavorite')}
            title={fav ? t('removeFavorite') : t('addFavorite')}
            className={`rounded-full p-2 transition ${fav ? 'text-[var(--gold)]' : 'text-gray-300 hover:text-[var(--gold)]'}`}
          >
            <Star className="h-5 w-5" fill={fav ? 'currentColor' : 'none'} />
          </button>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-semibold">
          {job.salaryText && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">
              <Wallet className="h-3.5 w-3.5" /> {salaryLabel(job.salaryText)}
            </span>
          )}
          {job.remote && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">
              <Laptop className="h-3.5 w-3.5" /> {t('remoteBadge')}
            </span>
          )}
          {job.date && (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
              <Clock className="h-3.5 w-3.5" /> {ago(job.date)}
            </span>
          )}
          {job.matched.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-pale)] px-2.5 py-1 text-[var(--ink)]">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--gold)]" /> {t('matches', { words: job.matched.join(', ') })}
            </span>
          )}
        </div>

        {job.snippet && (
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            <Snippet text={job.snippet} />…
          </p>
        )}

        {job.flags.length > 0 && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            <p className="flex items-center gap-1.5 font-bold">
              <ShieldAlert className="h-4 w-4" /> {t('suspiciousTitle')}
            </p>
            <ul className="mt-1 list-disc pl-5">
              {job.flags.map((flag) => (
                <li key={flag}>{t(`flag_${flag}`)}</li>
              ))}
            </ul>
          </div>
        )}

        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--ink-soft)]"
        >
          {t('openJob')} <ExternalLink className="h-4 w-4" />
        </a>
      </li>
    )
  }

  const stepIndex = progress ? STEPS.indexOf(progress.step) : -1

  return (
    <div className="space-y-6">
      {/* Schede */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['search', t('tabSearch'), Search],
            ['favorites', t('tabFavorites', { count: favorites.length }), Star],
            ['saved', t('tabSaved', { count: searches.length }), Bookmark],
          ] as const
        ).map(([key, text, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === key ? 'bg-[var(--ink)] text-white' : 'border border-[var(--gold)]/30 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]'}`}
          >
            <Icon className="h-4 w-4" /> {text}
          </button>
        ))}
      </div>

      {notice && <p className="rounded-xl bg-[var(--gold-pale)] px-4 py-2 text-sm font-semibold text-[var(--ink)]">{notice}</p>}

      {tab === 'search' && (
        <>
          {/* Filtri */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void run()
            }}
            className="rounded-3xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="job-keywords" className={label}>{t('keywordsLabel')}</label>
                <input id="job-keywords" value={filters.keywords} onChange={(e) => set('keywords', e.target.value)} placeholder={t('keywordsPlaceholder')} maxLength={80} className={field} />
              </div>
              <div>
                <label htmlFor="job-country" className={label}>{t('countryLabel')}</label>
                <select id="job-country" value={filters.country} onChange={(e) => set('country', e.target.value as JobCountry)} className={field}>
                  {(Object.keys(JOB_COUNTRIES) as JobCountry[])
                    .map((code) => [code, regionName(code)] as const)
                    .sort((a, b) => a[1].localeCompare(b[1], locale))
                    .map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <div>
                  <label htmlFor="job-location" className={label}>{t('locationLabel')}</label>
                  <input id="job-location" value={filters.location} onChange={(e) => set('location', e.target.value)} placeholder={t('locationPlaceholder')} maxLength={80} className={field} />
                </div>
                <div>
                  <label htmlFor="job-radius" className={label}>{t('radiusLabel')}</label>
                  <select id="job-radius" value={filters.radiusKm} onChange={(e) => set('radiusKm', Number(e.target.value))} className={field}>
                    {[0, 10, 25, 50, 100].map((km) => (
                      <option key={km} value={km}>{km === 0 ? t('radiusExact') : `${km} km`}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="job-contract" className={label}>{t('contractLabel')}</label>
                <select id="job-contract" value={filters.contract} onChange={(e) => set('contract', e.target.value as JobFilters['contract'])} className={field}>
                  {(['any', 'permanent', 'contract', 'temporary', 'internship'] as const).map((c) => (
                    <option key={c} value={c}>{t(`contract_${c}`)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="job-hours" className={label}>{t('hoursLabel')}</label>
                <select id="job-hours" value={filters.hours} onChange={(e) => set('hours', e.target.value as JobFilters['hours'])} className={field}>
                  {(['any', 'full', 'part'] as const).map((h) => (
                    <option key={h} value={h}>{t(`hours_${h}`)}</option>
                  ))}
                </select>
              </div>
            </div>

            <button type="button" onClick={() => setAdvanced((v) => !v)} className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
              <SlidersHorizontal className="h-4 w-4" /> {t('advanced')}
              <ChevronDown className={`h-4 w-4 transition ${advanced ? 'rotate-180' : ''}`} />
            </button>

            {advanced && (
              <div className="mt-4 grid grid-cols-1 gap-4 border-t border-gray-100 pt-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="job-synonyms" className={label}>{t('synonymsLabel')}</label>
                  <input id="job-synonyms" value={filters.synonyms} onChange={(e) => set('synonyms', e.target.value)} placeholder={t('synonymsPlaceholder')} maxLength={200} className={field} />
                  <p className="mt-1 text-xs text-[var(--muted)]">{t('synonymsHint')}</p>
                </div>
                <div>
                  <label htmlFor="job-salary" className={label}>{t('minSalaryLabel', { currency })}</label>
                  <input id="job-salary" type="number" min={0} step={100} value={filters.minSalary || ''} onChange={(e) => set('minSalary', Number(e.target.value) || 0)} placeholder="0" className={field} />
                  <label className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                    <input type="checkbox" checked={filters.includeNoSalary} onChange={(e) => set('includeNoSalary', e.target.checked)} className="accent-[var(--gold)]" />
                    {t('includeNoSalary')}
                  </label>
                </div>
                <div>
                  <label htmlFor="job-posted" className={label}>{t('postedLabel')}</label>
                  <select id="job-posted" value={filters.postedDays} onChange={(e) => set('postedDays', Number(e.target.value))} className={field}>
                    {[0, 1, 3, 7, 14, 30].map((d) => (
                      <option key={d} value={d}>{d === 0 ? t('postedAny') : t('postedDays', { count: d })}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="job-exclude" className={label}>{t('excludeLabel')}</label>
                  <input id="job-exclude" value={filters.exclude} onChange={(e) => set('exclude', e.target.value)} placeholder={t('excludePlaceholder')} maxLength={200} className={field} />
                </div>
                <div>
                  <label htmlFor="job-depth" className={label}>{t('depthLabel')}</label>
                  <select id="job-depth" value={filters.depth} onChange={(e) => set('depth', e.target.value as JobFilters['depth'])} className={field}>
                    {(['quick', 'deep', 'max'] as const).map((d) => (
                      <option key={d} value={d}>{t(`depth_${d}`)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="job-sort" className={label}>{t('sortLabel')}</label>
                  <select id="job-sort" value={filters.sort} onChange={(e) => set('sort', e.target.value as JobFilters['sort'])} className={field}>
                    {(['relevance', 'date', 'salary'] as const).map((s) => (
                      <option key={s} value={s}>{t(`sort_${s}`)}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
                  <input type="checkbox" checked={filters.remoteOnly} onChange={(e) => set('remoteOnly', e.target.checked)} className="accent-[var(--gold)]" />
                  {t('remoteOnly')}
                </label>
                <label className="flex items-center gap-2 text-sm text-[var(--ink)]">
                  <input type="checkbox" checked={filters.hideSuspicious} onChange={(e) => set('hideSuspicious', e.target.checked)} className="accent-[var(--gold)]" />
                  {t('hideSuspicious')}
                </label>
              </div>
            )}

            {error && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={running}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-extrabold text-[var(--ink)] shadow-md transition hover:brightness-105 disabled:opacity-60"
              >
                {running ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
                {running ? t('searching') : t('searchButton')}
              </button>
              {quotaLeft !== null && (
                <span className={`text-sm font-semibold ${quotaLeft === 0 ? 'text-red-700' : 'text-[var(--muted)]'}`}>
                  {quotaLeft === 0
                    ? t('quotaNone', { date: quotaDate(quota?.nextAt ?? null) })
                    : t('quotaLeft', { left: quotaLeft, limit: quota?.limit ?? 0 })}
                </span>
              )}
              {quotaLeft !== null && filters.keywords.trim().length >= 2 && (
                <span className={`w-full text-xs ${jobSearchCost(filters) > quotaLeft ? 'font-semibold text-red-700' : 'text-[var(--muted)]'}`}>
                  {t('searchCost', { cost: jobSearchCost(filters) })} {t('quotaInfo', { limit: quota?.limit ?? 0 })}
                </span>
              )}
              {!running && filters.keywords.trim().length >= 2 && (
                <button type="button" onClick={() => void saveSearch()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
                  <Bookmark className="h-4 w-4" /> {t('saveSearch')}
                </button>
              )}
            </div>
          </form>

          {/* Avanzamento */}
          {running && progress && (
            <div className="rounded-3xl border border-[var(--gold)]/30 bg-[var(--ink)] p-5 text-white shadow-lg sm:p-6" aria-live="polite">
              <p className="font-bold">{t('progressTitle')}</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] transition-all duration-500"
                  style={{ width: `${progress.step === 'search' ? Math.round(((progress.done ?? 0) / Math.max(1, progress.total ?? 1)) * 70) : 70 + stepIndex * 7}%` }}
                />
              </div>
              <ul className="mt-4 space-y-1.5 text-sm">
                {STEPS.map((step, i) => (
                  <li key={step} className={`flex items-center gap-2 ${i < stepIndex ? 'text-white/60' : i === stepIndex ? 'font-semibold text-[var(--gold-bright)]' : 'text-white/30'}`}>
                    {i < stepIndex ? <CheckCircle2 className="h-4 w-4" /> : i === stepIndex ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <span className="h-4 w-4 rounded-full border border-white/30" />}
                    {step === 'search' && i === stepIndex
                      ? t('step_search_live', { done: progress.done ?? 0, total: progress.total ?? 0, found: progress.found ?? 0 })
                      : t(`step_${step}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risultati */}
          <div ref={resultsRef}>
            {results && stats && (
              <>
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <h2 className="text-lg font-bold text-[var(--ink)]">{t('resultsTitle', { count: stats.shown })}</h2>
                  <p className="text-xs text-[var(--muted)]">{t('resultsStats', { fetched: stats.fetched, unique: stats.unique, filtered: stats.filteredOut, suspicious: stats.suspicious })}</p>
                </div>
                {results.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/50 px-4 py-6 text-center text-sm text-[var(--ink)]">{t('noResults')}</p>
                ) : (
                  <>
                    <ul className="space-y-3">{results.slice(0, visibleCount).map(card)}</ul>
                    {visibleCount < results.length && (
                      <div className="mt-4 text-center">
                        <button type="button" onClick={() => setVisibleCount((n) => n + 30)} className="rounded-xl border border-[var(--gold)]/50 bg-white px-5 py-2.5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]">
                          {t('showMore', { count: results.length - visibleCount })}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </>
      )}

      {tab === 'favorites' &&
        (favorites.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/50 px-4 py-6 text-center text-sm text-[var(--ink)]">{t('noFavorites')}</p>
        ) : (
          <ul className="space-y-3">{favorites.map(card)}</ul>
        ))}

      {tab === 'saved' &&
        (searches.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--gold)]/50 bg-[var(--gold-pale)]/50 px-4 py-6 text-center text-sm text-[var(--ink)]">{t('noSaved')}</p>
        ) : (
          <ul className="space-y-2">
            {searches.map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
                <BookmarkCheck className="h-5 w-5 shrink-0 text-[var(--gold)]" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--ink)]">{s.name}</p>
                  <p className="truncate text-xs text-[var(--muted)]">
                    {regionName(s.filters.country)}
                    {s.filters.location ? ` · ${s.filters.location}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilters({ ...DEFAULT_FILTERS, ...s.filters })
                    void run({ ...DEFAULT_FILTERS, ...s.filters })
                  }}
                  className="rounded-xl bg-[var(--ink)] px-3.5 py-2 text-sm font-bold text-white hover:bg-[var(--ink-soft)]"
                >
                  {t('runSaved')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearches((list) => list.filter((x) => x.id !== s.id))
                    void removeJobSearch(s.id)
                  }}
                  aria-label={t('deleteSaved')}
                  className="rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        ))}

      {/* CV e fonte */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/marketplace/kumani-cv" className="flex items-center gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-pale)] p-4 transition hover:border-[var(--gold)]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
            <FileUser className="h-5 w-5" />
          </span>
          <span>
            <span className="block font-bold text-[var(--ink)]">{t('cvTitle')}</span>
            <span className="block text-xs text-[var(--muted)]">{t('cvText')}</span>
          </span>
        </Link>
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('safetyNote')}</span>
        </div>
      </div>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-[var(--muted)]">
        <Briefcase className="h-3.5 w-3.5" /> {t('sourceNote')}{' '}
        <a href="https://www.careerjet.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--gold)] hover:underline">
          Careerjet
        </a>
      </p>
    </div>
  )
}
