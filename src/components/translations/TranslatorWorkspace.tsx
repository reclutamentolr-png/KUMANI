'use client'

import { createContext, memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowUp, Check, ChevronDown, Loader2, LogOut, RotateCcw, Save, Search, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/components/Logo'
import {
  getTranslationSummary,
  loadTranslationSection,
  resetTranslation,
  saveTranslation,
  searchTranslations,
  type SaveResult,
  type SectionSummary,
  type TranslationItem,
  type TranslationStatus,
} from '@/app/actions/translations'
import {
  checkTranslation,
  LOCALE_LABELS,
  placeholdersOf,
  SECTION_LABELS,
  type TranslationCheck,
  type TranslatorLocale,
} from '@/lib/translationKeys'
import { askConfirm } from '@/lib/confirm'
import { NATIVE_NAMES, TRANSLATOR_UI, type TranslatorUi, type UiLang } from '@/components/translations/translatorUi'

// Area Traduttori: si traduce sempre partendo dall'italiano. Le istruzioni e i
// pulsanti si possono leggere in italiano o nelle lingue del traduttore
// (translatorUi.ts, senza chiavi next-intl: i testi da tradurre restano fuori).

const LOCALE_STORAGE_KEY = 'kumani.translator.locale'
const UI_STORAGE_KEY = 'kumani.translator.ui'

const UiContext = createContext<TranslatorUi>(TRANSLATOR_UI.it)
const useUi = () => useContext(UiContext)
// Sezioni da tenere sempre in cima (le più viste dai visitatori)
const PINNED_SECTIONS = ['landingHome', 'dashboard', 'common']

type Filter = 'all' | 'missing' | 'stale' | 'done' | 'base'
type View = { kind: 'overview' } | { kind: 'section'; id: string } | { kind: 'search'; query: string }

const FILTERS: Filter[] = ['all', 'missing', 'stale', 'done', 'base']

const STATUS_CLASS: Record<TranslationStatus, string> = {
  done: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  stale: 'bg-amber-50 text-amber-800 border-amber-300',
  missing: 'bg-red-50 text-red-700 border-red-200',
  base: 'bg-stone-100 text-stone-700 border-stone-300',
}

const FOCUS_RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2'

function sectionOf(key: string) {
  return key.split('.')[0]
}

function sectionLabel(id: string) {
  return SECTION_LABELS[id] ?? id
}

function listText(values: string[]) {
  return values.join(', ')
}

// Messaggio comprensibile per un controllo non superato
function checkMessage(ui: TranslatorUi, check: TranslationCheck): string | null {
  if (check.ok) return null
  switch (check.reason) {
    case 'empty':
      return ui.checks.empty
    case 'tooLong':
      return ui.checks.tooLong
    case 'syntax':
      return ui.checks.syntax
    case 'placeholders': {
      const parts: string[] = []
      const missing = check.missing ?? []
      const extra = check.extra ?? []
      if (missing.length === 1) parts.push(ui.checks.missingOne(missing[0]))
      else if (missing.length > 1) parts.push(ui.checks.missingMany(listText(missing)))
      if (extra.length === 1) parts.push(ui.checks.extraOne(extra[0]))
      else if (extra.length > 1) parts.push(ui.checks.extraMany(listText(extra)))
      return parts.join('. ') || ui.checks.mismatch
    }
  }
}

// Gli errori del server restano codici: il testo si sceglie al momento di mostrarlo
function serverErrorMessage(ui: TranslatorUi, error: string): string {
  switch (error) {
    case 'not_allowed':
    case 'not_found':
    case 'invalid':
    case 'save_failed':
      return ui.errors[error]
    default:
      return ui.errors.generic
  }
}

function formatDate(iso: string, dateLocale: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(dateLocale, { dateStyle: 'medium', timeStyle: 'short' })
}

// Righe stimate della casella (senza misurare il DOM: con ~260 testi
// misurare ogni casella rallenterebbe la pagina)
function estimateRows(text: string) {
  const rows = text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 55)), 0)
  return Math.min(Math.max(rows, 2), 18)
}

function percent(done: number, total: number) {
  return total > 0 ? Math.round((done / total) * 100) : 0
}

// ── Esci ─────────────────────────────────────────────────────────────────

