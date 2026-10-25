'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ArrowRight, BookOpen, Lightbulb, Mic, MicOff, Search, Sparkles, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { buildIndex, searchNeeds } from '@/lib/needSearch/engine'
import { logNeedMiss } from '@/app/actions/needSearch'

// «Scrivi cosa ti serve» in cima alla Home: la persona descrive il bisogno
// con parole sue (o a voce) e riceve i 2–3 servizi giusti, ciascuno con il
// motivo e la guida. Tutto nel browser; le richieste senza risultato vanno
// nell'Admin (solo il testo) per migliorare la ricerca.

export type NeedItem = { toolName: string; title: string; name?: string; description: string; href: string; iconName: string; guide: string | null }

type Recognition = { lang: string; interimResults: boolean; maxAlternatives: number; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }

const SPEECH_LANG: Record<string, string> = { it: 'it-IT', en: 'en-GB', fr: 'fr-FR', es: 'es-ES', pt: 'pt-PT', de: 'de-DE', ru: 'ru-RU' }

export default function NeedSearch({ items }: { items: NeedItem[] }) {
  const t = useTranslations('needSearch')
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [listening, setListening] = useState(false)
  const [canSpeak, setCanSpeak] = useState(false)
  const recognition = useRef<Recognition | null>(null)
  const logged = useRef(new Set<string>())

  // Un servizio per strumento (i servizi uniti compaiono una volta per scheda)
  const unique = useMemo(() => {
    const seen = new Set<string>()
    return items.filter((i) => (seen.has(i.toolName) ? false : (seen.add(i.toolName), true)))
  }, [items])
  const index = useMemo(() => buildIndex(unique.map((i) => ({ id: i.toolName, title: i.title, name: i.name, description: i.description })), locale), [unique, locale])
  const byId = useMemo(() => new Map(unique.map((i) => [i.toolName, i])), [unique])

  // Risultati mentre si scrive (da 3 lettere)
  const active = query.trim().length >= 3 ? query : ''
  const hits = useMemo(() => (active ? searchNeeds(index, active) : []), [index, active])

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dipende dal browser, si sa solo qui
    setCanSpeak(!!(w.SpeechRecognition || w.webkitSpeechRecognition))
    return () => recognition.current?.stop()
  }, [])

  // Nessun risultato su una richiesta confermata: va nell'elenco dello Staff (una volta)
  useEffect(() => {
    const q = submitted.trim()
    if (q.length < 3 || hits.length || q !== query.trim() || logged.current.has(q.toLowerCase())) return
    logged.current.add(q.toLowerCase())
    void logNeedMiss(q, locale)
  }, [submitted, hits.length, query, locale])

  const speak = () => {
    if (listening) return recognition.current?.stop()
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!Ctor) return
    const r = new Ctor()
    r.lang = SPEECH_LANG[locale] ?? 'it-IT'
    r.interimResults = false
    r.maxAlternatives = 1
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript ?? ''
      if (text) {
        setQuery(text)
        setSubmitted(text)
      }
    }
    r.onend = () => setListening(false)
    r.onerror = () => setListening(false)
    recognition.current = r
    setListening(true)
    r.start()
  }

  const showNone = active && !hits.length && submitted.trim() === query.trim()

  return (
    <section className="rounded-3xl border border-[var(--gold)]/30 bg-white p-4 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-5" aria-labelledby="need-search-title">
      <h2 id="need-search-title" className="flex items-center gap-2 text-lg font-extrabold text-[var(--ink)]">
        <Sparkles className="h-5 w-5 text-[var(--gold)]" /> {t('title')}
      </h2>
      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(query)
        }}
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">{t('title')}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => setSubmitted(query)}
            placeholder={listening ? t('listening') : t('placeholder')}
            maxLength={160}
            enterKeyHint="search"
            className="w-full rounded-2xl border border-[var(--gold)]/35 bg-[var(--background)] py-3 pl-10 pr-10 text-base text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--gold)]"
          />
          {query && (
            <button type="button" onClick={() => (setQuery(''), setSubmitted(''))} aria-label={t('clear')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[var(--muted)] hover:text-[var(--ink)]">
              <X className="h-4 w-4" />
            </button>
          )}
        </label>
        {canSpeak && (
          <button type="button" onClick={speak} aria-label={listening ? t('stopListening') : t('speak')} aria-pressed={listening} className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${listening ? 'animate-pulse border-red-300 bg-red-50 text-red-700' : 'border-[var(--gold)]/35 bg-white text-[var(--ink)] hover:border-[var(--gold)]'}`}>
            {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}
      </form>

      {hits.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('resultsTitle')}</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-3">
            {hits.map((h) => {
              const item = byId.get(h.id)
              if (!item) return null
              const Icon = marketplaceIconMap[item.iconName] ?? Sparkles
              return (
                <li key={h.id} className="flex flex-col rounded-2xl border border-[var(--gold)]/25 bg-[var(--background)] p-3">
                  <Link href={item.href} className="flex items-start gap-3 text-[var(--ink)]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold leading-tight">{item.title}</span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-[var(--muted)]">{item.description}</span>
                    </span>
                  </Link>
                  {h.reason && <p className="mt-2 text-xs text-[var(--ink)]/70">{t('because', { words: h.reason })}</p>}
                  <div className="mt-auto flex flex-wrap items-center gap-3 pt-2 text-sm font-semibold">
                    <Link href={item.href} className="inline-flex items-center gap-1 text-[var(--gold)] hover:text-[var(--ink)]">
                      {t('open')} <ArrowRight className="h-4 w-4" />
                    </Link>
                    {item.guide && (
                      <Link href={`/guida/${item.guide}`} className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-[var(--ink)]">
                        <BookOpen className="h-4 w-4" /> {t('howTo')}
                      </Link>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {showNone && (
        <div className="mt-4 rounded-2xl bg-[var(--background)] p-3 text-sm text-[var(--ink)]">
          <p className="font-semibold">{t('none', { q: query.trim() })}</p>
          <p className="mt-1 text-[var(--muted)]">{t('noneHint')}</p>
          <div className="mt-2 flex flex-wrap gap-3 font-semibold">
            <Link href="/servizi" className="inline-flex items-center gap-1 text-[var(--gold)] hover:text-[var(--ink)]">
              {t('allServices')} <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/community/proposte/nuova" className="inline-flex items-center gap-1 text-[var(--muted)] hover:text-[var(--ink)]">
              <Lightbulb className="h-4 w-4" /> {t('suggest')}
            </Link>
          </div>
        </div>
      )}
    </section>
  )
}
