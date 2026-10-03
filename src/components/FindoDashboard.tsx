'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { Search, PlusCircle, PackageSearch, Star, MapPin } from 'lucide-react'
import FindoItemCard from '@/components/FindoItemCard'

type Item = {
  id: string
  name: string
  category: string | null
  tags: string[]
  is_favorite: boolean
  photo_url: string | null
  location_breadcrumb: string
}

export default function FindoDashboard({ items }: { items: Item[] }) {
  const t = useTranslations('findo')
  const [search, setSearch] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter((item) => (favoritesOnly ? item.is_favorite : true))
      .filter((item) => {
        if (!q) return true
        return (
          item.name.toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q) ||
          item.tags.some((tag) => tag.toLowerCase().includes(q)) ||
          item.location_breadcrumb.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [items, search, favoritesOnly])

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--gold)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="w-full pl-9 pr-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
            />
          </div>
          <button
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border-2 transition-all ${
              favoritesOnly ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)]'
            }`}
          >
            <Star className={`w-4 h-4 ${favoritesOnly ? 'fill-[var(--gold)] text-[var(--gold)]' : 'text-[var(--gold)]'}`} />
            {t('favoritesOnly')}
          </button>
          <Link
            href="/marketplace/findo/locations"
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border-2 border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:border-[var(--gold)] hover:bg-[var(--gold-pale)] transition-all"
          >
            <MapPin className="w-4 h-4 text-[var(--gold)]" />
            {t('manageLocations')}
          </Link>
        </div>

        {filteredItems.length > 0 ? (
          <div className="space-y-3">
            {filteredItems.map((item) => (
              <FindoItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-xl border border-dashed border-[var(--gold)]/40 text-[var(--muted)]">
            <PackageSearch className="w-12 h-12 mx-auto mb-4 text-[var(--gold)]" />
            <p>{items.length === 0 ? t('noItemsYet') : t('noResults')}</p>
          </div>
        )}
      </div>

      <Link
        href="/marketplace/findo/new"
        data-fab className="fixed bottom-6 right-6 z-10 flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-full font-bold shadow-lg hover:brightness-105 hover:shadow-xl hover:-translate-y-0.5 transition-all"
      >
        <PlusCircle className="w-5 h-5" />
        {t('newItem')}
      </Link>
    </div>
  )
}
