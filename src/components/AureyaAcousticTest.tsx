'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Ear, Headphones, PlayCircle, RotateCcw, StopCircle, Volume2 } from 'lucide-react'
import { saveAcousticTestResult } from '@/app/actions/aureya'
import {
  ACOUSTIC_FREQUENCIES,
  computeAcousticScore,
  type AcousticThreshold,
  type DeviceConfirmation,
  type Ear as EarSide,
} from '@/lib/aureya'

const RAMP_DURATION_MS = 4000
const HOLD_AT_MAX_MS = 1500
const START_GAIN = 0.015
const MAX_GAIN = 0.3
// Silenzio tra un suono e l'altro, ogni volta di durata diversa: così non si
// impara il ritmo e si preme solo quando il suono c'è davvero
const GAP_MIN_MS = 2000
const GAP_MAX_MS = 5000
// Oltre questo numero di tocchi senza suono il risultato è poco attendibile
const EARLY_PRESS_LIMIT = 2
const randomGap = () => GAP_MIN_MS + Math.random() * (GAP_MAX_MS - GAP_MIN_MS)

type Phase = 'device-check' | 'instructions' | 'testing' | 'saving' | 'results'

// Istante attuale in millisecondi (usato solo nei gestori dei pulsanti e
// dei timer, mai mentre si disegna la pagina)
const nowMs = () => performance.now()

function detectMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  const uaData = (navigator as unknown as { userAgentData?: { mobile?: boolean } }).userAgentData
  if (uaData && typeof uaData.mobile === 'boolean') return uaData.mobile
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

const STEPS: { ear: EarSide; frequency: (typeof ACOUSTIC_FREQUENCIES)[number] }[] = (['left', 'right'] as const).flatMap(
  (ear) => ACOUSTIC_FREQUENCIES.map((frequency) => ({ ear, frequency }))
)

