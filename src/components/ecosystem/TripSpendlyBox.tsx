'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, LoaderCircle, PiggyBank, RefreshCw } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { syncTripToSpendly, tripSpendlyStatus, type TripSpendlyStatus } from '@/app/actions/ecosystem'

// Viaggi → Spendly: «Porta la tua parte in Spendly». Entra solo la mia quota
// delle spese divise con me; ripetendo si riallinea (importi cambiati, spese
// cancellate). Si ricarica quando cambiano le spese del viaggio.
export default function TripSpendlyBox({ tripId, expensesKey }: { tripId: string; expensesKey: string }) {
  const t = useTranslations('ecosystem')
  const locale = useLocale()
  const [state, setState] = useState<TripSpendlyStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    let alive = true
    tripSpendlyStatus(tripId).then((s) => {
      if (alive) {
        setState(s)
        setDone(false)
      }
    })
    return () => {
      alive = false
    }
  }, [tripId, expensesKey])

  if (!state || state.status === 'login' || state.status === 'not_member' || state.status === 'currency') return null
  if (state.status === 'ok' && !state.shares && !state.imported) return null

  const money = (v: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(v)
  const sync = async () => {
    setBusy(true)
    setState(await syncTripToSpendly(tripId))
    setBusy(false)
    setDone(true)
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
          <PiggyBank className="h-5 w-5" />
        </span>
        <div>
          <p className="font-bold text-[var(--ink)]">{t('tripSpendlyTitle')}</p>
          <p className="text-sm text-[var(--muted)]">
            {state.status === 'no_access'
              ? t('tripSpendlyNoAccess')
              : done
                ? t('tripSpendlyDone', { count: state.imported ?? 0, total: money(state.total ?? 0) })
                : t('tripSpendlyHint', { count: state.shares ?? 0, total: money(state.total ?? 0) })}
          </p>
        </div>
      </div>
      {state.status === 'no_access' ? (
        <Link href="/strumenti/spendly" className="inline-flex shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50">
          {t('receiptSpendlyDiscover')}
        </Link>
      ) : done ? (
        <Link
          href="/marketplace/spendly/spese-variabili"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 hover:bg-emerald-50"
        >
          <Check className="h-4 w-4" /> {t('receiptSpendlyOpen')}
        </Link>
      ) : (
        <button
          type="button"
          onClick={sync}
          disabled={busy}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : state.imported ? <RefreshCw className="h-4 w-4" /> : null}
          {state.imported ? t('tripSpendlyUpdate') : t('tripSpendlyButton')}
        </button>
      )}
    </div>
  )
}
