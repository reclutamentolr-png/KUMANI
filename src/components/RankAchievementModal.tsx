'use client'

import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { useTranslations } from 'next-intl'
import { Gift, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { markRankSeen } from '@/app/actions/ranks'

// Colore della stella e dei coriandoli per ogni qualifica
const STAR = {
  green: { fill: '#22c55e', stroke: '#15803d', confetti: ['#22c55e', '#86efac', '#e7c56a', '#ffffff'] },
  gold: { fill: '#e7c56a', stroke: '#a37b26', confetti: ['#e7c56a', '#c79a3b', '#fff3c4', '#ffffff'] },
  black: { fill: '#111111', stroke: '#e7c56a', confetti: ['#111111', '#e7c56a', '#6b6b6b', '#ffffff'] },
} as const

type Props = {
  rankKey: string
  labelKey: string
  color: keyof typeof STAR
  // Voucher Base ricevuti in premio (già nel Wallet)
  vouchers: number
  // Dopo Kuman Black: 1 voucher ogni N nuove attivazioni
  blackPlusEvery?: number
}

// Festeggiamento della qualifica raggiunta (una volta sola): coriandoli,
// stella del colore della qualifica che gira su se stessa e il premio in
// voucher che il database ha già messo nel Wallet.
export default function RankAchievementModal({ rankKey, labelKey, color, vouchers, blackPlusEvery = 6 }: Props) {
  const t = useTranslations('dashboard')
  const [visible, setVisible] = useState(true)
  const star = STAR[color]

  useEffect(() => {
    const end = Date.now() + 2500
    const colors = [...star.confetti]
    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    confetti({ particleCount: 90, spread: 100, origin: { y: 0.6 }, colors })
    frame()
  }, [star])

  const close = () => {
    setVisible(false)
    markRankSeen(rankKey)
  }

  if (!visible) return null
  const rank = t(labelKey).toUpperCase()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('qualificationCongrats', { rank })}
        className="relative w-full max-w-sm rounded-2xl border border-[var(--gold)]/45 bg-[var(--ink)] p-8 text-center text-white shadow-[0_25px_60px_rgba(0,0,0,0.4)]"
      >
        <button onClick={close} aria-label={t('qualificationAchievedClose')} className="absolute right-4 top-4 text-stone-400 transition-colors hover:text-white">
          <X className="h-5 w-5" />
        </button>

        {/* Stella che gira su se stessa */}
        <div className="mx-auto mb-5 h-24 w-24 [perspective:400px]">
          <svg viewBox="0 0 24 24" className="h-24 w-24 drop-shadow-[0_6px_18px_rgba(231,197,106,0.45)] motion-safe:animate-[star-spin_2.6s_linear_infinite]" aria-hidden>
            <path
              d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
              fill={star.fill}
              stroke={star.stroke}
              strokeWidth="1.1"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="mb-1 text-xs font-bold uppercase tracking-[0.28em] text-[var(--gold)]">{t('qualificationAchievedBadge')}</p>
        <h2 className="mb-3 text-xl font-bold leading-snug text-white">{t('qualificationCongrats', { rank })}</h2>

        {vouchers > 0 && (
          <div className="mt-4 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-4 text-left">
            <p className="flex items-center gap-2 font-semibold text-[var(--gold-bright)]">
              <Gift className="h-5 w-5 shrink-0" /> {t('qualificationVouchers', { count: vouchers })}
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-300">{t('qualificationVouchersHint')}</p>
            {color === 'black' && <p className="mt-2 text-sm leading-6 text-stone-300">{t('qualificationBlackExtra', { every: blackPlusEvery })}</p>}
          </div>
        )}

        <Link
          href="/wallet#voucher"
          onClick={close}
          className="mt-6 flex w-full items-center justify-center rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--gold-bright)]"
        >
          {t('qualificationOpenWallet')}
        </Link>
        <button onClick={close} className="mt-3 text-sm text-stone-400 hover:text-white">
          {t('qualificationAchievedClose')}
        </button>
      </div>
    </div>
  )
}
