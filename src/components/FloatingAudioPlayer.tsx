'use client'

import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { Waves, X } from 'lucide-react'
import { useNeurobalanceAudio } from '@/components/NeurobalanceAudioProvider'

// Mini player fluttuante, visibile su qualsiasi pagina dell'app: prima una
// sessione Neurobalance si interrompeva non appena si lasciava la sua
// pagina (es. per andare sul Mandala) perché l'AudioContext viveva lì.
// Ora il motore audio vive in NeurobalanceAudioProvider (montato nel
// layout root) e questa barra è solo il modo per vedere cosa sta
// suonando e fermarlo da qualunque schermata.
export default function FloatingAudioPlayer() {
  const t = useTranslations('neurobalance')
  const { isPlaying, remaining, selectedId, selectedSpecialSound, selectedTrack, activeNature, stopEverything } = useNeurobalanceAudio()

  if (!isPlaying && !activeNature) return null

  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0')
  const seconds = (remaining % 60).toString().padStart(2, '0')

  const label = selectedTrack
    ? t(`tracks.${selectedTrack.id}.name`)
    : selectedSpecialSound
    ? t(`specialSounds.${selectedSpecialSound.id}.name`)
    : isPlaying
      ? t(`presets.${selectedId}.name`)
      : activeNature
        ? t(`naturePresets.${activeNature}.label`)
        : ''

  return (
    <div data-fab className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl border border-[var(--gold)]/30 bg-[var(--ink)] px-4 py-3 text-white shadow-[0_12px_35px_rgba(23,23,23,0.35)]">
      <Link href="/marketplace/neurobalance" className="flex min-w-0 items-center gap-2">
        <Waves className="h-5 w-5 shrink-0 animate-pulse text-[var(--gold-bright)]" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{label}</p>
          {isPlaying && <p className="font-mono text-xs text-white/60">{minutes}:{seconds}</p>}
        </div>
      </Link>
      <button
        type="button"
        onClick={stopEverything}
        aria-label={t('floatingPlayerStop')}
        title={t('floatingPlayerStop')}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-red-500/70"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
