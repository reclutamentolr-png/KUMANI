'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { redeemCoupon } from '@/app/actions/coupons'
import CouponPdfButton from '@/components/CouponPdfButton'
import PassCodeForm from '@/components/pass/PassCodeForm'

type Coupon = {
  id: string
  code: string
  title: string
  description: string | null
  expires_at: string | null
  redeemed_at: string | null
  created_at: string
  // Coupon con un codice pass: attiva quel servizio per un anno
  pass_tool?: string | null
}

export default function WalletCouponsList({ coupons, passTitles = {} }: { coupons: Coupon[]; passTitles?: Record<string, string> }) {
  const t = useTranslations('wallet')
  const tp = useTranslations('toolPass')
  const locale = useLocale()
  const router = useRouter()
  const [redeemingCode, setRedeemingCode] = useState<string | null>(null)

  const handleRedeem = async (code: string) => {
    setRedeemingCode(code)
    const result = await redeemCoupon(code)
    setRedeemingCode(null)
    if (result.success) {
      router.refresh()
    } else {
      alert(t('couponRedeemError'))
    }
  }

  const now = new Date().getTime()

  return (
    <div className="space-y-3">
      {coupons.map((coupon) => {
        const isExpired = coupon.expires_at ? new Date(coupon.expires_at).getTime() < now : false
        const status = coupon.redeemed_at ? 'used' : isExpired ? 'expired' : 'available'
        const statusLabel =
          status === 'used' ? t('couponUsed') : status === 'expired' ? t('couponExpired') : t('couponAvailable')
        const statusClass =
          status === 'used'
            ? 'bg-gray-100 text-gray-500'
            : status === 'expired'
              ? 'bg-red-100 text-red-600'
              : 'bg-emerald-100 text-emerald-700'

        return (
          <div key={coupon.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-[var(--ink)]">
                  {coupon.pass_tool ? tp('walletCouponTitle', { service: passTitles[coupon.pass_tool] ?? coupon.pass_tool }) : coupon.title}
                </p>
                {coupon.pass_tool ? (
                  <p className="mt-0.5 text-sm text-[var(--muted)]">
                    {tp('walletCouponHint')} <span className="font-mono font-semibold text-[var(--ink)]">{coupon.code}</span>
                  </p>
                ) : (
                  coupon.description && <p className="mt-0.5 text-sm text-[var(--muted)]">{coupon.description}</p>
                )}
                {coupon.expires_at && (
                  <p className="mt-1 text-xs text-gray-400">
                    {t('couponExpiresOn', { date: new Date(coupon.expires_at).toLocaleDateString(locale) })}
                  </p>
                )}
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass}`}>
                {statusLabel}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <CouponPdfButton coupon={coupon} />
              {status === 'available' && coupon.pass_tool && <PassCodeForm initialCode={coupon.code} compact />}
              {status === 'available' && !coupon.pass_tool && (
                <button
                  onClick={() => handleRedeem(coupon.code)}
                  disabled={redeemingCode === coupon.code}
                  className="flex items-center gap-2 rounded-lg border border-[var(--gold)]/50 bg-white px-4 py-2 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)] disabled:opacity-50"
                >
                  {redeemingCode === coupon.code ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {t('couponMarkUsed')}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
