'use client'

import { useId, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, MapPin, Search, X } from 'lucide-react'

type CategoryOption = { value: string; label: string; icon: string; count: number }
type CountryOption = { value: string; label: string }

// Barra di ricerca della Bacheca: cosa (parole libere), categoria e dove
// (nazione + città). Tutto passa dall'indirizzo (?q=&category=&country=&city=),
// così i risultati si possono anche condividere. I menu applicano subito la
// scelta, i campi di testo con Invio o con il pulsante di ricerca.
export default function ListingsFilters({
  categories,
  countries,
  citiesByCountry,
  allCategoriesLabel,
  allCountriesLabel,
  category,
  query,
  country,
  city,
  hasFilters,
  labels,
}: {
  categories: CategoryOption[]
  countries: CountryOption[]
  citiesByCountry: Record<string, string[]>
  allCategoriesLabel: string
  allCountriesLabel: string
  category: string
  query: string
  // Codice della nazione, oppure 'all' per tutti i paesi
  country: string
  city: string
  hasFilters: boolean
  labels: { what: string; searchPlaceholder: string; category: string; where: string; cityPlaceholder: string; search: string; clear: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const cityListId = useId()
  const [text, setText] = useState(query)
  const [cityText, setCityText] = useState(city)

  const go = (next: { category?: string; country?: string; q?: string; city?: string }) => {
    const params = new URLSearchParams()
    const values = {
      q: (next.q ?? text).trim(),
      category: next.category ?? category,
      country: next.country ?? country,
      city: (next.city ?? cityText).trim(),
    }
    if (values.q) params.set('q', values.q)
    if (values.category) params.set('category', values.category)
    params.set('country', values.country || 'all')
    if (values.city) params.set('city', values.city)
    router.push(`${pathname}?${params.toString()}`)
  }

  const citySuggestions =
    country === 'all' ? [...new Set(Object.values(citiesByCountry).flat())].sort((a, b) => a.localeCompare(b)) : citiesByCountry[country] ?? []

  const field =
    'w-full rounded-full border border-gray-200 bg-white py-2.5 text-sm text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
  const label = 'mb-1.5 block text-sm font-bold text-[var(--ink)]'

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        go({})
      }}
      role="search"
      className="mb-8 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto] lg:items-end">
        {/* Cosa cerchi? */}
        <label className="block md:col-span-2 lg:col-span-1">
          <span className={label}>{labels.what}</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={80}
              placeholder={labels.searchPlaceholder}
              className={`${field} pl-10 pr-4 placeholder:text-gray-400`}
            />
          </span>
        </label>

        {/* Categoria */}
        <label className="block">
          <span className={label}>{labels.category}</span>
          <span className="relative block">
            <select value={category} onChange={(e) => go({ category: e.target.value })} className={`${field} appearance-none pl-4 pr-9`}>
              <option value="">{allCategoriesLabel}</option>
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label} ({option.count})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          </span>
        </label>

        {/* Dove: nazione */}
        <label className="block">
          <span className={label}>{labels.where}</span>
          <span className="relative block">
            <select
              value={country}
              onChange={(e) => {
                setCityText('')
                go({ country: e.target.value, city: '' })
              }}
              className={`${field} appearance-none pl-4 pr-9`}
            >
              <option value="all">{allCountriesLabel}</option>
              {countries.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          </span>
        </label>

        {/* Dove: città */}
        <label className="block">
          <span className={`${label} hidden lg:block lg:invisible`} aria-hidden="true">
            {labels.where}
          </span>
          <span className="relative block">
            <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              list={cityListId}
              value={cityText}
              onChange={(e) => setCityText(e.target.value)}
              maxLength={80}
              placeholder={labels.cityPlaceholder}
              aria-label={labels.cityPlaceholder}
              className={`${field} pl-10 pr-4 placeholder:text-gray-400`}
            />
            <datalist id={cityListId}>
              {citySuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </span>
        </label>

        <button
          type="submit"
          aria-label={labels.search}
          title={labels.search}
          className="flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-5 font-semibold text-[var(--gold-bright)] shadow-sm transition-colors hover:bg-[var(--ink-soft)] md:col-span-2 lg:col-span-1 lg:w-11 lg:px-0"
        >
          <Search className="h-5 w-5" />
          <span className="lg:hidden">{labels.search}</span>
        </button>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setText('')
            setCityText('')
            router.push(`${pathname}?country=all`)
          }}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
        >
          <X className="h-3.5 w-3.5" /> {labels.clear}
        </button>
      )}
    </form>
  )
}
