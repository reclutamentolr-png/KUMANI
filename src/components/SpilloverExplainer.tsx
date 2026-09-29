'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronDown, CornerDownRight, Crown, Pause, Play, RotateCcw, UserRound } from 'lucide-react'
import StarLines, { STAR_CENTER, STAR_POINTS } from '@/components/StarLines'

const stepLabels = [
  'spilloverStep1',
  'spilloverStep2',
  'spilloverStep3',
  'spilloverStep4',
  'spilloverStep5',
  'spilloverStep6',
  'spilloverStep7',
  'spilloverStep8',
  'spilloverStep9',
  'spilloverStep10',
]

// Mini guida animata: la stessa stella della matrice che si riempie passo
// dopo passo (5 diretti sulle punte, poi i nuovi iscritti sotto i diretti).
// Chiusa di default: si apre (e parte l'animazione) solo cliccandoci sopra.
export default function SpilloverExplainer() {
  const t = useTranslations('dashboard')
  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)

  useEffect(() => {
    if (!isOpen || !isPlaying) return

    const timer = window.setInterval(() => {
      setStep((currentStep) => (currentStep + 1) % stepLabels.length)
    }, 2200)

    return () => window.clearInterval(timer)
  }, [isOpen, isPlaying])

  const toggleOpen = () => {
    // Ogni apertura riparte dal primo passo
    if (!isOpen) {
      setStep(0)
      setIsPlaying(true)
    }
    setIsOpen((open) => !open)
  }

  const reset = () => {
    setStep(0)
    setIsPlaying(true)
  }

  const filledDirects = Math.min(step, 5)
  // Passaggi 8-10 (step 7-9): il 6°, 7° e 8° membro entrano sotto i Diretti
  // 1, 2 e 3. Il passaggio 7 (step 6) spiega solo che la prima fila è piena.
  const spilloverMembers = Array.from({ length: Math.min(Math.max(step - 6, 0), 3) }, (_, index) => index + 6)

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--gold)]/30 bg-[var(--paper)] shadow-sm">
      <div className={`flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between ${isOpen ? 'border-b border-[var(--gold)]/20' : ''}`}>
        <button type="button" onClick={toggleOpen} className="group flex flex-1 items-center justify-between gap-3 text-left" aria-expanded={isOpen}>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">{t('miniGuide')}</p>
            <h3 className="mt-1 text-lg font-bold text-[var(--ink)]">{t('spilloverTitle')}</h3>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--gold)]/35 px-3 py-2 text-xs font-semibold text-[var(--ink-soft)] transition-colors group-hover:bg-[var(--gold-pale)]">
            {isOpen ? t('closeGuide') : t('openGuide')}
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </span>
        </button>
        {isOpen && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPlaying((playing) => !playing)}
              className="flex items-center gap-2 rounded-lg bg-[var(--ink)] px-3 py-2 text-xs font-semibold text-[var(--gold-bright)] transition-colors hover:bg-[var(--ink-soft)]"
              aria-label={isPlaying ? t('pause') : t('play')}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {isPlaying ? t('pause') : t('play')}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-[var(--gold)]/35 p-2 text-[var(--ink-soft)] transition-colors hover:bg-[var(--gold-pale)]"
              aria-label={t('restartAnimation')}
              title={t('restartAnimation')}
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {isOpen && (
        <div className="grid gap-6 px-5 py-6 lg:grid-cols-[1fr_220px] lg:items-center">
          <div className="rounded-xl border border-[var(--gold)]/20 bg-[var(--background)] px-3 pb-8 pt-4 sm:px-8">
            <div className="relative mx-auto aspect-[100/124] w-full max-w-[24rem] sm:aspect-[100/108]">
              <StarLines activeRays={STAR_POINTS.map((_, index) => index < filledDirects)} />

              {/* Il titolare al centro */}
              <div
                className="absolute z-20 flex -translate-x-1/2 -translate-y-7 flex-col items-center sm:-translate-y-8"
                style={{ left: `${STAR_CENTER.x}%`, top: `${STAR_CENTER.y}%` }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full border-[3px] border-[var(--gold-bright)] bg-[var(--ink)] text-[var(--gold-bright)] shadow-md sm:h-16 sm:w-16">
                  <Crown className="h-6 w-6 sm:h-7 sm:w-7" strokeWidth={1.5} />
                </div>
                <span className="mt-2 rounded-full bg-[var(--ink)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[var(--gold-bright)]">{t('owner')}</span>
              </div>

              {/* I 5 diretti sulle punte, con i nuovi iscritti sotto */}
              {STAR_POINTS.map((point, index) => {
                const isFilled = index < filledDirects
                const spilloverMember = spilloverMembers[index]
                const name = t('directN', { n: index + 1 })

                return (
                  <div
                    key={name}
                    className="absolute z-10 flex -translate-x-1/2 -translate-y-5 flex-col items-center text-center sm:-translate-y-7"
                    style={{ left: `${point.left}%`, top: `${point.top}%` }}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 sm:h-14 sm:w-14 ${
                      isFilled
                        ? 'scale-100 border-[var(--gold)] bg-[var(--ink)] text-[var(--gold-bright)] shadow-md'
                        : 'scale-90 border-dashed border-stone-300 bg-white text-stone-300'
                    }`}>
                      {isFilled ? <UserRound className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={1.6} /> : <span className="text-xl sm:text-2xl">+</span>}
                    </div>
                    <span className="mt-1.5 whitespace-nowrap text-[10px] font-semibold text-[var(--ink-soft)] sm:text-xs">{name}</span>
                    {spilloverMember && (
                      <div className="mt-1 flex items-center gap-1 whitespace-nowrap rounded-full border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-2 py-0.5 text-[9px] font-bold text-[var(--ink)] animate-fadeIn">
                        <CornerDownRight className="h-3 w-3" />
                        {t('spilloverMember', { n: spilloverMember })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--ink)] p-4 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--gold-bright)]">{t('step', { current: step + 1, total: stepLabels.length })}</p>
            <p className="mt-3 min-h-[60px] text-sm leading-6 text-stone-200">{t(stepLabels[step])}</p>
            <div className="mt-4 flex gap-1">
              {stepLabels.map((label, index) => (
                <span key={label} className={`h-1.5 flex-1 rounded-full transition-colors ${index <= step ? 'bg-[var(--gold-bright)]' : 'bg-white/20'}`} />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
