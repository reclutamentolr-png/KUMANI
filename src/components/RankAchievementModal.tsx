'use client'

import { useEffect, useState } from 'react'
import confetti from 'canvas-confetti'
import { useTranslations } from 'next-intl'
import { X, Star, Sparkles, Crown } from 'lucide-react'
import { markRankSeen } from '@/app/actions/ranks'

const RANK_ICONS = { Star, Sparkles, Crown }

type Props = {
  rankKey: string
  labelKey: string
  descriptionKey: string
  icon: 'Star' | 'Sparkles' | 'Crown'
  // Punti Community guadagnati richiesti dal badge (solo per il testo)
  threshold: number
}

export default function RankAchievementModal({ rankKey, labelKey, descriptionKey, icon, threshold }: Props) {
  const t = useTranslations('dashboard')
  const [visible, setVisible] = useState(true)
  const Icon = RANK_ICONS[icon]

  useEffect(() => {
    const duration = 2500
    const end = Date.now() + duration
    const colors = ['#e7c56a', '#171717', '#ffffff']

    const frame = () => {
      confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0 }, colors })
      confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1 }, colors })
      if (Date.now() < end) requestAnimationFrame(frame)
    }
    confetti({ particleCount: 90, spread: 100, origin: { y: 0.6 }, colors })
    frame()
  }, [])

  const handleClose = () => {
    setVisible(false)
    markRankSeen(rankKey)
  }

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[var(--gold)]/45 bg-[var(--ink)] p-8 text-center text-white shadow-[0_25px_60px_rgba(0,0,0,0.4)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-stone-400 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[var(--gold)]/55 bg-[var(--gold)]/10 shadow-md">
          <Icon className="h-10 w-10 text-[var(--gold-bright)]" />
        </div>

        <p className="mb-1 text-xs font-bold uppercase tracking-[0.28em] text-[var(--gold)]">
          {t('qualificationAchievedBadge')}
        </p>
        <h2 className="mb-3 text-2xl font-bold text-white">{t(labelKey)}</h2>
        <p className="text-sm leading-6 text-stone-300">{t('qualificationAchievedMessage', { rank: t(labelKey) })}</p>
        <p className="mt-1 text-xs text-stone-400">{t(descriptionKey, { points: threshold })}</p>

        <button
          onClick={handleClose}
          className="mt-6 w-full rounded-xl bg-[var(--gold)] px-5 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--gold-bright)]"
        >
          {t('qualificationAchievedClose')}
        </button>
      </div>
    </div>
  )
}