export default function AureyaAcousticTest({
  previousScore,
  previousTestedAt,
}: {
  previousScore: number | null
  previousTestedAt: string | null
}) {
  const t = useTranslations('aureya.acoustic')
  const [phase, setPhase] = useState<Phase>('device-check')
  const [isMobile, setIsMobile] = useState(false)
  const [device, setDevice] = useState<DeviceConfirmation | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)
  // Avviso breve quando si tocca "Lo sento" durante il silenzio
  const [earlyNotice, setEarlyNotice] = useState(false)
  const [earlyPresses, setEarlyPresses] = useState(0)

  // Source of truth for the in-progress test: playStep/recordStep chain
  // themselves via setTimeout, so they must not rely on React state from
  // the render that scheduled them (it would be stale by the time the
  // timeout fires). Component state is only used for what's rendered.
  const thresholdsRef = useRef<AcousticThreshold[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const oscillatorRef = useRef<OscillatorNode | null>(null)
  const gainRef = useRef<GainNode | null>(null)
  const stepStartRef = useRef<number>(0)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const gapRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toneOnRef = useRef(false)
  const earlyPressesRef = useRef(0)

  // Telefono o computer: si sa solo nel browser, dopo l'apertura (il testo
  // mostrato cambia, quindi non si può calcolare prima sul server)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMobile(detectMobile())
  }, [])

  const stopTone = () => {
    toneOnRef.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    oscillatorRef.current?.stop()
    oscillatorRef.current = null
    gainRef.current = null
  }

  useEffect(() => {
    return () => {
      stopTone()
      void audioContextRef.current?.close()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (gapRef.current) clearTimeout(gapRef.current)
    }
  }, [])

  const playStep = async (index: number) => {
    const step = STEPS[index]
    if (!step) return

    const audioContext = audioContextRef.current ?? new AudioContext()
    audioContextRef.current = audioContext
    await audioContext.resume()

    const gain = audioContext.createGain()
    const panner = audioContext.createStereoPanner()
    const oscillator = audioContext.createOscillator()

    oscillator.type = 'sine'
    oscillator.frequency.value = step.frequency
    panner.pan.value = step.ear === 'left' ? -1 : 1

    const now = audioContext.currentTime
    gain.gain.setValueAtTime(START_GAIN, now)
    gain.gain.linearRampToValueAtTime(MAX_GAIN, now + RAMP_DURATION_MS / 1000)

    oscillator.connect(panner).connect(gain).connect(audioContext.destination)
    oscillator.start()

    oscillatorRef.current = oscillator
    gainRef.current = gain
    stepStartRef.current = nowMs()
    toneOnRef.current = true

    timeoutRef.current = setTimeout(() => {
      recordStep(index, null)
    }, RAMP_DURATION_MS + HOLD_AT_MAX_MS)
  }

  const recordStep = (index: number, level: number | null) => {
    const step = STEPS[index]
    if (!step) return
    stopTone()
    thresholdsRef.current = [...thresholdsRef.current, { ear: step.ear, frequency: step.frequency, level }]

    const next = index + 1
    if (next < STEPS.length) {
      setStepIndex(next)
      waitThenPlay(next)
    } else {
      void finishTest(thresholdsRef.current)
    }
  }

  // Silenzio di durata casuale, poi il suono
  const waitThenPlay = (index: number) => {
    if (gapRef.current) clearTimeout(gapRef.current)
    gapRef.current = setTimeout(() => {
      gapRef.current = null
      void playStep(index)
    }, randomGap())
  }

  const cancelGap = () => {
    if (gapRef.current) {
      clearTimeout(gapRef.current)
      gapRef.current = null
    }
  }

  const handleHeard = () => {
    // Tocco durante il silenzio: non è una risposta, si conta soltanto
    if (!toneOnRef.current) {
      earlyPressesRef.current += 1
      setEarlyPresses(earlyPressesRef.current)
      setEarlyNotice(true)
      window.setTimeout(() => setEarlyNotice(false), 1800)
      return
    }
    const elapsed = nowMs() - stepStartRef.current
    const frac = Math.min(1, elapsed / RAMP_DURATION_MS)
    const level = START_GAIN + (MAX_GAIN - START_GAIN) * frac
    recordStep(stepIndex, level)
  }

  const startTest = async () => {
    thresholdsRef.current = []
    earlyPressesRef.current = 0
    setEarlyPresses(0)
    setStepIndex(0)
    setError(null)
    setPhase('testing')
    // L'audio va sbloccato subito, dentro il tocco su "Inizia" (telefoni)
    const audioContext = audioContextRef.current ?? new AudioContext()
    audioContextRef.current = audioContext
    await audioContext.resume()
    waitThenPlay(0)
  }

  const finishTest = async (finalThresholds: AcousticThreshold[]) => {
    setPhase('saving')
    const computed = computeAcousticScore(finalThresholds)
    setScore(computed)
    const result = await saveAcousticTestResult({ device: device as DeviceConfirmation, thresholds: finalThresholds })
    if (!result.success) {
      setError(result.message)
    }
    setPhase('results')
  }

  const restart = () => {
    cancelGap()
    thresholdsRef.current = []
    setStepIndex(0)
    setScore(null)
    setError(null)
    setPhase('device-check')
  }

  const currentStep = STEPS[stepIndex]

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--gold)]/25 bg-[var(--paper)] shadow-[0_14px_40px_rgba(23,23,23,0.12)]">
      <div className="relative overflow-hidden bg-[var(--ink)] p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
        <div className="relative">
          <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
          <p className="mt-2 text-white/70">{t('intro')}</p>
        </div>
      </div>

      {phase === 'device-check' && (
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm leading-6 text-amber-800">{t('medicalDisclaimer')}</p>
          </div>

          <h2 className="mb-2 font-bold text-[var(--ink)]">{t('deviceCheckTitle')}</h2>
          <p className="mb-4 text-sm leading-6 text-[var(--muted)]">
            {isMobile ? t('deviceCheckMobileWarning') : t('deviceCheckBody')}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDevice('headphones')}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${device === 'headphones' ? 'border-[var(--gold)] bg-[var(--gold-pale)] shadow-sm' : 'border-[var(--gold)]/20 bg-white hover:border-[var(--gold)]/40'}`}
            >
              <Headphones className="h-6 w-6 text-[var(--gold)]" />
              <span className="font-semibold text-[var(--ink)]">{t('deviceHeadphones')}</span>
            </button>
            <button
              type="button"
              onClick={() => setDevice('speaker')}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${device === 'speaker' ? 'border-[var(--gold)] bg-[var(--gold-pale)] shadow-sm' : 'border-[var(--gold)]/20 bg-white hover:border-[var(--gold)]/40'}`}
            >
              <Volume2 className="h-6 w-6 text-[var(--gold)]" />
              <span className="font-semibold text-[var(--ink)]">{t('deviceSpeaker')}</span>
            </button>
          </div>

          <button
            type="button"
            disabled={!device}
            onClick={() => setPhase('instructions')}
            className="mt-6 inline-flex items-center gap-2 rounded-full px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t('continueButton')}
          </button>
        </div>
      )}

      {phase === 'instructions' && (
        <div className="p-6 sm:p-8">
          <h2 className="mb-2 font-bold text-[var(--ink)]">{t('instructionsTitle')}</h2>
          <p className="mb-6 text-sm leading-6 text-[var(--muted)]">{t('instructionsBody')}</p>
          <button
            type="button"
            onClick={startTest}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
          >
            <PlayCircle className="h-5 w-5" /> {t('startButton')}
          </button>
        </div>
      )}

      {phase === 'testing' && currentStep && (
        <div className="p-6 sm:p-8 text-center">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">
            {t('progressLabel', { current: stepIndex + 1, total: STEPS.length })}
          </p>
          <div className="my-8 flex flex-col items-center gap-3">
            <Ear className={`h-12 w-12 text-[var(--gold)] ${currentStep.ear === 'left' ? '-scale-x-100' : ''}`} />
            <p className="text-lg font-bold text-[var(--ink)]">
              {currentStep.ear === 'left' ? t('earLeft') : t('earRight')}
            </p>
            <p className="text-sm text-[var(--muted)]">{t('frequencyLabel', { frequency: currentStep.frequency })}</p>
            {/* Scritta fissa, uguale nel silenzio e durante il suono: lo schermo
                non deve mai far capire quando parte il tono */}
            <p className={`min-h-[1.25rem] text-sm font-semibold ${earlyNotice ? 'text-amber-600' : 'text-[var(--gold)]'}`} aria-live="polite">
              {earlyNotice ? t('earlyPress') : t('waitingLabel')}
            </p>
          </div>
          <button
            type="button"
            onClick={handleHeard}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-8 py-4 text-lg font-bold text-[var(--ink)] shadow-lg transition-transform hover:scale-[1.03]"
          >
            {t('hearButton')}
          </button>
          <p className="mt-4 text-xs text-[var(--muted)]">{t('autoAdvanceHint')}</p>
          <button
            type="button"
            onClick={() => {
              stopTone()
              restart()
            }}
            className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-red-600 transition-colors"
          >
            <StopCircle className="h-4 w-4" /> {t('stopButton')}
          </button>
        </div>
      )}

      {phase === 'saving' && (
        <div className="p-6 sm:p-8 text-center text-[var(--muted)]">{t('savingLabel')}</div>
      )}

      {phase === 'results' && score !== null && (
        <div className="p-6 sm:p-8">
          <h2 className="mb-1 font-bold text-[var(--ink)]">{t('resultsTitle')}</h2>
          <p className="mb-6 text-sm text-[var(--muted)]">{t('resultsSummary', { score })}</p>

          {previousScore !== null && previousTestedAt && (
            <p className="mb-6 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold-pale)] p-4 text-sm text-[var(--ink)]">
              {t('resultsComparison', {
                score,
                previousScore,
                date: new Date(previousTestedAt).toLocaleDateString(),
              })}
            </p>
          )}

          {earlyPresses > EARLY_PRESS_LIMIT && (
            <p className="mb-6 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              {t('earlyPressWarning', { count: earlyPresses })}
            </p>
          )}

          {error && <p className="mb-4 text-sm text-red-600">{t(error)}</p>}
          {!error && <p className="mb-4 text-sm text-emerald-600">{t('saveSuccess')}</p>}

          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/60 px-5 py-3 font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)]"
          >
            <RotateCcw className="h-4 w-4" /> {t('restartButton')}
          </button>

          <p className="mt-8 text-xs leading-5 text-[var(--muted)]">{t('medicalDisclaimer')}</p>
        </div>
      )}
    </div>
  )
}
