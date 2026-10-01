'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { ArrowRight, HeartHandshake, LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { donateNetworkPoints } from '@/app/actions/donations'
import { euroFormat, type DonationSummary, type MyDonations } from '@/lib/donationTypes'

// Portafoglio → Donazioni: l'associazione sostenuta, la donazione dei propri
// Punti Community, il proprio resoconto e quello di KUMANI.
export default function WalletDonations({
  summary,
  mine,
  networkPoints,
}: {
  summary: DonationSummary
  mine: MyDonations | null
  networkPoints: number
}) {
  const t = useTranslations('donations')
  const locale = useLocale()
  const router = useRouter()
  const eur = (cents: number) => euroFormat(locale, cents)
  const active = summary.active!
  const [points, setPoints] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const value = summary.point_value_cents
  const amount = Math.max(0, Math.floor(Number(points) || 0))
  const canDonate = value > 0 && amount >= 1 && amount <= networkPoints

  const donate = async () => {
    if (!canDonate) return
    if (!confirm(t('donateConfirm', { points: amount, amount: eur(amount * value), association: active.name }))) return
    setBusy(true)
    setMessage(null)
    const result = await donateNetworkPoints(amount)
    setBusy(false)
    if (!result.success) {
      const key = result.reason === 'insufficient_points' ? 'error_insufficient' : result.reason === 'disabled' ? 'error_disabled' : 'error_generic'
      setMessage({ ok: false, text: t(key) })
      return
    }
    setPoints('')
    setMessage({ ok: true, text: t('donateDone', { amount: eur(result.amountCents), association: active.name }) })
    router.refresh()
  }

  return (
    <div className="space-y-5">
      {/* Associazione e impegno di KUMANI */}
      <div className="flex items-start gap-3 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/60 p-4">
        {active.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active.logo_url} alt="" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-1" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-white">
            <HeartHandshake className="h-6 w-6 text-[var(--gold)]" />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-bold text-[var(--ink)]">{active.name}</p>
          {active.mission && <p className="text-sm text-[var(--ink)]/80">{active.mission}</p>}
          <p className="mt-1 text-xs text-[var(--muted)]">{t('pledgeLine', { base: eur(summary.base_cents), pro: eur(summary.pro_cents), association: active.name })}</p>
        </div>
      </div>

      {/* Dona i tuoi punti */}
      {value > 0 && (
        <div>
          <p className="text-sm font-semibold text-[var(--ink)]">{t('donateTitle')}</p>
          <p className="mb-2 text-xs text-[var(--muted)]">{t('donateHint', { value: eur(value * 10) })}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="number"
              min={1}
              max={networkPoints}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder={t('donatePlaceholder')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none sm:w-40"
            />
            <button
              type="button"
              onClick={donate}
              disabled={!canDonate || busy}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <HeartHandshake className="h-4 w-4" />}
              {t('donateButton', { amount: eur(amount * value) })}
            </button>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">{t('availablePoints', { points: networkPoints })}</p>
          {message && <p className={`mt-2 text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
        </div>
      )}

      {/* Il tuo resoconto */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-sm font-semibold text-[var(--ink)]">{t('myTitle')}</p>
        {mine && mine.total_points > 0 ? (
          <>
            <p className="mt-1 text-sm text-[var(--ink)]">{t('myTotal', { points: mine.total_points, amount: eur(mine.total_cents) })}</p>
            <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
              {mine.items.slice(0, 5).map((item, i) => (
                <li key={i}>
                  {new Date(item.created_at).toLocaleDateString(locale)} · {item.points} → {eur(item.amount_cents)} · {item.association}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-[var(--muted)]">{t('myNone')}</p>
        )}
        {mine && mine.subscription_cents > 0 && <p className="mt-2 text-xs text-[var(--muted)]">{t('mySubscription', { amount: eur(mine.subscription_cents) })}</p>}
      </div>

      {/* Quanto sta donando KUMANI */}
      <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
        <div>
          <p className="text-xs text-[var(--muted)]">{t('accruedLabel')}</p>
          <p className="text-xl font-bold text-[var(--ink)]">{eur(summary.accrued_cents)}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--muted)]">{t('paidLabel')}</p>
          <p className="text-xl font-bold text-[var(--ink)]">{eur(summary.paid_cents)}</p>
        </div>
      </div>
      <Link href="/donazioni" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
        {t('learnMore')} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
