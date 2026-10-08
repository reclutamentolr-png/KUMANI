'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { BadgeCheck, CircleCheck, CreditCard, Info, LoaderCircle, Lock } from 'lucide-react'
import { acceptPublicQuote, startQuoteCheckout } from '@/app/actions/shop'

// Pagina pubblica del preventivo: il cliente accetta (e, se il venditore
// lo prevede, paga online il totale o l'acconto con Stripe).
export default function QuotePublicActions({
  token,
  sellerName,
  mode,
  depositPercent,
  amountDue,
  canCharge,
  expired,
  acceptedAt,
  acceptedBy,
  paymentStatus,
  paidAmount,
  paidAt,
  cancelled,
}: {
  token: string
  sellerName: string
  mode: 'none' | 'full' | 'deposit'
  depositPercent: number | null
  amountDue: number
  canCharge: boolean
  expired: boolean
  acceptedAt: string | null
  acceptedBy: string | null
  paymentStatus: string
  paidAmount: number | null
  paidAt: string | null
  cancelled: boolean
}) {
  const t = useTranslations('quotePublic')
  const locale = useLocale()
  const router = useRouter()
  const [name, setName] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const eur = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(n)
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const pay = mode !== 'none' && canCharge && amountDue > 0

  if (paymentStatus === 'paid') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <BadgeCheck className="mt-0.5 h-6 w-6 shrink-0" />
        <div>
          <p className="font-bold">{t('paidTitle')}</p>
          <p className="text-sm">{t('paidText', { amount: eur(paidAmount ?? 0), date: paidAt ? date(paidAt) : '', seller: sellerName })}</p>
          {mode === 'deposit' && <p className="mt-1 text-sm">{t('paidDepositNote')}</p>}
        </div>
      </div>
    )
  }
  if (acceptedAt && !pay) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
        <CircleCheck className="mt-0.5 h-6 w-6 shrink-0" />
        <div>
          <p className="font-bold">{t('acceptedTitle')}</p>
          <p className="text-sm">{t('acceptedText', { name: acceptedBy ?? '', date: date(acceptedAt), seller: sellerName })}</p>
        </div>
      </div>
    )
  }
  if (expired) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
        <Info className="mt-0.5 h-6 w-6 shrink-0" />
        <p className="text-sm">{t('expiredText', { seller: sellerName })}</p>
      </div>
    )
  }

  const submit = async () => {
    setError(null)
    setBusy(true)
    if (pay) {
      const result = await startQuoteCheckout(token, name)
      if (result.success) {
        window.location.href = result.data.url
        return
      }
      setBusy(false)
      setError(t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError'))
      return
    }
    const result = await acceptPublicQuote(token, name)
    setBusy(false)
    if (!result.success) return setError(t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError'))
    router.refresh()
  }

  return (
    <div className="space-y-4 rounded-2xl border border-[var(--gold)]/40 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-[var(--ink)]">{pay ? t('payTitle') : t('acceptTitle')}</h2>
      {cancelled && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('cancelledText')}</p>}
      {pay && (
        <p className="text-sm text-[var(--muted)]">
          {mode === 'deposit' ? t('payDepositText', { percent: depositPercent ?? 0, amount: eur(amountDue) }) : t('payFullText', { amount: eur(amountDue) })}
        </p>
      )}
      <div>
        <label htmlFor="qp-name" className="mb-1 block text-sm font-semibold text-[var(--ink)]">
          {t('nameLabel')}
        </label>
        <input
          id="qp-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          autoComplete="name"
          placeholder={t('namePlaceholder')}
          className="w-full rounded-xl border border-gray-300 px-3 py-2.5 focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
        />
      </div>
      <label className="flex items-start gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--ink)]" />
        <span>{t('agreeLabel', { seller: sellerName })}</span>
      </label>
      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !agree || name.trim().length < 2}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3.5 font-bold text-[var(--ink)] shadow-md disabled:opacity-50"
      >
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : pay ? <CreditCard className="h-5 w-5" /> : <CircleCheck className="h-5 w-5" />}
        {pay ? (mode === 'deposit' ? t('payDepositButton', { amount: eur(amountDue) }) : t('payFullButton', { amount: eur(amountDue) })) : t('acceptButton')}
      </button>
      <p className="flex items-start gap-1.5 text-xs text-[var(--muted)]">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {pay ? t('stripeNote', { seller: sellerName }) : t('acceptNote', { seller: sellerName })}
      </p>
    </div>
  )
}
