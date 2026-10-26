'use client'

import { useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import Kumi, { type KumiMove } from './Kumi'
import { melody, speak } from './kidsAudio'

// KUMI accoglie nel menu dei giochi: saluta, e a ogni tocco salta e dice un
// consiglio nuovo (scritto nel fumetto, detto dalla voce se è accesa)
export default function KumiGuide({ sound, voice }: { sound: boolean; voice: boolean }) {
  const t = useTranslations('kids')
  const locale = useLocale()
  const tips = useMemo(() => t('kumi.tips').split('|'), [t])
  const [tip, setTip] = useState(0)
  const [move, setMove] = useState<KumiMove>('wave')

  // Saluta appena entra, poi respira
  useEffect(() => {
    if (move === 'idle') return
    const timer = setTimeout(() => setMove('idle'), move === 'wave' ? 2600 : 1000)
    return () => clearTimeout(timer)
  }, [move])

  const next = () => {
    const i = (tip + 1) % tips.length
    setTip(i)
    setMove('jump')
    if (sound) melody([0, 4, 7], 90)
    if (voice) speak(tips[i], locale)
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={next} aria-label={t('kumi.alt')} className="w-20 shrink-0 sm:w-28 [@media(min-height:760px)]:w-24">
        <Kumi move={move} className="block h-auto w-full" />
      </button>
      <p key={tip} className="kids-bubble relative min-w-0 flex-1 rounded-2xl border-[3px] border-[#2B2D52] bg-white px-3 py-2 text-[15px] font-extrabold [@media(min-height:760px)]:text-base leading-snug text-[#2B2D52] shadow-[3px_3px_0_#2B2D52] sm:text-lg" role="status">
        {tips[tip]}
      </p>
      <style>{`.kids-bubble { animation: kidsBubble .35s ease; } @keyframes kidsBubble { from { opacity: 0; transform: translateY(-8px) scale(.95); } to { opacity: 1; transform: none; } }`}</style>
    </div>
  )
}
