'use client'

import { LayoutGrid } from 'lucide-react'
import ListingCategoryIcon from './ListingCategoryIcon'

// Categorie della Bacheca come riquadri: icona dorata su nero e nome sotto
// (al posto del menu a tendina). In ricerca c'è anche «Tutte» e il numero
// di annunci di ogni categoria; nel modulo si sceglie la categoria.
export type CategoryTile = { value: string; label: string; count?: number }

export default function ListingCategoryTiles({
  options,
  value,
  onSelect,
  allLabel,
  label,
}: {
  options: CategoryTile[]
  value: string
  onSelect: (value: string) => void
  // Solo in ricerca: il riquadro «Tutte»
  allLabel?: string
  label: string
}) {
  const tile = (key: string, text: string, icon: React.ReactNode, count?: number) => {
    const on = value === key
    return (
      <button
        key={key || 'all'}
        type="button"
        onClick={() => onSelect(key)}
        aria-pressed={on}
        className={`group flex flex-col items-center gap-1.5 rounded-2xl border-2 px-1.5 py-3 text-center transition ${
          on ? 'border-[var(--gold)] bg-[var(--gold-pale)] shadow-sm' : 'border-transparent bg-white hover:border-[var(--gold)]/40'
        }`}
      >
        <span
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-[var(--ink)] shadow-md ring-2 transition-transform group-hover:scale-105 ${
            on ? 'ring-[var(--gold)]' : 'ring-[var(--gold)]/40'
          }`}
        >
          {icon}
        </span>
        <span className="text-[11px] font-bold leading-tight text-[var(--ink)] sm:text-xs">{text}</span>
        {count !== undefined && <span className="text-[10px] font-semibold text-[var(--muted)]">{count}</span>}
      </button>
    )
  }

  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-sm font-bold text-[var(--ink)]">{label}</p>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
        {allLabel !== undefined && tile('', allLabel, <LayoutGrid className="h-6 w-6 text-[var(--gold-bright)]" />)}
        {options.map((o) => tile(o.value, o.label, <ListingCategoryIcon category={o.value} className="h-6 w-6 text-[var(--gold-bright)]" />, o.count))}
      </div>
    </div>
  )
}
