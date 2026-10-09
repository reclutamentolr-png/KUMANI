'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Coins, LoaderCircle, Sparkles } from 'lucide-react'
import { paySurpriseWithPoints } from '@/app/actions/surprise'

// Pagare la sorpresa con i punti invece che con la carta: KU Karma oppure
// KU Points confermati. Prima si conferma, poi i punti si scalano e la
// sorpresa si attiva subito.
type Currency = 'karma' | 'ku_points'

export default function SurprisePointsPay({ giftId, costs, balances }: { giftId: string; costs: Record<Currency, number>; balances: Record<Currency, number> }) {
  const t = useTranslations('surprise')
  const locale = useLocale()
  const router = useRouter()
  const [confirm, setConfirm] = useState<Currency | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const nf = new Intl.NumberFormat(locale)
  const options = (['karma', 'ku_points'] as const).filter((c) => costs[c] > 0)
  if (!options.length) return null

  const pay = async (currency: Currency) => {
    setBusy(true)
    setError('')
    const res = await paySurpriseWithPoints(giftId, currency)
    if (res.success) {
      router.replace(`${locale === 'it' ? '' : `/${locale}`}/sorprese/${giftId}?paid=1`)
      router.refresh()
      return
    }
    setBusy(false)
    setConfirm(null)
    setError(t(res.message === 'insufficient' ? 'pointsInsufficient' : res.message === 'already_active' ? 'error_alreadyActive' : 'pointsError'))
  }

  return (
    <div className="mt-5 border-t border-gray-200 pt-5">
      <p className="flex items-center gap-2 text-sm font-bold text-[var(--ink)]">
        <Coins className="h-4 w-4 text-[var(--gold)]" /> {t('pointsTitle')}
      </p>
      <p className="mt-1 text-sm text-gray-600">{t('pointsText')}</p>
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          {error}
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {options.map((c) => {
          const enough = balances[c] >= costs[c]
          const label = t(c === 'karma' ? 'pointsKarma' : 'pointsKu', { n: nf.format(costs[c]) })
          return (
            <div key={c} className="rounded-xl border border-gray-200 p-4">
              <p className="font-bold text-[var(--ink)]">{label}</p>
              <p className={`mt-0.5 text-xs ${enough ? 'text-gray-500' : 'text-amber-700'}`}>
                {t('pointsBalance', { n: nf.format(balances[c]) })}
                {!enough && ` · ${t('pointsMissing', { n: nf.format(costs[c] - balances[c]) })}`}
              </p>
              {confirm === c ? (
                <div className="mt-3">
                  <p className="text-sm text-gray-700">{t('pointsConfirm', { what: label })}</p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => pay(c)}
                      disabled={busy}
                      className="inline-flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-3 text-sm font-bold text-white disabled:opacity-60"
                    >
                      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t('pointsYes')}
                    </button>
                    <button type="button" onClick={() => setConfirm(null)} disabled={busy} className="min-h-11 cursor-pointer rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-700">
                      {t('pointsNo')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirm(c)}
                  disabled={!enough || busy}
                  className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-xl border-2 border-[var(--gold)] px-3 text-sm font-bold text-[var(--ink)] hover:bg-[var(--gold)]/10 disabled:cursor-not-allowed disabled:border-gray-200 disabled:text-gray-400 disabled:hover:bg-transparent"
                >
                  {t('pointsPay', { what: label })}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
