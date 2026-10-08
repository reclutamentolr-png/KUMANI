'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BadgeCheck, CreditCard, Hourglass, LoaderCircle, Unlink } from 'lucide-react'
import { disconnectStripe, refreshStripeAccount, startStripeOnboarding, type SellerPaymentStatus } from '@/app/actions/shop'
import { askConfirm } from '@/lib/confirm'

// Scheda attività → Pagamenti online (KUMANI Shop): il venditore collega il
// SUO conto Stripe; i clienti pagano i preventivi direttamente a lui.
export default function SellerPaymentsCard({ initial, returning }: { initial: SellerPaymentStatus; returning: boolean }) {
  const t = useTranslations('shopSeller')
  const [status, setStatus] = useState(initial)
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ritorno dalla procedura di Stripe: stato aggiornato subito
  useEffect(() => {
    if (!returning) return
    refreshStripeAccount().then((r) => {
      if (r.success) setStatus(r.data)
    })
  }, [returning])

  const connect = async () => {
    setBusy(true)
    setError(null)
    const r = await startStripeOnboarding(status.connected || terms)
    if (r.success) {
      window.location.href = r.data.url
      return
    }
    setBusy(false)
    setError(t.has(`error_${r.message}`) ? t(`error_${r.message}`) : t('error_stripeError'))
  }
  const disconnect = async () => {
    if (!(await askConfirm(t('disconnectConfirm'), { tone: 'warning' }))) return
    const r = await disconnectStripe()
    if (r.success) setStatus({ ...status, connected: false, chargesEnabled: false, detailsSubmitted: false })
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--ink)] text-[var(--gold-bright)]">
          <CreditCard className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-[var(--ink)]">{t('title')}</h2>
          <p className="text-sm text-[var(--muted)]">{t('intro')}</p>
        </div>
      </div>

      {status.chargesEnabled ? (
        <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-semibold text-emerald-800">
          <BadgeCheck className="h-5 w-5 shrink-0" /> {t('statusReady')}
        </p>
      ) : status.connected ? (
        <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800">
          <Hourglass className="h-5 w-5 shrink-0" /> {status.detailsSubmitted ? t('statusReview') : t('statusIncomplete')}
        </p>
      ) : null}

      {!status.profileReady && <p className="rounded-xl bg-[var(--paper)] px-3 py-2 text-sm text-[var(--ink)]">{t('profileNeeded')}</p>}

      {!status.connected && (
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--ink)]" />
          <span>{t('termsLabel')}</span>
        </label>
      )}
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {!status.chargesEnabled && (
          <button
            type="button"
            onClick={connect}
            disabled={busy || !status.profileReady || (!status.connected && !terms)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] shadow-sm disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {status.connected ? t('continueButton') : t('connectButton')}
          </button>
        )}
        {status.connected && (
          <button type="button" onClick={disconnect} className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            <Unlink className="h-4 w-4" /> {t('disconnectButton')}
          </button>
        )}
      </div>
      <p className="text-xs text-[var(--muted)]">{t('footnote')}</p>
    </section>
  )
}
