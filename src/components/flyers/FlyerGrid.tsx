'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, Search, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'

// Elenco dei volantini con ricerca per nome del servizio (o area)
type Item = { tool: string; title: string; category: string }

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export default function FlyerGrid({ items }: { items: Item[] }) {
  const t = useTranslations('flyers')
  const [q, setQ] = useState('')
  const query = norm(q.trim())
  const shown = query ? items.filter((i) => norm(`${i.title} ${i.category} ${i.tool}`).includes(query)) : items

  return (
    <>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('searchPlaceholder')}
          aria-label={t('searchPlaceholder')}
          className="w-full rounded-2xl border border-[var(--gold)]/40 bg-white py-3 pl-10 pr-10 text-sm text-[var(--ink)] shadow-sm outline-none focus:border-[var(--gold)]"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--ink)]" aria-label="✕">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {shown.length === 0 && <p className="mt-4 text-sm text-[var(--muted)]">{t('noResults')}</p>}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {shown.map((f) => (
          <Link
            key={f.tool}
            href={`/documenti/volantino/${f.tool}`}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/30 bg-white px-4 py-3 shadow-sm transition hover:border-[var(--gold)]"
          >
            <span className="min-w-0">
              <span className="block truncate font-bold text-[var(--ink)]">{f.title}</span>
              <span className="block truncate text-xs text-[var(--muted)]">{f.category}</span>
            </span>
            <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--gold)]">
              {t('preview')} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </div>
    </>
  )
}
