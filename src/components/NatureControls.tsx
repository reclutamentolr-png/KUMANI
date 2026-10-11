'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Pause, Play, RotateCcw, Square, Volume2 } from 'lucide-react'
import { useNeurobalanceAudio } from '@/components/NeurobalanceAudioProvider'
import { EQ_BANDS, NATURE_MOODS, type NaturePreset } from '@/lib/natureSounds'

const SOUNDS: NaturePreset[] = ['rain', 'ocean', 'stream', 'forest', 'birds', 'wind', 'fire', 'night', 'storm']
const TIMERS: (number | null)[] = [15, 30, 60, 480, null]
const hzLabel = (hz: number) => (hz >= 1000 ? `${hz / 1000}k` : String(hz))

// Comandi del suono della natura nel riquadro nero di NeuroBalance (come un
// mixer): pausa, atmosfere pronte, equalizzatore a 10 bande, animazione,
// spegnimento automatico, volume e un secondo suono sotto.
export default function NatureControls() {
  const t = useTranslations('neurobalance')
  const locale = useLocale()
  const {
    activeNature,
    natureVolume,
    setNatureVolume,
    natureEq,
    natureMood,
    natureAnimate,
    naturePaused,
    natureTimerMinutes,
    natureTimerEndsAt,
    natureLayer,
    natureLayerVolume,
    setNatureBand,
    applyNatureMood,
    toggleNatureAnimate,
    toggleNaturePause,
    setNatureTimer,
    toggleNatureLayer,
    setNatureLayerVolume,
    toggleNature,
  } = useNeurobalanceAudio()
  if (!activeNature) return null

  const chip = (on: boolean) =>
    `min-h-10 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${on ? 'border-[var(--gold-bright)] bg-[var(--gold-bright)] text-[var(--ink)]' : 'border-white/15 text-white hover:border-[var(--gold)]/60'}`
  const endsAt = natureTimerEndsAt ? new Date(natureTimerEndsAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) : null

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-[var(--gold-bright)]">{t('natureSoundsLabel')}</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">{t(`naturePresets.${activeNature}.label`)}</h2>
          <p className="mt-1 text-sm text-white/70">
            {naturePaused ? t('mixPaused') : endsAt ? t('mixPlayingUntil', { time: endsAt }) : t('mixPlaying')}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void toggleNaturePause()}
            aria-label={naturePaused ? t('mixResume') : t('pause')}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]"
          >
            {naturePaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleNature(activeNature)}
            aria-label={t('mixStop')}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-white hover:bg-white/10"
          >
            <Square className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Atmosfere pronte */}
      <div>
        <p className="mb-2 text-[13px] font-bold text-[var(--gold-bright)]">{t('mixMoods')}</p>
        <div className="flex flex-wrap gap-2">
          {NATURE_MOODS.map((mood) => (
            <button key={mood.id} type="button" aria-pressed={natureMood === mood.id} onClick={() => applyNatureMood(mood.id)} className={chip(natureMood === mood.id)}>
              {t(`mixMood_${mood.id}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Equalizzatore */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[13px] font-bold text-[var(--gold-bright)]">{t('mixEqualizer')}</p>
          <button type="button" onClick={() => applyNatureMood('natural')} className="inline-flex min-h-9 items-center gap-1 text-xs text-white/70 underline-offset-2 hover:underline">
            <RotateCcw className="h-3.5 w-3.5" /> {t('mixReset')}
          </button>
        </div>
        <div className="grid grid-cols-10 gap-0.5 rounded-2xl bg-white/5 px-1 pb-2.5 pt-3.5">
          {EQ_BANDS.map((hz, index) => (
            <div key={hz} className="flex min-w-0 flex-col items-center gap-1.5">
              <span className="text-[10px] tabular-nums text-white/45">{natureEq[index]}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={natureEq[index]}
                onChange={(event) => setNatureBand(index, Number(event.target.value))}
                aria-label={t('mixBandLabel', { hz: hzLabel(hz) })}
                className="h-36 w-7 cursor-pointer accent-[var(--gold-bright)] [direction:rtl] [writing-mode:vertical-lr]"
              />
              <span className="text-[10px] font-semibold text-white/70">{hzLabel(hz)}</span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 grid grid-cols-4 gap-1 text-center text-[11px] leading-tight text-white/45">
          <span>{t('mixZoneDeep')}</span>
          <span>{t('mixZoneBody')}</span>
          <span>{t('mixZoneDetail')}</span>
          <span>{t('mixZoneAir')}</span>
        </div>
      </div>

      {/* Animazione */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold">{t('mixAnimate')}</p>
          <p className="text-xs text-white/60">{t('mixAnimateHint')}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={natureAnimate}
          aria-label={t('mixAnimate')}
          onClick={toggleNatureAnimate}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${natureAnimate ? 'bg-[var(--gold-bright)]' : 'bg-white/20'}`}
        >
          <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${natureAnimate ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </div>

      {/* Spegni dopo */}
      <div>
        <p className="mb-2 text-sm font-bold">{t('mixTimer')}</p>
        <div className="flex flex-wrap gap-2">
          {TIMERS.map((minutes) => (
            <button key={String(minutes)} type="button" aria-pressed={natureTimerMinutes === minutes} onClick={() => setNatureTimer(minutes)} className={chip(natureTimerMinutes === minutes)}>
              {minutes === null ? t('mixTimerNever') : minutes >= 480 ? t('mixTimerNight') : minutes >= 60 ? t('mixTimerHours', { count: minutes / 60 }) : t('mixTimerMinutes', { count: minutes })}
            </button>
          ))}
        </div>
      </div>

      {/* Volume */}
      <label className="flex items-center gap-3 text-sm font-bold">
        <Volume2 className="h-4 w-4 shrink-0 text-[var(--gold-bright)]" />
        <span className="sr-only">{t('natureVolumeLabel')}</span>
        <input type="range" min={0} max={1} step={0.05} value={natureVolume} onChange={(event) => setNatureVolume(Number(event.target.value))} className="w-full accent-[var(--gold-bright)]" />
      </label>

      {/* Secondo suono */}
      <div className="border-t border-white/10 pt-4">
        <p className="text-sm font-bold">{t('mixLayer')}</p>
        <p className="mb-2 text-xs text-white/60">{t('mixLayerHint')}</p>
        <div className="flex flex-wrap gap-2">
          {SOUNDS.filter((id) => id !== activeNature).map((id) => (
            <button key={id} type="button" aria-pressed={natureLayer === id} onClick={() => void toggleNatureLayer(id)} className={chip(natureLayer === id)}>
              {t(`naturePresets.${id}.label`)}
            </button>
          ))}
        </div>
        {natureLayer && (
          <label className="mt-3 flex flex-col gap-1.5 text-xs text-white/70">
            {t('mixLayerVolume', { sound: t(`naturePresets.${natureLayer}.label`) })}
            <input type="range" min={0} max={1} step={0.05} value={natureLayerVolume} onChange={(event) => setNatureLayerVolume(Number(event.target.value))} className="w-full accent-[var(--gold-bright)]" />
          </label>
        )}
      </div>
    </div>
  )
}
