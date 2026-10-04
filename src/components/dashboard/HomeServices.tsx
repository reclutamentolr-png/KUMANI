'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, Clock, Lightbulb, Plus, Star } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { ServiceCard, serviceHref } from '@/components/services/ServicesBrowser'
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

  // Suggerimento: un servizio già aperto all'utente, né preferito né usato di
  // recente; cambia ogni giorno
  const candidates = recent === null ? [] : items.filter((item) => item.open && !favorites.includes(item.toolName) && !recent.includes(item.toolName))
  const suggestion = browser && candidates.length > 0 ? candidates[browser.day % candidates.length] : null

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

      {suggestion && (
        <Link
          href={serviceHref(suggestion)}
          className="group flex items-center gap-4 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] p-4 transition-colors hover:border-[var(--gold)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-white">
            <Lightbulb className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('suggestionTitle')}</span>
            <span className="block font-bold text-[var(--ink)]">{suggestion.title}</span>
            <span className="line-clamp-2 block text-sm text-[var(--ink)]/75">{suggestion.description}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--ink)] px-3 py-1.5 text-xs font-bold text-white">
            {t('suggestionCta')} <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      )}
    </div>
  )
}
