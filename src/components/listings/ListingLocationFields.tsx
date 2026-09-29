'use client'

import { useId } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Globe2, MapPin } from 'lucide-react'
import { LISTING_COUNTRIES } from '@/lib/listings'
import { countryName } from '@/lib/events'

export type ListingLocationValue = { countryCode: string; city: string; isRemote: boolean }

// Località dell'annuncio (pubblicazione e modifica): nazione, città con i
// suggerimenti delle città già usate in quella nazione, e "anche online".
export default function ListingLocationFields({
  value,
  onChange,
  citiesByCountry,
}: {
  value: ListingLocationValue
  onChange: (value: ListingLocationValue) => void
  citiesByCountry: Record<string, string[]>
}) {
  const t = useTranslations('marketplace')
  const locale = useLocale()
  const listId = useId()
  const suggestions = citiesByCountry[value.countryCode] ?? []
  const countries = [...LISTING_COUNTRIES].sort((a, b) => countryName(a, locale).localeCompare(countryName(b, locale), locale))

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
        <MapPin className="h-4 w-4 text-[var(--gold)]" /> {t('listingWhere')}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs text-gray-500">{t('listingCountry')} *</span>
          <select
            required
            value={value.countryCode}
            onChange={(e) => onChange({ ...value, countryCode: e.target.value })}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[var(--gold)]"
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
        <label className="block">
          <span className="mb-1 block text-xs text-gray-500">{t('listingCity')}</span>
          <input
            type="text"
            maxLength={80}
            list={listId}
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder={t('listingCityPlaceholder')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-[var(--gold)]"
          />
          <datalist id={listId}>
            {suggestions.map((city) => (
              <option key={city} value={city} />
            ))}
          </datalist>
        </label>
      </div>
      <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-gray-700">
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
