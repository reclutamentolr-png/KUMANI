'use client'

import { useTranslations } from 'next-intl'
import { Headphones, Pause, Play, RotateCcw, Volume2 } from 'lucide-react'
import NatureMixer from '@/components/NatureMixer'
import { useNeurobalanceAudio } from '@/components/NeurobalanceAudioProvider'

// Il motore audio vive in NeurobalanceAudioProvider (montato nel layout
// root, sopravvive alla navigazione) — questo componente è solo la vista:
// legge stato e azioni dal context invece di possedere AudioContext/
// oscillatori propri, così una sessione avviata qui resta attiva anche
// dopo aver lasciato questa pagina.
export default function NeurobalancePlayer() {
  const t = useTranslations('neurobalance')
  const {
    presets,
    specialSounds,
    selectedId,
    isPlaying,
    remaining,
    volume,
    selectedSpecialSound,
    handlePresetCardClick,
    handleSpecialSoundCardClick,
    togglePlayback,
    resetSession,
    setVolume,
  } = useNeurobalanceAudio()

  const selected = presets.find((preset) => preset.id === selectedId) ?? presets[0]
  const presetName = (id: string) => t(`presets.${id}.name`)
  const presetDescription = (id: string) => t(`presets.${id}.description`)
  const specialSoundName = (id: string) => t(`specialSounds.${id}.name`)
  const specialSoundDescription = (id: string) => t(`specialSounds.${id}.description`)

  const minutes = Math.floor(remaining / 60).toString().padStart(2, '0')
  const seconds = (remaining % 60).toString().padStart(2, '0')

  return (
    <section className="overflow-hidden rounded-3xl border border-[var(--gold)]/25 bg-[var(--paper)] shadow-[0_14px_40px_rgba(23,23,23,0.12)]">
      <div className="bg-[radial-gradient(circle_at_top_right,rgba(199,154,59,0.25),transparent_42%),linear-gradient(135deg,#171717,#292722)] px-6 py-8 text-white sm:px-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.28em] text-[var(--gold-bright)]">{selectedSpecialSound ? t('specialSoundLabel') : t('sessionAudio')}</p><h2 className="text-2xl font-bold sm:text-3xl">{selectedSpecialSound ? `${selectedSpecialSound.frequency} Hz · ${specialSoundName(selectedSpecialSound.id)}` : presetName(selected.id)}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-white/80">{selectedSpecialSound ? specialSoundDescription(selectedSpecialSound.id) : presetDescription(selected.id)}</p></div>
          <div className="hidden rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold)]/10 p-3 sm:block"><Headphones className="h-7 w-7 text-[var(--gold-bright)]" /></div>
        </div>
        <div className="mb-8 flex items-center gap-3" aria-label="Visualizzazione della frequenza">
          {Array.from({ length: 18 }, (_, index) => <span key={index} className={`flex-1 rounded-full bg-[var(--gold-bright)]/60 ${index % 3 === 0 ? 'h-12' : index % 2 === 0 ? 'h-8' : 'h-5'} ${isPlaying ? 'animate-pulse' : ''}`} style={{ animationDelay: `${index * 70}ms` }} />)}
        </div>
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div><p className="text-xs uppercase tracking-[0.22em] text-[var(--gold-bright)]">{t('timeRemaining')}</p><p className="mt-1 font-mono text-4xl font-semibold tracking-tight">{minutes}:{seconds}</p><p className="mt-1 text-xs text-[var(--gold-bright)]">{selectedSpecialSound ? t('frequencyInfo', { carrier: selectedSpecialSound.frequency, beat: 4 }) : t('frequencyInfo', { carrier: selected.carrier, beat: selected.beat })}</p></div>
          <div className="flex items-center gap-3"><button type="button" onClick={resetSession} aria-label={t('restart')} title={t('restart')} className="rounded-full border border-[var(--gold)]/40 p-3 text-white/80 transition-colors hover:bg-[var(--gold)]/15 hover:text-[var(--gold-bright)]"><RotateCcw className="h-5 w-5" /></button><button type="button" onClick={togglePlayback} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-lg transition-transform hover:scale-[1.02]">{isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}{isPlaying ? t('pause') : t('startSession')}</button></div>
        </div>
      </div>
      <div className="p-6 sm:p-8">
        <div className="mb-6 flex items-center gap-3 text-sm text-[var(--muted)]"><Volume2 className="h-4 w-4 text-[var(--gold)]" /><label htmlFor="neurobalance-volume" className="sr-only">{t('volume')}</label><input id="neurobalance-volume" type="range" min="0" max="0.4" step="0.01" value={volume} onChange={(event) => setVolume(Number(event.target.value))} className="w-full accent-[var(--gold)]" /></div>
        <div className="grid gap-3 md:grid-cols-3">
          {presets.map((preset) => {
            const isSelected = selectedId === preset.id && !selectedSpecialSound
            const isThisPlaying = isSelected && isPlaying
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePresetCardClick(preset)}
                className={`rounded-2xl border p-4 text-left transition-all ${isSelected ? 'border-[var(--gold)] bg-[var(--gold-pale)] shadow-sm' : 'border-[var(--gold)]/20 bg-white hover:border-[var(--gold)]/50 hover:bg-[var(--gold-pale)]/40'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="mb-2 block text-sm font-bold text-[var(--ink)]">{presetName(preset.id)}</span>
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${isSelected ? 'bg-[var(--gold)] text-[var(--ink)]' : 'bg-[var(--gold-pale)] text-[var(--gold)]'}`}>
                    {isThisPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </span>
                </div>
                <span className="block text-xs leading-5 text-[var(--muted)]">{t('presetMeta', { duration: preset.duration, beat: preset.beat })}</span>
                {isThisPlaying && (
                  <div className="mt-2 flex items-end gap-0.5" aria-hidden="true">
                    {Array.from({ length: 12 }, (_, index) => (
                      <span key={index} className={`flex-1 rounded-full bg-[var(--gold)]/70 animate-pulse ${index % 3 === 0 ? 'h-3' : index % 2 === 0 ? 'h-2' : 'h-1.5'}`} style={{ animationDelay: `${index * 80}ms` }} />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        <div className="mt-8 border-t border-[var(--gold)]/20 pt-6">
          <div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">{t('specialSoundLabel')}</p><p className="mt-1 text-sm text-[var(--muted)]">{t('specialSoundDescription')}</p></div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {specialSounds.map((sound) => {
              const isSelected = selectedSpecialSound?.id === sound.id
              const isThisPlaying = isSelected && isPlaying
              return (
                <button
                  key={sound.id}
                  type="button"
                  onClick={() => handleSpecialSoundCardClick(sound)}
                  className={`rounded-2xl border p-4 text-left transition-all ${isSelected ? 'border-[var(--gold)] bg-[var(--gold-pale)] shadow-sm' : 'border-[var(--gold)]/20 bg-white hover:border-[var(--gold)]/50 hover:bg-[var(--gold-pale)]/40'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="mb-2 block text-sm font-bold text-[var(--ink)]">{sound.frequency} Hz · {specialSoundName(sound.id)}</span>
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${isSelected ? 'bg-[var(--gold)] text-[var(--ink)]' : 'bg-[var(--gold-pale)] text-[var(--gold)]'}`}>
                      {isThisPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </span>
                  </div>
                  <span className="block text-xs leading-5 text-[var(--muted)]">{specialSoundDescription(sound.id)}</span>
                  {isThisPlaying && (
                    <div className="mt-2 flex items-end gap-0.5" aria-hidden="true">
                      {Array.from({ length: 12 }, (_, index) => (
                        <span key={index} className={`flex-1 rounded-full bg-[var(--gold)]/70 animate-pulse ${index % 3 === 0 ? 'h-3' : index % 2 === 0 ? 'h-2' : 'h-1.5'}`} style={{ animationDelay: `${index * 80}ms` }} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-8 border-t border-[var(--gold)]/20 pt-6">
          <NatureMixer />
        </div>

        <p className="mt-6 text-xs leading-5 text-[var(--muted)]">{t('safety')}</p>
      </div>
    </section>
  )
}
