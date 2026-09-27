'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CalendarPlus, Languages, MapPin, Search, Video, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import {
  EVENT_TYPES,
  EVENT_TYPE_EMOJI,
  countryName,
  formatEventDate,
  languageName,
  utcToZoned,
  type EventCard,
  type EventType,
} from '@/lib/events'
import { EventFlags, PriceBadge, SpotsBadge, TrustedBadge } from './EventBadges'
import ViewerTime from './ViewerTime'

type Range = 'all' | 'week' | 'month'

// Confronto testuale senza maiuscole né accenti ("Forlì" = "forli").
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

// Calendario pubblico: tutti i filtri lavorano sull'elenco già caricato.
export default function EventsCalendar({ events, loggedIn }: { events: EventCard[]; loggedIn: boolean }) {
  const t = useTranslations('events')
  const locale = useLocale()
  const [type, setType] = useState<EventType | null>(null)
  const [country, setCountry] = useState('')
  const [city, setCity] = useState('')
  const [language, setLanguage] = useState('')
  const [onlineOnly, setOnlineOnly] = useState(false)
  const [range, setRange] = useState<Range>('all')
  // "Adesso" fissato al primo render: serve solo ai filtri settimana/mese.
  const [nowMs] = useState(() => Date.now())

  // Solo tipi, paesi e lingue presenti davvero nel calendario.
  const presentTypes = useMemo(() => EVENT_TYPES.filter((ty) => events.some((e) => e.type === ty)), [events])
  const countries = useMemo(() => {
    const codes = Array.from(new Set(events.map((e) => e.country_code).filter((c): c is string => !!c)))
    return codes.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [events, locale])
  const languages = useMemo(() => {
    const codes = Array.from(new Set(events.flatMap((e) => e.languages ?? [])))
    return codes.map((code) => ({ code, name: languageName(code, locale) })).sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [events, locale])

  const rangeEnd = useMemo(() => {
    if (range === 'all') return null
    const now = new Date(nowMs)
    if (range === 'week') {
      // Fino a domenica compresa (settimana che inizia di lunedì).
      const toSunday = (7 - now.getDay()) % 7
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + toSunday + 1).getTime()
    }
    return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime()
  }, [range, nowMs])

  const filtered = useMemo(() => {
    const cityQuery = normalize(city)
    return events.filter((e) => {
      if (type && e.type !== type) return false
      if (country && e.country_code !== country) return false
      if (language && !(e.languages ?? []).includes(language)) return false
      if (onlineOnly && e.mode === 'in_person') return false
      if (cityQuery && !normalize(`${e.city ?? ''} ${e.venue_name ?? ''}`).includes(cityQuery)) return false
      if (rangeEnd !== null && new Date(e.starts_at).getTime() >= rangeEnd) return false
      return true
    })
  }, [events, type, country, language, onlineOnly, city, rangeEnd])

  // Raggruppati per giorno (data locale dell'evento).
  const groups = useMemo(() => {
    const map = new Map<string, EventCard[]>()
    for (const e of filtered) {
      const day = utcToZoned(e.starts_at, e.timezone).date
      map.set(day, [...(map.get(day) ?? []), e])
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  const dayHeading = (day: string) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${day}T12:00:00Z`))

  const hasFilters = !!type || !!country || !!city || !!language || onlineOnly || range !== 'all'
  const resetFilters = () => {
    setType(null)
    setCountry('')
    setCity('')
    setLanguage('')
    setOnlineOnly(false)
    setRange('all')
  }

  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
      active ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 bg-white text-[var(--ink)] hover:border-[var(--gold)]'
    }`
  const field = 'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none'

  return (
    <div>
      {/* Filtri */}
      <section className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        {presentTypes.length > 0 && (
          <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
            <button type="button" onClick={() => setType(null)} className={chip(type === null)}>
              {t('allTypes')}
            </button>
            {presentTypes.map((ty) => (
              <button key={ty} type="button" onClick={() => setType(type === ty ? null : ty)} className={chip(type === ty)}>
                <span className="mr-1">{EVENT_TYPE_EMOJI[ty]}</span>
                {t(`type_${ty}`)}
              </button>
            ))}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative block">
            <span className="sr-only">{t('filterCity')}</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('filterCityPlaceholder')} className={`${field} pl-9`} />
          </label>
          <label className="block">
            <span className="sr-only">{t('filterCountry')}</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={field}>
              <option value="">{t('allCountries')}</option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">{t('filterLanguage')}</span>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={field}>
              <option value="">{t('allLanguages')}</option>
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="sr-only">{t('filterWhen')}</span>
            <select value={range} onChange={(e) => setRange(e.target.value as Range)} className={field}>
              <option value="all">{t('rangeAll')}</option>
              <option value="week">{t('rangeWeek')}</option>
              <option value="month">{t('rangeMonth')}</option>
            </select>
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={() => setOnlineOnly(!onlineOnly)} className={`${chip(onlineOnly)} flex items-center gap-1.5`} aria-pressed={onlineOnly}>
            <Video className="h-4 w-4" /> {t('onlineOnly')}
          </button>
          {hasFilters && (
            <button type="button" onClick={resetFilters} className="flex items-center gap-1 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
              <X className="h-4 w-4" /> {t('resetFilters')}
            </button>
          )}
        </div>
      </section>

      {/* Elenco per giorno */}
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white p-8 text-center">
          <p className="text-4xl">🗓️</p>
          <h2 className="mt-3 text-lg font-bold text-[var(--ink)]">{hasFilters ? t('emptyFilteredTitle') : t('emptyTitle')}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{t('emptyText')}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {hasFilters && (
              <button type="button" onClick={resetFilters} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-[var(--ink)]">
                {t('resetFilters')}
              </button>
            )}
            <Link
              href={loggedIn ? '/events/my' : '/register'}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)]"
            >
              <CalendarPlus className="h-4 w-4" /> {t('organizeEvent')}
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <p className="text-sm text-[var(--muted)]">{t('eventsCount', { count: filtered.length })}</p>
          {groups.map(([day, dayEvents]) => (
            <section key={day}>
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[var(--gold)] first-letter:uppercase">{dayHeading(day)}</h2>
              <div className="grid gap-4 md:grid-cols-2">
                {dayEvents.map((event) => (
                  <EventListCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// Card di un evento nel calendario.
export function EventListCard({ event }: { event: EventCard }) {
  const t = useTranslations('events')
  const locale = useLocale()
  const place = event.mode === 'online' ? t('mode_online') : [event.city, countryName(event.country_code, locale)].filter(Boolean).join(', ')

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex flex-col rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]/50 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-2xl">{EVENT_TYPE_EMOJI[event.type] ?? '📅'}</div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)]">{t(`type_${event.type}`)}</p>
          <h3 className="mt-0.5 line-clamp-2 font-bold text-[var(--ink)] group-hover:text-[var(--gold)]">{event.title}</h3>
          <p className="mt-1 text-sm font-medium text-[var(--ink-soft)] first-letter:uppercase">{formatEventDate(event.starts_at, event.timezone, locale)}</p>
          <ViewerTime iso={event.starts_at} timeZone={event.timezone} className="text-xs text-[var(--muted)]" />
        </div>
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-[var(--muted)]">
        {place && (
          <p className="flex items-center gap-1.5">
            {event.mode === 'online' ? <Video className="h-4 w-4 shrink-0" /> : <MapPin className="h-4 w-4 shrink-0" />}
            <span className="truncate">{place}</span>
            {event.mode === 'hybrid' && <span className="shrink-0 text-xs font-semibold text-[var(--ink-soft)]">· {t('alsoOnline')}</span>}
          </p>
        )}
        {(event.languages ?? []).length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Languages className="h-4 w-4 shrink-0" />
            {event.languages.map((code) => (
              <span key={code} className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700">
                {languageName(code, locale)}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-3 mt-3 flex flex-wrap gap-1.5">
        <PriceBadge event={event} />
        <SpotsBadge event={event} />
        <EventFlags event={event} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3 text-xs text-[var(--muted)]">
        <span>{t('organizedBy', { name: event.organizer_name })}</span>
        {event.organizer_trusted && <TrustedBadge />}
      </div>
    </Link>
  )
}