export function TranslatorLogoutButton({
  variant = 'dark',
  confirmLeave,
}: {
  variant?: 'dark' | 'light'
  confirmLeave?: () => boolean | Promise<boolean>
}) {
  const ui = useUi()
  const [busy, setBusy] = useState(false)

  const logout = async () => {
    if (confirmLeave && !(await confirmLeave())) return
    setBusy(true)
    try {
      await createClient().auth.signOut({ scope: 'local' })
    } finally {
      // Ricarica completa voluta: azzera sessione e dati in memoria della pagina
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = '/login'
    }
  }

  const style =
    variant === 'dark'
      ? 'border-[var(--gold)]/40 text-[var(--gold-pale)] hover:bg-white/10'
      : 'border-[var(--ink)]/20 text-[var(--ink)] hover:bg-[var(--gold-pale)]'

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-60 ${style} ${FOCUS_RING}`}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
      {ui.logout}
    </button>
  )
}

// ── Area di lavoro ───────────────────────────────────────────────────────

type SummaryState = { locale: TranslatorLocale; sections: SectionSummary[] }

export default function TranslatorWorkspace({ name, locales }: { name: string; locales: TranslatorLocale[] }) {
  const [locale, setLocale] = useState<TranslatorLocale>(locales[0])
  const [uiLang, setUiLang] = useState<UiLang>('it')
  const ui = TRANSLATOR_UI[uiLang]
  const [summary, setSummary] = useState<SummaryState | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'overview' })
  const [items, setItems] = useState<TranslationItem[] | null>(null)
  const [itemsError, setItemsError] = useState<string | null>(null)
  const [overviewQuery, setOverviewQuery] = useState('')
  // Testi modificati e non ancora salvati (per avvisare prima di uscire)
  const dirty = useRef(new Set<string>())
  const summaryRequest = useRef(0)
  const itemsRequest = useRef(0)

  const loadSummary = useCallback(async (loc: TranslatorLocale) => {
    const id = ++summaryRequest.current
    setSummaryError(null)
    try {
      const result = await getTranslationSummary(loc)
      if (id !== summaryRequest.current) return
      if ('error' in result) setSummaryError(result.error)
      else setSummary({ locale: loc, sections: result.sections })
    } catch {
      if (id === summaryRequest.current) setSummaryError('network')
    }
  }, [])

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    } catch {
      stored = null
    }
    const initial = locales.find((l) => l === stored) ?? locales[0]
    // Lingua delle istruzioni: quella scelta l'ultima volta, altrimenti quella
    // del browser se è una delle sue lingue, altrimenti l'italiano
    let storedUi: string | null = null
    try {
      storedUi = localStorage.getItem(UI_STORAGE_KEY)
    } catch {
      storedUi = null
    }
    const options: UiLang[] = ['it', ...locales]
    const browser = typeof navigator === 'undefined' ? '' : navigator.language.slice(0, 2).toLowerCase()
    const initialUi = options.find((l) => l === storedUi) ?? options.find((l) => l === browser) ?? 'it'
    // Lingue ricordate nel browser: si leggono solo dopo il primo disegno
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(initial)
    setUiLang(initialUi)
    loadSummary(initial)
  }, [locales, loadSummary])

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current.size === 0) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  const confirmLeave = useCallback(async () => {
    if (dirty.current.size === 0) return true
    const ok = await askConfirm(ui.unsavedLeave, { title: ui.leaveTitle, confirmLabel: ui.leaveYes, cancelLabel: ui.stay, tone: 'warning' })
    if (ok) dirty.current.clear()
    return ok
  }, [ui])

  const onDirty = useCallback((key: string, isDirty: boolean) => {
    if (isDirty) dirty.current.add(key)
    else dirty.current.delete(key)
  }, [])

  // Dopo un salvataggio: aggiorna il testo e i conteggi della sezione
  const onSaved = useCallback((previous: TranslationStatus, item: TranslationItem) => {
    setItems((list) => list?.map((i) => (i.key === item.key ? item : i)) ?? list)
    setSummary((current) => {
      if (!current) return current
      const id = sectionOf(item.key)
      return {
        ...current,
        sections: current.sections.map((s) => {
          if (s.id !== id) return s
          const next = { ...s }
          const bump = (status: TranslationStatus, delta: number) => {
            if (status === 'done') next.done += delta
            else if (status === 'stale') next.stale += delta
            else if (status === 'missing') next.missing += delta
          }
          bump(previous, -1)
          bump(item.status, 1)
          return next
        }),
      }
    })
  }, [])

  const loadItems = (request: () => Promise<{ items: TranslationItem[] } | { error: string }>) => {
    const id = ++itemsRequest.current
    setItems(null)
    setItemsError(null)
    request()
      .then((result) => {
        if (id !== itemsRequest.current) return
        if ('error' in result) setItemsError(result.error)
        else setItems(result.items)
      })
      .catch(() => {
        if (id === itemsRequest.current) setItemsError('network')
      })
  }

  const openSection = async (id: string) => {
    if (!(await confirmLeave())) return
    setView({ kind: 'section', id })
    loadItems(() => loadTranslationSection(locale, id))
    window.scrollTo({ top: 0 })
  }

  const openSearch = async (query: string) => {
    const q = query.trim()
    if (q.length < 2 || !(await confirmLeave())) return
    setView({ kind: 'search', query: q })
    loadItems(() => searchTranslations(locale, q))
    window.scrollTo({ top: 0 })
  }

  const goOverview = async () => {
    if (!(await confirmLeave())) return
    itemsRequest.current++
    setView({ kind: 'overview' })
    setItems(null)
    setItemsError(null)
    // Aggiorna i numeri in silenzio (anche le modifiche di altri traduttori)
    loadSummary(locale)
    window.scrollTo({ top: 0 })
  }

  const changeLocale = async (next: TranslatorLocale) => {
    if (next === locale || !(await confirmLeave())) return
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next)
    } catch {
      // Memoria del browser non disponibile: la scelta vale solo per ora
    }
    itemsRequest.current++
    setLocale(next)
    setSummary(null)
    setView({ kind: 'overview' })
    setItems(null)
    setItemsError(null)
    loadSummary(next)
  }

  const changeUiLang = (next: UiLang) => {
    setUiLang(next)
    try {
      localStorage.setItem(UI_STORAGE_KEY, next)
    } catch {
      // Memoria del browser non disponibile: la scelta vale solo per ora
    }
  }

  const languageName = uiLang === 'it' ? LOCALE_LABELS[locale] : NATIVE_NAMES[locale]
  const uiOptions: UiLang[] = ['it', ...locales]
  const currentSummary = summary?.locale === locale ? summary : null

  return (
    <UiContext.Provider value={ui}>
      <div lang={uiLang} className="min-h-screen bg-[var(--background)] text-[var(--ink)]">
        <header className="sticky top-0 z-30 border-b border-[var(--gold)]/30 bg-[var(--ink)] text-white shadow-md">
          <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
            <Logo size={40} priority />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold-bright)]">{ui.areaTitle}</p>
              <p className="truncate text-sm text-white/80">{name}</p>
            </div>
            <TranslatorLogoutButton confirmLeave={confirmLeave} />
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-24 pt-5">
          <div className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <p id="ui-lang-label" className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {ui.uiLanguage}
            </p>
            <div role="radiogroup" aria-labelledby="ui-lang-label" className="inline-flex rounded-full border border-[var(--gold)]/40 bg-[var(--paper)] p-0.5">
              {uiOptions.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={l === uiLang}
                  lang={l}
                  onClick={() => changeUiLang(l)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition-colors ${FOCUS_RING} ${
                    l === uiLang ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'text-[var(--ink)] hover:bg-[var(--gold-pale)]'
                  }`}
                >
                  {NATIVE_NAMES[l]}
                </button>
              ))}
            </div>
          </div>

          {locales.length > 1 && (
            <div className="mb-5">
              <p id="lingua-label" className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                {ui.workLanguage}
              </p>
              <div role="radiogroup" aria-labelledby="lingua-label" className="flex flex-wrap gap-2">
                {locales.map((l) => (
                  <button
                    key={l}
                    type="button"
                    role="radio"
                    aria-checked={l === locale}
                    onClick={() => changeLocale(l)}
                    className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${FOCUS_RING} ${
                      l === locale
                        ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]'
                        : 'border-[var(--gold)]/40 bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--gold-pale)]'
                    }`}
                  >
                    {uiLang === 'it' ? LOCALE_LABELS[l] : NATIVE_NAMES[l]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {view.kind === 'overview' ? (
            <Overview
              languageName={languageName}
              summary={currentSummary}
              error={summaryError && serverErrorMessage(ui, summaryError)}
              query={overviewQuery}
              onQuery={setOverviewQuery}
              onOpenSection={openSection}
              onSearch={openSearch}
              onRetry={() => loadSummary(locale)}
            />
          ) : (
            <ItemsView
              key={view.kind === 'section' ? `s:${view.id}` : `q:${view.query}`}
              view={view}
              locale={locale}
              languageName={languageName}
              items={items}
              error={itemsError && serverErrorMessage(ui, itemsError)}
              onBack={goOverview}
              onSaved={onSaved}
              onDirty={onDirty}
            />
          )}
        </main>
      </div>
    </UiContext.Provider>
  )
}

// ── Panoramica ───────────────────────────────────────────────────────────

function HowItWorks() {
  const ui = useUi()
  return (
    <details className="group mb-5 rounded-2xl border border-[var(--gold)]/30 bg-[var(--paper)]">
      <summary
        className={`flex cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${FOCUS_RING}`}
      >
        {ui.howTitle}
        <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="list-disc space-y-1.5 px-4 pb-4 pl-9 text-sm text-[var(--muted)]">
        <li>{ui.howBase}</li>
        <li>{ui.howOnline}</li>
        <li>
          {ui.howPlaceholders[0]}
          <code className="rounded bg-[var(--gold-pale)] px-1 text-[var(--ink)]">{'{name}'}</code>
          {ui.howPlaceholders[1]}
          <code className="rounded bg-[var(--gold-pale)] px-1 text-[var(--ink)]">{'<b>'}</code>
          {ui.howPlaceholders[2]}
        </li>
        <li>{ui.howOk}</li>
        <li>{ui.howUndo}</li>
        <li>{ui.howShortcut}</li>
      </ul>
    </details>
  )
}

function ProgressBar({ value, className = 'h-2' }: { value: number; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-full bg-[var(--ink)]/10 ${className}`}>
      <div className="h-full rounded-full bg-[var(--gold)]" style={{ width: `${value}%` }} />
    </div>
  )
}

function Overview({
  languageName,
  summary,
  error,
  query,
  onQuery,
  onOpenSection,
  onSearch,
  onRetry,
}: {
  languageName: string
  summary: SummaryState | null
  error: string | null
  query: string
  onQuery: (q: string) => void
  onOpenSection: (id: string) => void
  onSearch: (q: string) => void
  onRetry: () => void
}) {
  const ui = useUi()
  const totals = useMemo(() => {
    const t = { total: 0, done: 0, stale: 0, missing: 0 }
    for (const s of summary?.sections ?? []) {
      t.total += s.total
      t.done += s.done
      t.stale += s.stale
      t.missing += s.missing
    }
    return t
  }, [summary])

  const sections = useMemo(() => {
    const list = [...(summary?.sections ?? [])]
    list.sort((a, b) => {
      const pa = PINNED_SECTIONS.indexOf(a.id)
      const pb = PINNED_SECTIONS.indexOf(b.id)
      if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb)
      const work = b.missing + b.stale - (a.missing + a.stale)
      if (work !== 0) return work
      const unchecked = b.total - b.done - (a.total - a.done)
      if (unchecked !== 0) return unchecked
      return sectionLabel(a.id).localeCompare(sectionLabel(b.id), 'it')
    })
    const q = query.trim().toLowerCase()
    return q ? list.filter((s) => sectionLabel(s.id).toLowerCase().includes(q) || s.id.toLowerCase().includes(q)) : list
  }, [summary, query])

  const trimmed = query.trim()
  const pct = percent(totals.done, totals.total)

  return (
    <div>
      <HowItWorks />

      <section
        aria-labelledby="progress-title"
        className="mb-6 rounded-2xl border border-[var(--gold)]/35 bg-[var(--ink)] p-5 text-white shadow-[0_20px_55px_rgba(23,23,23,0.14)]"
      >
        <h1 id="progress-title" className="text-sm font-semibold uppercase tracking-wide text-[var(--gold-bright)]">
          {languageName}
        </h1>
        {error && !summary ? (
          <div className="mt-3 text-sm">
            <p className="text-red-200">{error}</p>
            <button type="button" onClick={onRetry} className={`mt-2 font-semibold text-[var(--gold-bright)] underline ${FOCUS_RING}`}>
              {ui.retry}
            </button>
          </div>
        ) : !summary ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {ui.loading}
          </p>
        ) : (
          <>
            <p className="mt-1 text-3xl font-extrabold">
              {pct}% <span className="text-base font-semibold text-white/70">{ui.checkedPct}</span>
            </p>
            <ProgressBar value={pct} className="mt-3 h-2.5 bg-white/15" />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
              <div className="rounded-xl bg-white/5 p-2">
                <p className="text-lg font-bold text-red-300">{totals.missing}</p>
                <p className="text-white/70">{ui.toTranslate}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <p className="text-lg font-bold text-amber-300">{totals.stale}</p>
                <p className="text-white/70">{ui.toRecheck}</p>
              </div>
              <div className="rounded-xl bg-white/5 p-2">
                <p className="text-lg font-bold text-emerald-300">
                  {totals.done}/{totals.total}
                </p>
                <p className="text-white/70">{ui.checked}</p>
              </div>
            </div>
          </>
        )}
      </section>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          onSearch(query)
        }}
        className="mb-4"
      >
        <label htmlFor="overview-search" className="mb-1.5 block text-sm font-semibold">
          {ui.searchLabel}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-[var(--muted)]" aria-hidden />
          <input
            id="overview-search"
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={ui.searchPlaceholder}
            className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-10 pr-3 text-base shadow-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
          />
        </div>
        {trimmed.length >= 2 && (
          <button
            type="submit"
            className={`mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)] ${FOCUS_RING}`}
          >
            <Search className="h-4 w-4" aria-hidden />
            {ui.searchAll(trimmed)}
          </button>
        )}
      </form>

      {summary && (
        <>
          {sections.length === 0 ? (
            <p className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-[var(--muted)]">
              {ui.noSection}
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {sections.map((s) => {
                const p = percent(s.done, s.total)
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => onOpenSection(s.id)}
                      className={`flex h-full w-full flex-col gap-2 rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-4 text-left shadow-sm transition-colors hover:border-[var(--gold)] hover:bg-white ${FOCUS_RING}`}
                    >
                      <span className="font-bold leading-snug">{sectionLabel(s.id)}</span>
                      <ProgressBar value={p} />
                      <span className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="text-[var(--muted)]">
                          {s.done}/{s.total} {ui.checked}
                        </span>
                        {s.missing > 0 && (
                          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-semibold text-red-700">
                            {s.missing} {ui.toTranslate}
                          </span>
                        )}
                        {s.stale > 0 && (
                          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">
                            {s.stale} {ui.toRecheck}
                          </span>
                        )}
                        {s.total > 0 && s.done === s.total && (
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800">
                            {ui.allChecked}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

// ── Elenco dei testi (sezione o ricerca) ─────────────────────────────────

function ItemsView({
  view,
  locale,
  languageName,
  items,
  error,
  onBack,
  onSaved,
  onDirty,
}: {
  view: Exclude<View, { kind: 'overview' }>
  locale: TranslatorLocale
  languageName: string
  items: TranslationItem[] | null
  error: string | null
  onBack: () => void
  onSaved: (previous: TranslationStatus, item: TranslationItem) => void
  onDirty: (key: string, dirty: boolean) => void
}) {
  const ui = useUi()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, missing: 0, stale: 0, done: 0, base: 0 }
    for (const item of items ?? []) {
      c.all++
      c[item.status]++
    }
    return c
  }, [items])

  // Filtri: i testi esclusi restano montati (nascosti) così le modifiche
  // non salvate non si perdono cambiando filtro
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const set = new Set<string>()
    for (const item of items ?? []) {
      if (filter !== 'all' && item.status !== filter) continue
      if (q && !item.italian.toLowerCase().includes(q) && !item.value.toLowerCase().includes(q) && !item.key.toLowerCase().includes(q)) continue
      set.add(item.key)
    }
    return set
  }, [items, filter, query])

  const title = view.kind === 'section' ? sectionLabel(view.id) : ui.resultsFor(view.query)

  return (
    <div>
      <button
        type="button"
        onClick={onBack}
        className={`mb-3 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] ${FOCUS_RING}`}
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {ui.backAll}
      </button>

      <h1 className="text-2xl font-extrabold leading-tight">{title}</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {ui.language}: <strong className="text-[var(--ink)]">{languageName}</strong>
        {items && ` · ${ui.texts(items.length)}`}
        {view.kind === 'search' && items && items.length >= 100 && ui.first100}
      </p>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl border-l-4 border-red-400 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : !items ? (
        <p className="mt-8 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {ui.loadingTexts}
        </p>
      ) : (
        <>
          <div className="sticky top-[65px] z-20 -mx-4 mt-4 border-b border-[var(--gold)]/20 bg-[var(--background)]/95 px-4 py-3 backdrop-blur">
            <div role="group" aria-label={ui.filterGroup} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => setFilter(f)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${FOCUS_RING} ${
                    filter === f
                      ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]'
                      : 'border-[var(--gold)]/35 bg-[var(--paper)] text-[var(--ink)] hover:bg-[var(--gold-pale)]'
                  }`}
                >
                  {ui.filters[f]} <span className="opacity-70">({counts[f]})</span>
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <label htmlFor="items-search" className="sr-only">
                  {ui.searchHereLabel}
                </label>
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[var(--muted)]" aria-hidden />
                <input
                  id="items-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={ui.searchHere}
                  className="w-full rounded-xl border border-stone-300 bg-white py-2 pl-9 pr-3 text-base shadow-sm focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
                />
              </div>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                title={ui.backToTop}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-[var(--gold)]/40 bg-[var(--paper)] px-3 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)] ${FOCUS_RING}`}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
                <span className="sr-only sm:not-sr-only">{ui.backToTop}</span>
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-stone-300 p-4 text-sm text-[var(--muted)]">
              {view.kind === 'search' ? ui.noTextFound : ui.sectionEmpty}
            </p>
          ) : visible.size === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-stone-300 p-4 text-sm text-[var(--muted)]">
              {ui.noFilterMatch}
            </p>
          ) : null}

          <ol className="mt-4 space-y-4">
            {items.map((item) => (
              <ItemCard
                key={item.key}
                item={item}
                locale={locale}
                languageName={languageName}
                showSection={view.kind === 'search'}
                hidden={!visible.has(item.key)}
                onSaved={onSaved}
                onDirty={onDirty}
              />
            ))}
          </ol>
        </>
      )}
    </div>
  )
}

