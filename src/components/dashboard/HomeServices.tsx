'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, Clock, Plus, Star } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { ServiceCard } from '@/components/services/ServicesBrowser'
import SuggestionCarousel from './SuggestionCarousel'
import { readRecentTools } from '@/lib/recentTools'
import type { ServiceItem } from '@/lib/servicesCatalog'

const MAX_FAVORITES = 8
const MAX_RECENT = 4

// Home: i servizi preferiti (la stella), quelli usati di recente in questo
// browser e un suggerimento tra i servizi che può già usare ma non ha mai
// aperto. Tutto il resto è nella pagina Servizi.
export default function HomeServices({ items, favorites }: { items: ServiceItem[]; favorites: string[] }) {
  const t = useTranslations('hub')
  // Memoria del browser e giorno di oggi: solo dopo il primo disegno
  const [browser, setBrowser] = useState<{ recent: string[]; day: number } | null>(null)
  const recent = browser?.recent ?? null

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowser({ recent: readRecentTools(), day: Math.floor(Date.now() / 86_400_000) })
  }, [])

  const byName = new Map(items.map((item) => [item.toolName, item]))
  const favoriteItems = favorites.map((name) => byName.get(name)).filter((item): item is ServiceItem => !!item)
  const shownFavorites = favoriteItems.slice(0, MAX_FAVORITES)
  const recentItems = (recent ?? [])
    .filter((name) => !favorites.includes(name))
    .map((name) => byName.get(name))
    .filter((item): item is ServiceItem => !!item && item.open)
    .slice(0, MAX_RECENT)

  // Suggerimenti a rotazione: servizi già aperti all'utente, né preferiti né
  // usati di recente
  const candidates = recent === null ? [] : items.filter((item) => item.open && !favorites.includes(item.toolName) && !recent.includes(item.toolName))

  return (
    <div className="space-y-6">
      <section data-tour="my-services" aria-labelledby="home-my-services">
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="home-my-services" className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <Star className="h-5 w-5 text-[var(--gold)]" fill="currentColor" /> {t('yourServices')}
          </h2>
          <Link href="/servizi" className="flex shrink-0 items-center gap-1 text-sm font-bold text-[var(--gold)] hover:text-[var(--ink)]">
            {t('allServices')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {shownFavorites.length === 0 && <p className="mb-3 text-sm text-[var(--muted)]">{t('yourServicesEmpty')}</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {shownFavorites.map((item) => (
            <ServiceCard key={item.toolName} item={item} isFavorite compact />
          ))}
          <Link
            href="/servizi"
            className="flex min-h-[72px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--gold)]/45 bg-white/60 px-4 text-sm font-bold text-[var(--ink)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold-pale)]"
          >
            <Plus className="h-4 w-4 text-[var(--gold)]" /> {t('addService')}
          </Link>
        </div>
        {favoriteItems.length > MAX_FAVORITES && (
          <Link href="/marketplace/preferiti?from=dashboard" className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-[var(--gold)] hover:text-[var(--ink)]">
            {t('allFavorites', { count: favoriteItems.length })} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </section>

      {recentItems.length > 0 && (
        <section aria-labelledby="home-recent">
          <h2 id="home-recent" className="mb-3 flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
            <Clock className="h-5 w-5 text-[var(--muted)]" /> {t('recentTitle')}
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {recentItems.map((item) => (
              <ServiceCard key={item.toolName} item={item} isFavorite={false} compact />
            ))}
          </div>
        </section>
      )}

      {browser && candidates.length > 0 && <SuggestionCarousel items={candidates} day={browser.day} />}
    </div>
  )
}
