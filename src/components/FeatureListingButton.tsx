'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Sparkles, LoaderCircle } from 'lucide-react'
import { featureListingAction } from '@/app/actions/listings'
import { featureListingWithKu } from '@/app/actions/ku'

export default function FeatureListingButton({
  listingId,
  cost7d,
  cost15d,
  kuCosts,
}: {
  listingId: string
  cost7d: number
  cost15d: number
  // Vetrina pagabile anche in KU Karma (Gestione KU → 1): null se non attiva.
  kuCosts?: { cost7d: number; cost15d: number } | null
}) {
  const t = useTranslations('marketplace')
  const locale = useLocale()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loadingDuration, setLoadingDuration] = useState<7 | 15 | 'ku7' | 'ku15' | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleFeature = async (duration: 7 | 15) => {
    setLoadingDuration(duration)
    setMessage(null)
    const result = await featureListingAction(listingId, duration)
    setLoadingDuration(null)

    if (!result.success) {
      const key =
        result.message === 'insufficient_points'
          ? 'featureErrorInsufficientPoints'
          : 'featureErrorGeneric'
      setMessage({ type: 'error', text: t(key) })
      return
    }

    setMessage({
      type: 'success',
      text: t('featureSuccess', { date: new Date(result.featuredUntil).toLocaleDateString(locale) }),
    })
    setOpen(false)
    router.refresh()
  }

  const handleFeatureKu = async (duration: 7 | 15) => {
    setLoadingDuration(duration === 7 ? 'ku7' : 'ku15')
    setMessage(null)
    const result = await featureListingWithKu(listingId, duration)
    setLoadingDuration(null)
    if (!result.success || !result.featuredUntil) {
      setMessage({
        type: 'error',
        text: t(result.reason === 'insufficient_points' ? 'featureErrorInsufficientKu' : 'featureErrorGeneric'),
      })
      return
    }
    setMessage({ type: 'success', text: t('featureSuccess', { date: new Date(result.featuredUntil).toLocaleDateString(locale) }) })
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-amber-600 hover:text-amber-800 text-xs font-bold flex items-center gap-1"
      >
        <Sparkles className="w-3 h-3" /> {t('putInShowcase')}
      </button>
    )
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900 mb-2">{t('chooseShowcaseDuration')}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleFeature(7)}
          disabled={loadingDuration !== null}
          className="flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 disabled:opacity-50"
        >
          {loadingDuration === 7 && <LoaderCircle className="w-3 h-3 animate-spin" />}
          {t('showcaseDays', { days: 7 })} · {cost7d} {t('networkPointsShort')}
        </button>
        <button
          type="button"
          onClick={() => handleFeature(15)}
          disabled={loadingDuration !== null}
          className="flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 disabled:opacity-50"
        >
          {loadingDuration === 15 && <LoaderCircle className="w-3 h-3 animate-spin" />}
          {t('showcaseDays', { days: 15 })} · {cost15d} {t('networkPointsShort')}
        </button>
        {kuCosts && (
          <>
            <button
              type="button"
              onClick={() => handleFeatureKu(7)}
              disabled={loadingDuration !== null}
              className="flex items-center gap-1 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-[var(--ink)] text-xs font-bold px-3 py-1.5 disabled:opacity-50"
            >
              {loadingDuration === 'ku7' && <LoaderCircle className="w-3 h-3 animate-spin" />}
              {t('showcaseDays', { days: 7 })} · {kuCosts.cost7d} KU Karma
            </button>
            <button
              type="button"
              onClick={() => handleFeatureKu(15)}
              disabled={loadingDuration !== null}
              className="flex items-center gap-1 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-[var(--ink)] text-xs font-bold px-3 py-1.5 disabled:opacity-50"
            >
              {loadingDuration === 'ku15' && <LoaderCircle className="w-3 h-3 animate-spin" />}
              {t('showcaseDays', { days: 15 })} · {kuCosts.cost15d} KU Karma
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-500 hover:text-gray-700 px-2"
        >
          {t('cancel')}
        </button>
      </div>
      {message && (
        <p className={`mt-2 text-xs ${message.type === 'success' ? 'text-green-700' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
