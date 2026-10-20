'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { createListingAction } from '@/app/actions/listings'
import { LISTING_COST, type ListingCategory, CATEGORY_I18N_KEYS, ALL_LISTING_CATEGORIES } from '@/lib/listings'
import ListingPhotoField from '@/components/listings/ListingPhotoField'
import ListingCategoryTiles from '@/components/listings/ListingCategoryTiles'
import { X, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react'
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
  // «Bacheca libera» (Admin): pubblicare è gratis
  freeMode?: boolean
}

export default function ListingForm({ userId, currentPoints, onCloseUrl, defaultCountry, citiesByCountry, freeMode = false }: Props) {
  const t = useTranslations('marketplace')
  const commonT = useTranslations('common')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'servizi' as ListingCategory,
    price: '',
    imageUrl: '',
  })
  const [location, setLocation] = useState<ListingLocationValue>({ countryCode: defaultCountry, region: '', city: '', isRemote: false })

  const canPublish = freeMode || currentPoints >= LISTING_COST

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
      region: location.region || undefined,
      city: location.city || undefined,
      isRemote: location.isRemote,
    })

    if (result.success) {
      setSuccess(true)
    } else {
      setError(limitTextOf(result) ?? (result.message && t.has(result.message) ? t(result.message) : t('publishError')))
    }
    setLoading(false)
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-8 mb-8 text-center">
        <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-3" />
        <h3 className="text-xl font-bold text-green-900 mb-2">{t('listingSentTitle')}</h3>
        <p className="text-green-700 mb-2">{t('listingSentText')}</p>
        {!freeMode && (
          <p className="text-green-700 mb-2">
            {t('pointsDeducted', { cost: LISTING_COST, remaining: currentPoints - LISTING_COST })}
          </p>
        )}
        <Link href={onCloseUrl} className="inline-block bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-semibold mt-2">
          {t('backToMarketplace')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mb-8 overflow-hidden rounded-3xl border-2 border-[var(--ink)]/15 bg-white shadow-[0_18px_44px_rgba(23,23,23,0.16)]">
      {/* Intestazione nera e oro */}
      <div className="bg-[var(--ink)] px-6 py-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold sm:text-2xl">{t('publishYourListing')}</h2>
            <p className="mt-1 text-sm text-white/70">{t('listingValidityNotice')}</p>
          </div>
          <Link href={onCloseUrl} aria-label={commonT('close')} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </Link>
        </div>
        {/* Gratis con la Bacheca libera; il controllo dello Staff c'è sempre */}
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-3 py-2.5 text-sm font-semibold text-[var(--gold-bright)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> {freeMode ? t('listingFreeNotice') : t('listingReviewNotice')}
        </p>
      </div>
      <div className="p-6">

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

      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--gold)]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink)] text-[11px] text-[var(--gold-bright)]">1</span> {t('listingStepWhat')}
        </p>
        <div>
          <label className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('listingTitle')} *</label>
          <input type="text" required maxLength={100} value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-2.5 text-[var(--ink)] placeholder:text-stone-400 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30" placeholder={t('listingTitlePlaceholder')} />
        </div>

        <ListingCategoryTiles
          options={ALL_LISTING_CATEGORIES.map((cat) => ({ value: cat, label: t(CATEGORY_I18N_KEYS[cat]) }))}
          value={formData.category}
          onSelect={(value) => setFormData({ ...formData, category: value as ListingCategory })}
          label={`${t('listingCategory')} *`}
        />

        <div>
          <label className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('listingDescription')} *</label>
          <textarea required maxLength={1000} rows={4} value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-2.5 text-[var(--ink)] placeholder:text-stone-400 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30" placeholder={t('listingDescPlaceholder')} />
        </div>

        <p className="flex items-center gap-2 border-t border-stone-200 pt-5 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--gold)]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink)] text-[11px] text-[var(--gold-bright)]">2</span> {t('listingStepPhoto')}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('listingPrice')}</label>
            <input type="number" min="0" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} className="w-full rounded-xl border-2 border-stone-300 bg-white px-4 py-2.5 text-[var(--ink)] placeholder:text-stone-400 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30" placeholder="0.00" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-bold text-[var(--ink)]">{t('listingPhoto')}</label>
            <ListingPhotoField value={formData.imageUrl} onChange={(url) => setFormData({ ...formData, imageUrl: url })} />
          </div>
        </div>

        <p className="flex items-center gap-2 border-t border-stone-200 pt-5 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--gold)]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink)] text-[11px] text-[var(--gold-bright)]">3</span> {t('listingWhere')}
        </p>
        <ListingLocationFields value={location} onChange={setLocation} citiesByCountry={citiesByCountry} showTitle={false} />

        <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-stone-200 pt-5">
          {freeMode ? <p className="text-sm font-semibold text-emerald-700">{t('listingFreeShort')}</p> : <p className="text-sm text-gray-600">{t('cost')}: <strong className="text-yellow-600">{LISTING_COST} {commonT('points')}</strong> ({t('remaining')}: <strong>{currentPoints - LISTING_COST}</strong> {commonT('points')})</p>}
          <div className="flex shrink-0 items-center gap-2">
            <CancelButton className={cancelButtonClass} href={onCloseUrl} />
            <button type="submit" disabled={loading || !canPublish} className="flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-6 font-extrabold text-[var(--gold-bright)] shadow-md hover:bg-[var(--ink-soft)] disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? t('publishing') : t('publish')}
            </button>
          </div>
        </div>
      </form>
      </div>
    </div>
  )
}
