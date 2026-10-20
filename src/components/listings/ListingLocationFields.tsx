'use client'

import { useId } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Globe2, MapPin } from 'lucide-react'
import { LISTING_COUNTRIES } from '@/lib/listings'
import { regionsOf } from '@/lib/listingRegions'
import { countryName } from '@/lib/events'

export type ListingLocationValue = { countryCode: string; region: string; city: string; isRemote: boolean }

// Località dell'annuncio (pubblicazione e modifica): nazione, città con i
// suggerimenti delle città già usate in quella nazione, e "anche online".
export default function ListingLocationFields({
  value,
  onChange,
  citiesByCountry,
  showTitle = true,
}: {
  value: ListingLocationValue
  onChange: (value: ListingLocationValue) => void
  citiesByCountry: Record<string, string[]>
  // Il modulo di pubblicazione ha già il titolo della sezione
  showTitle?: boolean
}) {
  const t = useTranslations('marketplace')
  const locale = useLocale()
  const listId = useId()
  const suggestions = citiesByCountry[value.countryCode] ?? []
  const regions = regionsOf(value.countryCode)
  const countries = [...LISTING_COUNTRIES].sort((a, b) => countryName(a, locale).localeCompare(countryName(b, locale), locale))

  return (
    <div>
      {showTitle && (
        <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[var(--ink)]">
          <MapPin className="h-4 w-4 text-[var(--gold)]" /> {t('listingWhere')}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('listingCountry')} *</span>
          <select
            required
            value={value.countryCode}
            onChange={(e) => onChange({ ...value, countryCode: e.target.value, region: '' })}
            className="w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-2.5 text-[var(--ink)] placeholder:text-stone-400 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
          >
            <option value="" disabled>
              {t('listingCountry')}
            </option>
            {countries.map((code) => (
              <option key={code} value={code}>
                {countryName(code, locale)}
              </option>
            ))}
          </select>
        </label>
        {/* Regione: elenco per i paesi principali, libera per gli altri */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('listingRegion')}</span>
          {regions.length ? (
            <select
              value={value.region}
              onChange={(e) => onChange({ ...value, region: e.target.value })}
              className="w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-2.5 text-[var(--ink)] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
            >
              <option value="">{t('listingRegionChoose')}</option>
              {regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              maxLength={60}
              value={value.region}
              onChange={(e) => onChange({ ...value, region: e.target.value })}
              placeholder={t('listingRegionPlaceholder')}
              className="w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-2.5 text-[var(--ink)] placeholder:text-stone-400 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
            />
          )}
        </label>
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('listingCity')}</span>
          <input
            type="text"
            maxLength={80}
            list={listId}
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder={t('listingCityPlaceholder')}
            className="w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-2.5 text-[var(--ink)] placeholder:text-stone-400 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
          />
          <datalist id={listId}>
            {suggestions.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm font-medium text-[var(--ink)]">
        <input
          type="checkbox"
          checked={value.isRemote}
          onChange={(e) => onChange({ ...value, isRemote: e.target.checked })}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-[var(--gold)]"
        />
        <span>
          <span className="flex items-center gap-1 font-medium">
            <Globe2 className="h-4 w-4 text-[var(--gold)]" /> {t('listingRemote')}
          </span>
          <span className="block text-xs text-gray-500">{t('listingRemoteHint')}</span>
        </span>
      </label>
    </div>
  )
}
