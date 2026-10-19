'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Plus, Search, Smartphone, X } from 'lucide-react'
import { addFavorite, removeFavorite } from '@/app/actions/favorites'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { GROUP_STYLE } from '@/lib/serviceGroups'
import type { ServiceItem } from '@/lib/servicesCatalog'
import { shortServiceName } from '@/lib/homeView'

// «Aggiungi» della Home (vista Icone e «I tuoi servizi»): elenco dei servizi
// che la persona può usare, con la ricerca; un tocco li mette nella Home
// (preferiti, la stella) o li toglie. Chiudendo, la Home si aggiorna.
// onChange: la Home si aggiorna subito a ogni tocco (prima ancora del server)
export default function FavoritesPicker({
  items,
  favorites,
  onClose,
  onChange,
}: {
  items: ServiceItem[]
  favorites: string[]
  onClose: () => void
  onChange?: (favorites: string[]) => void
}) {
  const t = useTranslations('homeView')
  const router = useRouter()
  const [chosen, setChosen] = useState(favorites)
  const [query, setQuery] = useState('')
  const [changed, setChanged] = useState(false)

  const close = () => {
    if (changed) router.refresh()
    onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items
      .filter((item) => item.open)
      .filter((item) => !q || item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q))
      .sort((a, b) => Number(chosen.includes(b.toolName)) - Number(chosen.includes(a.toolName)) || a.title.localeCompare(b.title))
  }, [items, query, chosen])

  const toggle = async (toolName: string) => {
    const on = chosen.includes(toolName)
    // Come arrivano dal server: il più recente per primo
    const next = on ? chosen.filter((n) => n !== toolName) : [toolName, ...chosen]
    setChosen(next)
    onChange?.(next)
    setChanged(true)
    const result = on ? await removeFavorite(toolName) : await addFavorite(toolName)
    if (!result.success) {
      setChosen(chosen)
      onChange?.(chosen)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="picker-title" onClick={close}>
      <div className="flex max-h-[88vh] w-full max-w-lg flex-col rounded-t-3xl bg-white text-[var(--ink)] shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="space-y-3 border-b border-[var(--gold)]/20 p-5 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="picker-title" className="text-lg font-bold">
                {t('pickerTitle')}
              </h2>
              <p className="text-sm text-[var(--muted)]">{t('pickerHint')}</p>
            </div>
            <button type="button" onClick={close} aria-label={t('pickerDone')} className="rounded-full p-1.5 text-[var(--muted)] hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
            <label htmlFor="picker-search" className="sr-only">
              {t('search')}
            </label>
            <input
              id="picker-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search')}
              className="w-full rounded-xl border border-[var(--gold)]/30 py-2.5 pl-9 pr-3 text-sm focus:border-[var(--gold)] focus:outline-none"
            />
          </div>
        </div>
        <ul className="flex-1 space-y-1.5 overflow-y-auto p-3">
          {list.length === 0 && <li className="p-4 text-center text-sm text-[var(--muted)]">{t('noResults')}</li>}
          {list.map((item) => {
            const Icon = marketplaceIconMap[item.iconName] ?? Smartphone
            const on = chosen.includes(item.toolName)
            return (
              <li key={item.toolName}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(item.toolName)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${on ? 'border-[var(--gold)] bg-[var(--gold-pale)]/60' : 'border-transparent hover:bg-[var(--gold-pale)]/40'}`}
                >
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone ?? GROUP_STYLE[item.group].tile}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold" title={item.title}>
                      {shortServiceName(item.title)}
                    </span>
                    <span className="block truncate text-xs text-[var(--muted)]">{item.description}</span>
                  </span>
                  <span className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-bold ${on ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-white text-[var(--ink)] ring-1 ring-[var(--gold)]/40'}`}>
                    {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {on ? t('pickerAdded') : t('pickerAdd')}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="border-t border-[var(--gold)]/20 p-4 pb-[max(env(safe-area-inset-bottom),1rem)]">
          <button type="button" onClick={close} className="w-full rounded-xl bg-[var(--ink)] py-3 text-sm font-bold text-white hover:bg-[var(--ink-soft)]">
            {t('pickerDone')}
          </button>
        </div>
      </div>
    </div>
  )
}
