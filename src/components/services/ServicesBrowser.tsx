'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, BookOpen, Lock, Search, Smartphone, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import FavoriteStarButton from '@/components/FavoriteStarButton'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { GROUP_STYLE, SERVICE_GROUPS } from '@/lib/serviceGroups'
import type { ServiceItem } from '@/lib/servicesCatalog'

type Filter = 'all' | 'mine' | 'locked'

// Dove porta una scheda: dentro il servizio se si può usare, altrimenti dove
// si sblocca (Pass del singolo servizio, Pro o Base)
export function serviceHref(item: ServiceItem) {
  if (item.open) return `${item.href}?from=dashboard`
  if (item.unlock === 'pass') return `/pass/${item.toolName}`
  if (item.unlock === 'pro') return `/pro?tool=${item.toolName}`
  return '/billing'
}

// Ricerca senza accenti e maiuscole ("verifica" trova "Verifica IBAN")
const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

export default function ServicesBrowser({ items, favorites: initialFavorites }: { items: ServiceItem[]; favorites: string[] }) {
  const t = useTranslations('hub')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [favorites, setFavorites] = useState(initialFavorites)

  const counts = {
    all: items.length,
    mine: items.filter((item) => item.open).length,
    locked: items.filter((item) => !item.open).length,
  }

  const groups = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean)
    const shown = items.filter((item) => {
      if (filter === 'mine' && !item.open) return false
      if (filter === 'locked' && item.open) return false
      const text = normalize(`${item.title} ${item.description} ${t(`group_${item.group}`)}`)
      return words.every((word) => text.includes(word))
    })
    // Nei gruppi prima i servizi che si possono già usare
    return SERVICE_GROUPS.map((group) => ({
      group,
      items: shown.filter((item) => item.group === group).sort((a, b) => Number(b.open) - Number(a.open)),
    })).filter(({ items }) => items.length > 0)
  }, [items, query, filter, t])

  const onToggle = (toolName: string, isFavorite: boolean) =>
    setFavorites((list) => (isFavorite ? [toolName, ...list.filter((name) => name !== toolName)] : list.filter((name) => name !== toolName)))

  return (
    <div>
      {/* Ricerca */}
      <label className="relative block">
        <span className="sr-only">{t('searchPlaceholder')}</span>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-full rounded-2xl border border-[var(--gold)]/35 bg-white py-3.5 pl-12 pr-11 text-base text-[var(--ink)] shadow-sm outline-none placeholder:text-[var(--muted)] focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/25"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery('')}
            aria-label={t('clearSearch')}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--gold-pale)] hover:text-[var(--ink)]"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </label>

      {/* Filtri */}
      <div role="tablist" aria-label={t('filtersLabel')} className="mt-3 flex gap-2 overflow-x-auto pb-1">
        {(['all', 'mine', 'locked'] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              filter === key ? 'bg-[var(--ink)] text-white' : 'border border-[var(--gold)]/35 bg-white text-[var(--ink)] hover:border-[var(--gold)]'
            }`}
          >
            {t(`filter_${key}`)} <span className={filter === key ? 'text-[var(--gold-bright)]' : 'text-[var(--muted)]'}>{counts[key]}</span>
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white px-5 py-8 text-center text-sm text-[var(--muted)]">{t('noResults')}</p>
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map(({ group, items }) => (
            <section key={group} aria-labelledby={`group-${group}`}>
              <h2 id={`group-${group}`} className="mb-3 flex items-center gap-2 text-lg font-extrabold text-[var(--ink)]">
                <span className={`h-2.5 w-2.5 rounded-full ${GROUP_STYLE[group].dot}`} />
                {t(`group_${group}`)}
                <span className="text-sm font-semibold text-[var(--muted)]">{items.length}</span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <ServiceCard key={item.toolName} item={item} isFavorite={favorites.includes(item.toolName)} onToggle={onToggle} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export function ServiceCard({
  item,
  isFavorite,
  onToggle,
  compact = false,
}: {
  item: ServiceItem
  isFavorite: boolean
  onToggle?: (toolName: string, isFavorite: boolean) => void
  // Home: solo icona, nome e Apri/lucchetto, senza descrizione né stella
  compact?: boolean
}) {
  const t = useTranslations('hub')
  const Icon = marketplaceIconMap[item.iconName] || Smartphone
  const style = GROUP_STYLE[item.group]

  return (
    <div className={`relative ${item.open ? '' : 'opacity-[0.86]'}`}>
      <Link
        href={serviceHref(item)}
        className={`group flex h-full gap-3 rounded-2xl border bg-white p-3.5 shadow-[0_6px_18px_rgba(23,23,23,0.06)] transition-all hover:-translate-y-0.5 hover:shadow-md ${
          item.open ? 'border-[var(--gold)]/30 hover:border-[var(--gold)]' : 'border-dashed border-[var(--ink)]/20 bg-[#fbfaf7] hover:border-[var(--gold)]'
        } ${compact ? 'items-center' : 'items-start'}`}
      >
        <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.open ? style.tile : 'bg-[#efede8] text-[var(--muted)]'}`}>
          <Icon className="h-5 w-5" strokeWidth={1.8} />
          {!item.open && (
            <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[var(--ink)] text-white">
              <Lock className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
          )}
        </span>
        <span className={`flex min-w-0 flex-1 flex-col ${compact ? '' : 'pr-7'}`}>
          <span className="truncate font-bold text-[var(--ink)]">{item.title}</span>
          {!compact && <span className="mt-0.5 line-clamp-2 text-xs leading-5 text-[var(--muted)]">{item.description}</span>}
          {!compact && (
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.open ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--ink)] px-2.5 py-1 text-[11px] font-bold text-white">
                  {t('open')} <ArrowRight className="h-3 w-3" />
                </span>
              ) : (
                <>
                  <span className="rounded-full bg-[var(--gold-pale)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink)]">
                    {item.plan === 'pro' ? t('includedPro') : t('includedBase')}
                  </span>
                  {item.passPrice && <span className="text-[11px] font-semibold text-[var(--muted)]">{t('orPass', { price: item.passPrice })}</span>}
                </>
              )}
            </span>
          )}
        </span>
        {compact && (item.open ? <ArrowRight className="h-4 w-4 shrink-0 text-[var(--gold)]" /> : null)}
      </Link>
      {!compact && (
        <>
          <FavoriteStarButton toolName={item.toolName} initialIsFavorite={isFavorite} variant="light" onToggle={onToggle} />
          {item.guide && (
            <Link
              href={`/guida/${item.guide}?from=${encodeURIComponent(item.href)}`}
              aria-label={t('guideFor', { name: item.title })}
              title={t('guideFor', { name: item.title })}
              className="absolute bottom-3 right-3 flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--gold-pale)] hover:text-[var(--ink)]"
            >
              <BookOpen className="h-4 w-4" />
            </Link>
          )}
        </>
      )}
    </div>
  )
}
