'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, ChevronDown, Search, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'

// Elenco dei volantini raggruppati per area, in box da aprire, con ricerca
// per nome del servizio (o area): cercando, i risultati si vedono tutti
type Item = { tool: string; title: string; categoryKey: string; category: string }

const CATEGORY_ORDER = ['pro', 'marketing', 'security', 'personal', 'lavoro', 'wellness', 'svago', 'community']

const norm = (s: string) => s.toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '')

export default function FlyerGrid({ items }: { items: Item[] }) {
  const t = useTranslations('flyers')
  const [q, setQ] = useState('')
  const query = norm(q.trim())
  const shown = query ? items.filter((i) => norm(`${i.title} ${i.category} ${i.tool}`).includes(query)) : items
  const keys = [...CATEGORY_ORDER, ...items.map((i) => i.categoryKey).filter((k) => !CATEGORY_ORDER.includes(k))]
  const groups = [...new Set(keys)]
    .map((key) => ({ key, items: items.filter((i) => i.categoryKey === key) }))
    .filter((g) => g.items.length > 0)
    .map((g) => ({ ...g, label: g.items[0].category }))

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
      {query ? (
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
      ) : (
        <div className="mt-4 space-y-2">
          {groups.map((g) => (
            <details key={g.key} className="group/box rounded-2xl border border-[var(--gold)]/30 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="font-bold text-[var(--ink)]">{g.label}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                  {g.items.length}
                  <ChevronDown className="h-4 w-4 transition-transform group-open/box:rotate-180" />
                </span>
              </summary>
              <div className="grid grid-cols-1 gap-3 border-t border-[var(--gold)]/20 p-3 sm:grid-cols-2">
                {g.items.map((f) => (
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
            </details>
          ))}
        </div>
      )}
    </>
  )
}
