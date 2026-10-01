'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Award, Coins, LoaderCircle, Repeat, Sparkles, Ticket } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { convertKuToNetworkPoints, redeemRenewalDiscount } from '@/app/actions/ku'
import {
  currentKuBadge,
  featureConfig,
  nextKuBadge,
  type KuBadgesConfig,
  type KuConversionConfig,
  type KuFeatureRow,
  type KuRenewalConfig,
  type KuShowcaseConfig,
  type KuUnlockRow,
} from '@/lib/ku'

export interface KuWalletData {
  features: KuFeatureRow[]
  unlocks: KuUnlockRow[]
  ownedUnlocks: string[]
  balance: number
  earnedTotal: number
  conversionUsedThisMonth: number
  renewalUsedThisYear: number
  hasStripeSubscription: boolean
}

const card = 'rounded-xl border border-[var(--gold)]/20 bg-[var(--background)] p-4'
const goldButton =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2 text-sm font-bold text-[var(--ink)] disabled:opacity-50'

// "Usa i tuoi KU Points" nel Portafoglio: mostra solo i metodi attivati
// dall'admin in Gestione KU. Se nessuno è attivo la sezione non compare.
export default function KuRewardsSection({ data }: { data: KuWalletData }) {
  const t = useTranslations('kuRewards')
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [points, setPoints] = useState(1)

  const showcase = featureConfig<KuShowcaseConfig>(data.features, 'showcase')
  const badges = featureConfig<KuBadgesConfig>(data.features, 'badges')
  const renewal = featureConfig<KuRenewalConfig>(data.features, 'renewal_discount')
  const conversion = featureConfig<KuConversionConfig>(data.features, 'conversion')

  const anyActive = [showcase, badges, renewal, conversion].some((f) => f?.enabled)
  if (!anyActive) return null

  const run = async (key: string, action: () => Promise<{ success: boolean; reason: string | null }>, okText: string) => {
    setBusy(key)
    setMessage(null)
    const result = await action()
    setBusy(null)
    setMessage(result.success ? { ok: true, text: okText } : { ok: false, text: t(`error_${result.reason ?? 'error'}`) })
    if (result.success) router.refresh()
  }

  const conversionLeft = conversion ? Math.max(0, conversion.max_points_per_month - data.conversionUsedThisMonth) : 0
  const badge = badges ? currentKuBadge(badges.levels, data.earnedTotal) : null
  const nextBadge = badges ? nextKuBadge(badges.levels, data.earnedTotal) : null
  const badgeName = (key: string) => (t.has(`badge_${key}`) ? t(`badge_${key}`) : key)

  return (
    <section className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-6 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
        <Coins className="h-5 w-5 text-[var(--gold)]" /> {t('title')}
      </h2>
      <p className="mb-4 mt-1 text-sm text-[var(--muted)]">{t('subtitle', { balance: data.balance })}</p>
      {message && (
        <p className={`mb-4 rounded-lg px-4 py-2.5 text-sm ${message.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message.text}</p>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {badges?.enabled && (
          <div className={card}>
            <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <Award className="h-4 w-4 text-[var(--gold)]" /> {t('badgesTitle')}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {badge ? t('badgeCurrent', { name: badgeName(badge.key) }) : t('badgeNone')}
            </p>
            {nextBadge && (
              <>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full bg-[var(--gold)]"
                    style={{ width: `${Math.min(100, Math.round((data.earnedTotal / nextBadge.threshold) * 100))}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {t('badgeNext', { name: badgeName(nextBadge.key), current: data.earnedTotal, target: nextBadge.threshold })}
                </p>
              </>
            )}
          </div>
        )}

        {conversion?.enabled && (
          <div className={card}>
            <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <Repeat className="h-4 w-4 text-[var(--gold)]" /> {t('conversionTitle')}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t('conversionText', { rate: conversion.ku_per_point, left: conversionLeft })}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={Math.max(1, conversionLeft)}
                value={points}
                onChange={(e) => setPoints(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="w-20 rounded-lg border border-[var(--gold)]/30 p-2 text-center"
              />
              <button
                type="button"
                disabled={busy !== null || conversionLeft === 0}
                onClick={() => run('conversion', () => convertKuToNetworkPoints(points), t('conversionDone', { points }))}
                className={goldButton}
              >
                {busy === 'conversion' && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {t('conversionButton', { cost: points * conversion.ku_per_point })}
              </button>
            </div>
          </div>
        )}

        {renewal?.enabled && (
          <div className={card}>
            <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <Ticket className="h-4 w-4 text-[var(--gold)]" /> {t('renewalTitle')}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t('renewalText', { cost: renewal.cost_ku, discount: renewal.discount_eur, max: renewal.max_per_year })}
            </p>
            {!data.hasStripeSubscription ? (
              <p className="mt-3 text-xs text-[var(--muted)]">{t('renewalNoStripe')}</p>
            ) : data.renewalUsedThisYear >= renewal.max_per_year ? (
              <p className="mt-3 text-xs text-[var(--muted)]">{t('error_limit_reached')}</p>
            ) : (
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  run('renewal', redeemRenewalDiscount, t('renewalDone', { discount: renewal.discount_eur }))
                }
                className={`${goldButton} mt-3`}
              >
                {busy === 'renewal' && <LoaderCircle className="h-4 w-4 animate-spin" />}
                {t('renewalButton', { cost: renewal.cost_ku, discount: renewal.discount_eur })}
              </button>
            )}
          </div>
        )}

        {showcase?.enabled && (
          <div className={card}>
            <p className="flex items-center gap-2 font-semibold text-[var(--ink)]">
              <Sparkles className="h-4 w-4 text-[var(--gold)]" /> {t('showcaseTitle')}
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {t('showcaseText', { cost7: showcase.cost_7d, cost15: showcase.cost_15d })}
            </p>
            <Link href="/marketplace/listings" className="mt-3 inline-block text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
              {t('showcaseCta')}
            </Link>
          </div>
        )}

      </div>
    </section>
  )
}
