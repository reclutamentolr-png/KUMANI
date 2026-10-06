'use client'

import { useEffect, useState } from 'react'
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
    // canvas-confetti caricato solo quando si apre il modale
    import('canvas-confetti')
      .then(({ default: confetti }) => {
        const end = Date.now() + 2500
        const colors = [...star.confetti]
        const frame = () => {
          confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
          confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
          if (Date.now() < end) requestAnimationFrame(frame)
        }
        confetti({ particleCount: 90, spread: 100, origin: { y: 0.6 }, colors })
        frame()
      })
      .catch(() => {})
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
        <div className="mx-auto mb-5 flex h-28 w-28 items-center justify-center rounded-full bg-[radial-gradient(circle,rgba(231,197,106,0.28)_0%,rgba(231,197,106,0.08)_55%,transparent_72%)] [perspective:400px]">
          <svg viewBox="0 0 24 24" className="h-20 w-20 drop-shadow-[0_6px_18px_rgba(231,197,106,0.45)] motion-safe:animate-[star-spin_2.6s_linear_infinite]" aria-hidden>
            <path
              d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"
              fill={star.fill}
              stroke={star.stroke}
              strokeWidth="0.9"
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
