'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LoaderCircle, Ticket } from 'lucide-react'
import { redeemRenewalDiscount } from '@/app/actions/ku'
import type { KuRenewalConfig } from '@/lib/ku'

// Portafoglio → Sconto sul rinnovo (Gestione KU → 4): quanti KU Karma
// mancano allo sconto e, raggiunto il costo, il pulsante per usarlo.
export default function WalletRenewalDiscount({
  config,
  balance,
  usedThisYear,
  hasStripeSubscription,
}: {
  config: KuRenewalConfig
  balance: number
  usedThisYear: number
  hasStripeSubscription: boolean
}) {
  const t = useTranslations('kuRewards')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const missing = Math.max(0, config.cost_ku - balance)
  const progress = config.cost_ku > 0 ? Math.min(100, Math.round((balance / config.cost_ku) * 100)) : 100
  const limitReached = usedThisYear >= config.max_per_year

  const redeem = async () => {
    setBusy(true)
    setMessage(null)
    const result = await redeemRenewalDiscount()
    setBusy(false)
    setMessage(
      result.success
        ? { ok: true, text: t('renewalDone', { discount: config.discount_eur }) }
        : { ok: false, text: t(`error_${result.reason ?? 'error'}`) }
    )
    if (result.success) router.refresh()
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        {t('renewalText', { cost: config.cost_ku, discount: config.discount_eur, max: config.max_per_year })}
      </p>

      {!hasStripeSubscription ? (
        <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-[var(--muted)]">{t('renewalNoStripe')}</p>
      ) : limitReached ? (
        <p className="rounded-lg bg-gray-50 px-3 py-2.5 text-sm text-[var(--muted)]">{t('error_limit_reached')}</p>
      ) : (
        <>
          <div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[var(--gold)]/15">
              <div className="h-full rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)]" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-[var(--muted)]">{t('renewalProgress', { balance, cost: config.cost_ku })}</p>
          </div>
          {missing > 0 ? (
            <p className="flex items-center gap-2 rounded-lg border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-3 py-2.5 text-sm font-semibold text-[var(--ink)]">
              <Ticket className="h-4 w-4 shrink-0 text-[var(--gold)]" />
              {t('renewalMissing', { missing, discount: config.discount_eur })}
            </p>
          ) : (
            <button
              type="button"
              disabled={busy}
              onClick={redeem}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] disabled:opacity-50"
            >
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {t('renewalButton', { cost: config.cost_ku, discount: config.discount_eur })}
            </button>
          )}
        </>
      )}

      {message && <p className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>}
    </div>
  )
}