// ── Singolo testo ────────────────────────────────────────────────────────

type Busy = null | 'save' | 'ok' | 'reset'

const ItemCard = memo(function ItemCard({
  item,
  locale,
  languageName,
  showSection,
  hidden,
  onSaved,
  onDirty,
}: {
  item: TranslationItem
  locale: TranslatorLocale
  languageName: string
  showSection: boolean
  hidden: boolean
  onSaved: (previous: TranslationStatus, item: TranslationItem) => void
  onDirty: (key: string, dirty: boolean) => void
}) {
  const ui = useUi()
  const [draft, setDraft] = useState(item.value)
  const [busy, setBusy] = useState<Busy>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)

  const placeholders = useMemo(() => placeholdersOf(item.italian) ?? [], [item.italian])
  const check = useMemo(() => checkTranslation(item.italian, draft), [item.italian, draft])
  const problem = checkMessage(ui, check)
  const changed = draft !== item.value
  const fieldId = `t-${item.key}`
  const hintId = `${fieldId}-hint`
  const problemId = `${fieldId}-problem`

  const run = async (kind: Exclude<Busy, null>, action: () => Promise<SaveResult>, note: string) => {
    setBusy(kind)
    setServerError(null)
    setSavedNote(null)
    try {
      const result = await action()
      if (result.success) {
        setDraft(result.item.value)
        onDirty(item.key, false)
        onSaved(item.status, result.item)
        setSavedNote(note)
      } else {
        setServerError((result.check && checkMessage(ui, result.check)) || serverErrorMessage(ui, result.error))
      }
    } catch {
      setServerError(serverErrorMessage(ui, 'network'))
    } finally {
      setBusy(null)
    }
  }

  const save = () => {
    if (busy || !check.ok) return
    run('save', () => saveTranslation(locale, item.key, draft), ui.saved)
  }

  const confirmOk = () => {
    if (busy || !check.ok) return
    run('ok', () => saveTranslation(locale, item.key, item.value), ui.confirmed)
  }

  const reset = async () => {
    if (busy) return
    if (!(await askConfirm(ui.resetConfirm, { title: ui.resetTitle, confirmLabel: ui.resetBase, cancelLabel: ui.cancel, tone: 'warning' }))) return
    run('reset', () => resetTranslation(locale, item.key), ui.restored)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
    event.preventDefault()
    if (changed) save()
    else if (item.status !== 'done') confirmOk()
  }

  const describedBy = [placeholders.length ? hintId : null, problem ? problemId : null].filter(Boolean).join(' ') || undefined

  return (
    <li hidden={hidden} className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-4 shadow-sm">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[item.status]}`}>{ui.status[item.status]}</span>
        {showSection && <span className="text-xs font-semibold text-[var(--ink)]">{sectionLabel(sectionOf(item.key))}</span>}
        <code className="min-w-0 truncate text-[11px] text-[var(--muted)]">{item.key}</code>
      </div>

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{ui.italianOriginal}</p>
      <div className="whitespace-pre-wrap break-words rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800">
        {item.italian}
      </div>

      <label htmlFor={fieldId} className="mb-1 mt-3 block text-xs font-semibold uppercase tracking-wide text-[var(--ink)]">
        {languageName}
      </label>
      <textarea
        id={fieldId}
        value={draft}
        rows={estimateRows(draft)}
        onChange={(e) => {
          setDraft(e.target.value)
          setSavedNote(null)
          onDirty(item.key, e.target.value !== item.value)
        }}
        onKeyDown={onKeyDown}
        aria-invalid={!check.ok}
        aria-describedby={describedBy}
        spellCheck
        lang={locale}
        className={`block w-full resize-y rounded-xl border bg-white px-3 py-2 text-base leading-relaxed shadow-sm focus:outline-none focus:ring-2 ${
          check.ok ? 'border-stone-300 focus:border-[var(--gold)] focus:ring-[var(--gold)]' : 'border-red-400 focus:ring-red-400'
        }`}
      />

      {placeholders.length > 0 && (
        <p id={hintId} className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted)]">
          {ui.keepSame}
          {placeholders.map((p) => (
            <code key={p} className="rounded bg-[var(--gold-pale)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--ink)]">
              {p}
            </code>
          ))}
        </p>
      )}

      {problem && (
        <p id={problemId} className="mt-2 text-sm font-medium text-red-700">
          {problem}
        </p>
      )}
      {serverError && (
        <p role="alert" className="mt-2 text-sm font-medium text-red-700">
          {serverError}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {changed ? (
          <>
            <button
              type="button"
              onClick={save}
              disabled={!check.ok || busy !== null}
              className={`inline-flex items-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
              {ui.save}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(item.value)
                onDirty(item.key, false)
              }}
              disabled={busy !== null}
              className={`inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-stone-100 disabled:opacity-50 ${FOCUS_RING}`}
            >
              <X className="h-4 w-4" aria-hidden />
              {ui.cancel}
            </button>
          </>
        ) : (
          item.status !== 'done' && (
            <button
              type="button"
              onClick={confirmOk}
              disabled={!check.ok || busy !== null}
              className={`inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)] bg-[var(--gold-pale)] px-4 py-2 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold-bright)] disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
            >
              {busy === 'ok' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />}
              {ui.okAsIs}
            </button>
          )
        )}

        {(item.status === 'done' || item.status === 'stale') && (
          <button
            type="button"
            onClick={reset}
            disabled={busy !== null}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-stone-100 hover:text-[var(--ink)] disabled:opacity-50 ${FOCUS_RING}`}
          >
            {busy === 'reset' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />}
            {ui.resetBase}
          </button>
        )}

        {savedNote && (
          <span role="status" className="text-sm font-semibold text-emerald-700">
            {savedNote}
          </span>
        )}
      </div>

      {item.updatedAt && <p className="mt-2 text-xs text-[var(--muted)]">{ui.lastChange} {formatDate(item.updatedAt, ui.dateLocale)}</p>}
    </li>
  )
})
