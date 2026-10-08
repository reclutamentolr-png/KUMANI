'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { createListingAction } from '@/app/actions/listings'
import { LISTING_COST, type ListingCategory, CATEGORY_ICONS, CATEGORY_I18N_KEYS, ALL_LISTING_CATEGORIES } from '@/lib/listings'
import { X, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ListingLocationFields, { type ListingLocationValue } from '@/components/listings/ListingLocationFields'
import CancelButton, { cancelButtonClass } from '@/components/ui/CancelButton'
import { limitTextOf } from '@/lib/limitText'

type Props = {
  userId: string
  currentPoints: number
  onCloseUrl: string
  networkPoints: number
  featureCost7d: number
  featureCost15d: number
  // Nazione proposta (quella del profilo) e città già usate, per i suggerimenti
  defaultCountry: string
  citiesByCountry: Record<string, string[]>
}

export default function ListingForm({ userId, currentPoints, onCloseUrl, networkPoints, featureCost7d, featureCost15d, defaultCountry, citiesByCountry }: Props) {
  const t = useTranslations('marketplace')
  const commonT = useTranslations('common')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [featuredUntil, setFeaturedUntil] = useState<string | null>(null)
  const [featureError, setFeatureError] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'servizi' as ListingCategory,
    price: '',
    imageUrl: '',
  })
  const [location, setLocation] = useState<ListingLocationValue>({ countryCode: defaultCountry, city: '', isRemote: false })
  const [showcaseDuration, setShowcaseDuration] = useState<7 | 15 | null>(null)

  const canPublish = currentPoints >= LISTING_COST
  const showcaseCost = showcaseDuration === 7 ? featureCost7d : showcaseDuration === 15 ? featureCost15d : 0
  const canAffordShowcase = showcaseDuration === null || networkPoints >= showcaseCost

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!canPublish) {
      setError(`${t('notEnoughPointsDesc', { current: currentPoints, cost: LISTING_COST })} ${t('dailyAccess')}`)
      setLoading(false)
      return
    }

    const result = await createListingAction({
      userId,
      title: formData.title,
      description: formData.description,
      category: formData.category,
      price: formData.price ? parseFloat(formData.price) : undefined,
      imageUrl: formData.imageUrl || undefined,
      countryCode: location.countryCode,
      city: location.city || undefined,
      isRemote: location.isRemote,
      featureDurationDays: showcaseDuration || undefined
    })

    if (result.success) {
      setSuccess(true)
      if ('featured' in result) {
        setFeaturedUntil(result.featured && 'listing' in result ? ((result.listing as { featured_until?: string | null }).featured_until ?? null) : null)
        setFeatureError(!result.featured)
      }
    } else {
      setError(limitTextOf(result) ?? result.message ?? t('publishError'))
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 mb-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-green-900 mb-2">{t('publishSuccess')}</h3>
        <p className="text-green-700 mb-2">
          {t('pointsDeducted', { cost: LISTING_COST, remaining: currentPoints - LISTING_COST })}
        </p>
        {featuredUntil && (
          <p className="text-amber-700 mb-2 flex items-center justify-center gap-1">
            <Sparkles className="w-4 h-4" /> {t('createdAndFeatured', { date: new Date(featuredUntil).toLocaleDateString(locale) })}
          </p>
        )}
        {featureError && (
          <p className="text-orange-700 mb-2">{t('createdFeatureFailed')}</p>
        )}
        <Link href={onCloseUrl} className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold mt-2">
          {t('backToMarketplace')}
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-lg p-6 mb-8">
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-xl font-bold text-gray-900">{t('publishYourListing')}</h2>
        <Link href={onCloseUrl} className="text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </Link>
      </div>
      <p className="text-xs text-gray-500 mb-6">{t('listingValidityNotice')}</p>

      {!canPublish && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-900">{t('notEnoughPoints')}</p>
            <p className="text-sm text-orange-700">{t('notEnoughPointsDesc', { current: currentPoints, cost: LISTING_COST })} {t('dailyAccess')}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('listingTitle')} *</label>
          <input type="text" required maxLength={100} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)]" placeholder={t('listingTitlePlaceholder')} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('listingCategory')} *</label>
          <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value as ListingCategory })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)]">
            {ALL_LISTING_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {t(CATEGORY_I18N_KEYS[cat])}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('listingDescription')} *</label>
          <textarea required maxLength={1000} rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)]" placeholder={t('listingDescPlaceholder')} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('listingPrice')}</label>
            <input type="number" min="0" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)]" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('listingImageUrl')}</label>
            <input type="url" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)]" placeholder={t('listingImageUrlPlaceholder')} />
          </div>
        </div>

        <ListingLocationFields value={location} onChange={setLocation} citiesByCountry={citiesByCountry} />

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900 mb-1 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> {t('showcaseOptional')}
          </p>
          <p className="text-xs text-amber-700 mb-2">{t('showcaseAtCreationHint')}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowcaseDuration(null)}
              className={`rounded-lg text-xs font-bold px-3 py-1.5 border ${showcaseDuration === null ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200'}`}
            >
              {t('showcaseNone')}
            </button>
            <button
              type="button"
              onClick={() => setShowcaseDuration(7)}
              className={`rounded-lg text-xs font-bold px-3 py-1.5 border ${showcaseDuration === 7 ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200'}`}
            >
              {t('showcaseDays', { days: 7 })} · {featureCost7d} {t('networkPointsShort')}
            </button>
            <button
              type="button"
              onClick={() => setShowcaseDuration(15)}
              className={`rounded-lg text-xs font-bold px-3 py-1.5 border ${showcaseDuration === 15 ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-amber-700 border-amber-200'}`}
            >
              {t('showcaseDays', { days: 15 })} · {featureCost15d} {t('networkPointsShort')}
            </button>
          </div>
          {!canAffordShowcase && (
            <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {t('featureErrorInsufficientPoints')}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600">{t('cost')}: <strong className="text-yellow-600">{LISTING_COST} {commonT('points')}</strong> ({t('remaining')}: <strong>{currentPoints - LISTING_COST}</strong> {commonT('points')})</p>
          <div className="flex shrink-0 items-center gap-2">
            <CancelButton className={cancelButtonClass} href={onCloseUrl} />
            <button type="submit" disabled={loading || !canPublish || !canAffordShowcase} className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">
              {loading ? t('publishing') : t('publish')}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
