'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, Clock, Plus, Star } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { ServiceCard } from '@/components/services/ServicesBrowser'
import { readRecentTools } from '@/lib/recentTools'
import type { ServiceItem } from '@/lib/servicesCatalog'
import FavoritesPicker from './FavoritesPicker'

// Tutti quelli scelti (fino a questo numero), nell'ordine in cui sono stati aggiunti
const MAX_FAVORITES = 24
const MAX_RECENT = 4

// Home: i servizi preferiti (la stella) e quelli usati di recente in questo
// browser. Tutto il resto è nella pagina Servizi.
export default function HomeServices({ items, favorites }: { items: ServiceItem[]; favorites: string[] }) {
  const t = useTranslations('hub')
  // Memoria del browser: solo dopo il primo disegno
  const [recent, setRecent] = useState<string[] | null>(null)
  // «Aggiungi un servizio»: elenco per metterli nella Home con un tocco
  const [picking, setPicking] = useState(false)
  // Preferiti aggiornati subito dall'elenco; tornano a quelli del server quando cambiano
  const [favs, setFavs] = useState(favorites)
  const [serverFavs, setServerFavs] = useState(favorites)
  if (serverFavs !== favorites) {
    setServerFavs(favorites)
    setFavs(favorites)
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(readRecentTools())
  }, [])

  const byName = new Map(items.map((item) => [item.toolName, item]))
  // favorites arriva dal più recente: si gira per avere l'ordine di aggiunta (i nuovi in fondo)
  const favoriteItems = [...favs].reverse().map((name) => byName.get(name)).filter((item): item is ServiceItem => !!item)
  const shownFavorites = favoriteItems.slice(0, MAX_FAVORITES)
  const recentItems = (recent ?? [])
    .filter((name) => !favs.includes(name))
    .map((name) => byName.get(name))
    .filter((item): item is ServiceItem => !!item && item.open)
    .slice(0, MAX_RECENT)


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
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex min-h-[72px] items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[var(--gold)]/45 bg-white/60 px-4 text-sm font-bold text-[var(--ink)] transition-colors hover:border-[var(--gold)] hover:bg-[var(--gold-pale)]"
          >
            <Plus className="h-4 w-4 text-[var(--gold)]" /> {t('addService')}
          </button>
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

      {picking && <FavoritesPicker items={items} favorites={favs} onChange={setFavs} onClose={() => setPicking(false)} />}
    </div>
  )
}
