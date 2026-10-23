'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Crown, LoaderCircle, Sparkles } from 'lucide-react'
import { claimSurpriseWithPlan } from '@/app/actions/surprise'

// Attivare la sorpresa con una di quelle incluse nel piano Plus o Pro.
// «what» spiega quale si usa (regalo della festa, quota del periodo o regalo
// del rinnovo, nello stesso ordine del database). Prima si conferma.
export default function SurprisePlanClaim({ giftId, what }: { giftId: string; what: string }) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  const router = useRouter()
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const claim = async () => {
    setBusy(true)
    setError('')
    const res = await claimSurpriseWithPlan(giftId)
    if (res.success) {
      router.replace(`${locale === 'it' ? '' : `/${locale}`}/sorprese/${giftId}?paid=1`)
      router.refresh()
      return
    }
    setBusy(false)
    setConfirm(false)
    setError(
      t(
        res.message === 'none_left'
          ? 'planError_noneLeft'
          : res.message === 'no_plan'
            ? 'planError_noPlan'
            : res.message === 'already_active'
              ? 'error_alreadyActive'
              : 'planError',
      ),
    )
  }

  return (
    <div className="mb-5 rounded-xl border-2 border-emerald-300 bg-emerald-50/60 p-4">
      <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
        <Crown className="h-5 w-5 text-[var(--gold)]" /> {t('planClaimTitle')}
      </p>
      <p className="mt-1 text-sm text-gray-700">{what}</p>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {error}
        </p>
      )}
      {confirm ? (
        <div className="mt-3">
          <p className="text-sm text-gray-700">{t('planClaimConfirm')}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={claim}
              disabled={busy}
              className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t('planYes')}
            </button>
            <button type="button" onClick={() => setConfirm(false)} disabled={busy} className="min-h-11 cursor-pointer rounded-xl border border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700">
              {t('planNo')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirm(true)}
          className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"
        >
          <Sparkles className="h-4 w-4" /> {t('planClaimButton')}
        </button>
      )}
    </div>
  )
}
