'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, Search, X } from 'lucide-react'

type CategoryOption = { value: string; label: string; icon: string; count: number }

// Filtri della Bacheca: categoria da un menu a tendina e ricerca libera
// (titolo, descrizione o nome della categoria). Tutto passa dall'indirizzo
// (?category=...&q=...), così i risultati si possono anche condividere.
export default function ListingsFilters({
  categories,
  allLabel,
  category,
  query,
  labels,
}: {
  categories: CategoryOption[]
  allLabel: string
  category: string
  query: string
  labels: { category: string; search: string; searchPlaceholder: string; clear: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [text, setText] = useState(query)

  const go = (next: { category?: string; q?: string }) => {
    const params = new URLSearchParams()
    const nextCategory = next.category ?? category
    const nextQuery = (next.q ?? text).trim()
    if (nextCategory) params.set('category', nextCategory)
    if (nextQuery) params.set('q', nextQuery)
    const search = params.toString()
    router.push(search ? `${pathname}?${search}` : pathname)
  }

  const hasFilters = Boolean(category || query)

  return (
    <div className="mb-8 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,18rem)_1fr]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{labels.category}</span>
          <span className="relative block">
            <select
              value={category}
              onChange={(e) => go({ category: e.target.value })}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm font-semibold text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
            >
              <option value="">{allLabel}</option>
              {categories.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.icon} {option.label} ({option.count})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          </span>
        </label>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            go({ q: text })
          }}
          className="block"
          role="search"
        >
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{labels.search}</span>
          <span className="flex gap-2">
            <span className="relative block flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                type="search"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={80}
                placeholder={labels.searchPlaceholder}
                aria-label={labels.search}
                className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm text-[var(--ink)] placeholder:text-gray-400 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
              />
            </span>
            <button
              type="submit"
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[var(--ink)] px-4 text-sm font-semibold text-[var(--gold-bright)] transition-colors hover:bg-[var(--ink-soft)]"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">{labels.search}</span>
            </button>
          </span>
        </form>
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => {
            setText('')
            router.push(pathname)
          }}
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold)] hover:text-[var(--ink)]"
        >
          <X className="h-3.5 w-3.5" /> {labels.clear}
        </button>
      )}
    </div>
  )
}
