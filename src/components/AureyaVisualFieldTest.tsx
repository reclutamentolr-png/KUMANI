'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, Eye as EyeIcon, PlayCircle, RotateCcw, StopCircle } from 'lucide-react'
import { saveVisualTestResult } from '@/app/actions/aureya'
import {
  computeEyeVisualScore,
  computeVisualScore,
  type Eye,
  type VisualEyeResult,
  type VisualFieldPoint,
} from '@/lib/aureya'

const POINTS_PER_EYE = 9
const CATCH_TRIALS_PER_EYE = 3
const STIMULUS_RAMP_MS = 3000
const STIMULUS_HOLD_MS = 1000
const START_OPACITY = 0.03
const MAX_OPACITY = 0.85
const MIN_GAP_MS = 500
const MAX_GAP_MS = 1200
const EYE_ORDER: Eye[] = ['left', 'right']

type Trial = { kind: 'stimulus'; x: number; y: number } | { kind: 'catch' }

type Phase = 'instructions' | 'eye-ready' | 'testing' | 'saving' | 'results'

function buildTrials(): Trial[] {
  const stimuli: Trial[] = Array.from({ length: POINTS_PER_EYE }, () => {
    const angle = Math.random() * Math.PI * 2
    const eccentricity = 0.3 + Math.random() * 0.65
    return { kind: 'stimulus', x: Math.cos(angle) * eccentricity, y: Math.sin(angle) * eccentricity }
  })
  const catches: Trial[] = Array.from({ length: CATCH_TRIALS_PER_EYE }, () => ({ kind: 'catch' }))
  const trials = [...stimuli, ...catches]
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[trials[i], trials[j]] = [trials[j], trials[i]]
  }
  return trials
}

export default function AureyaVisualFieldTest({
  previousScore,
  previousTestedAt,
}: {
  previousScore: number | null
  previousTestedAt: string | null
}) {
  const t = useTranslations('aureya.visual')
  const [phase, setPhase] = useState<Phase>('instructions')
  const [eyeIndex, setEyeIndex] = useState(0)
  const [activeTrial, setActiveTrial] = useState<Trial | null>(null)
  const [rampVisible, setRampVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [score, setScore] = useState<number | null>(null)
  const [eyeResults, setEyeResults] = useState<VisualEyeResult[]>([])

  // Refs drive the trial-by-trial timeout chain so it never reads stale
  // state from the render that scheduled a given step (same reasoning as
  // the acoustic test's thresholdsRef).
  const queueRef = useRef<Trial[]>([])
  const cursorRef = useRef(0)
  const pointsRef = useRef<VisualFieldPoint[]>([])
  const falsePositivesRef = useRef(0)
  const eyeResultsRef = useRef<VisualEyeResult[]>([])
  const trialStartRef = useRef(0)
  const awaitingRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rampTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (rampTimeoutRef.current) clearTimeout(rampTimeoutRef.current)
    }
  }, [])

  const finishTest = async (eyes: VisualEyeResult[]) => {
    setPhase('saving')
    setEyeResults(eyes)
    const computed = computeVisualScore(eyes)
    setScore(computed)
    const result = await saveVisualTestResult({ eyes })
    if (!result.success) {
      setError(result.message)
    }
    setPhase('results')
  }

  const finishEye = () => {
    const eye = EYE_ORDER[eyeIndex]
    const points = pointsRef.current
    const eyeScore = computeEyeVisualScore(points)
    eyeResultsRef.current = [
      ...eyeResultsRef.current,
      { eye, points, falsePositives: falsePositivesRef.current, catchTrials: CATCH_TRIALS_PER_EYE, score: eyeScore },
    ]

    const nextEyeIndex = eyeIndex + 1
    if (nextEyeIndex < EYE_ORDER.length) {
      setEyeIndex(nextEyeIndex)
      setPhase('eye-ready')
    } else {
      void finishTest(eyeResultsRef.current)
    }
  }

  const scheduleNext = () => {
    const gap = MIN_GAP_MS + Math.random() * (MAX_GAP_MS - MIN_GAP_MS)
    timeoutRef.current = setTimeout(() => {
      const next = cursorRef.current + 1
      if (next >= queueRef.current.length) {
        finishEye()
        return
      }
      cursorRef.current = next
      runTrial(next)
    }, gap)
  }

  const runTrial = (index: number) => {
    const trial = queueRef.current[index]
    setActiveTrial(trial)
    setRampVisible(false)
    trialStartRef.current = performance.now()
    awaitingRef.current = true

    if (trial.kind === 'stimulus') {
      rampTimeoutRef.current = setTimeout(() => setRampVisible(true), 20)
    }

    timeoutRef.current = setTimeout(() => {
      awaitingRef.current = false
      if (trial.kind === 'stimulus') {
        pointsRef.current = [...pointsRef.current, { x: trial.x, y: trial.y, detected: false, reactionMs: null, threshold: null }]
      }
      setActiveTrial(null)
      scheduleNext()
    }, STIMULUS_RAMP_MS + STIMULUS_HOLD_MS)
  }

  const respond = () => {
    if (!awaitingRef.current) return
    awaitingRef.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (rampTimeoutRef.current) {
      clearTimeout(rampTimeoutRef.current)
      rampTimeoutRef.current = null
    }

    const trial = queueRef.current[cursorRef.current]
    if (trial.kind === 'stimulus') {
      const elapsed = performance.now() - trialStartRef.current
      const frac = Math.min(1, elapsed / STIMULUS_RAMP_MS)
      const threshold = START_OPACITY + (MAX_OPACITY - START_OPACITY) * frac
      pointsRef.current = [
        ...pointsRef.current,
        { x: trial.x, y: trial.y, detected: true, reactionMs: Math.round(elapsed), threshold },
      ]
    } else {
      falsePositivesRef.current += 1
    }
    setActiveTrial(null)
    scheduleNext()
  }

  useEffect(() => {
    if (phase !== 'testing') return
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        respond()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const startEye = () => {
    queueRef.current = buildTrials()
    cursorRef.current = 0
    pointsRef.current = []
    falsePositivesRef.current = 0
    setPhase('testing')
    runTrial(0)
  }

  const restart = () => {
    setEyeIndex(0)
    eyeResultsRef.current = []
    setEyeResults([])
    setScore(null)
    setError(null)
    setPhase('instructions')
  }

  const currentEye = EYE_ORDER[eyeIndex]

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--gold)]/25 bg-[var(--paper)] shadow-[0_14px_40px_rgba(23,23,23,0.12)]">
      <div className="relative overflow-hidden bg-[var(--ink)] p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
        <div className="relative">
          <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
          <p className="mt-2 text-white/70">{t('intro')}</p>
        </div>
      </div>

      {phase === 'instructions' && (
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm leading-6 text-amber-800">{t('medicalDisclaimer')}</p>
          </div>
          <h2 className="mb-2 font-bold text-[var(--ink)]">{t('instructionsTitle')}</h2>
          <p className="mb-6 whitespace-pre-line text-sm leading-6 text-[var(--muted)]">{t('instructionsBody')}</p>
          <button
            type="button"
            onClick={() => setPhase('eye-ready')}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
          >
            <PlayCircle className="h-5 w-5" /> {t('startButton')}
          </button>
        </div>
      )}

      {phase === 'eye-ready' && (
        <div className="p-6 sm:p-8 text-center">
          <EyeIcon className={`mx-auto mb-4 h-12 w-12 text-[var(--gold)] ${currentEye === 'left' ? '-scale-x-100' : ''}`} />
          <h2 className="mb-2 font-bold text-[var(--ink)]">
            {currentEye === 'left' ? t('coverRightEye') : t('coverLeftEye')}
          </h2>
          <p className="mb-6 text-sm leading-6 text-[var(--muted)]">{t('eyeReadyHint')}</p>
          <button
            type="button"
            onClick={startEye}
            className="inline-flex items-center gap-2 rounded-full px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
          >
            {currentEye === 'left' ? t('startLeftEye') : t('startRightEye')}
          </button>
        </div>
      )}

      {phase === 'testing' && (
        <div className="p-6 sm:p-8">
          <p className="mb-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">
            {currentEye === 'left' ? t('testingLeftEye') : t('testingRightEye')}
          </p>
          <div
            role="button"
            tabIndex={0}
            onPointerDown={respond}
            className="relative mx-auto aspect-square w-full max-w-md cursor-pointer select-none overflow-hidden rounded-2xl border border-[var(--gold)]/40 bg-slate-950"
          >
            <div className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-[var(--gold-bright)]">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[var(--gold-bright)]" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[var(--gold-bright)]" />
            </div>
            {activeTrial?.kind === 'stimulus' && (
              <div
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
                style={{
                  left: `${50 + activeTrial.x * 45}%`,
                  top: `${50 + activeTrial.y * 45}%`,
                  opacity: rampVisible ? MAX_OPACITY : START_OPACITY,
                  transition: `opacity ${STIMULUS_RAMP_MS}ms linear`,
                }}
              />
            )}
          </div>
          <p className="mt-4 text-center text-sm text-[var(--muted)]">{t('respondHint')}</p>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current)
                if (rampTimeoutRef.current) clearTimeout(rampTimeoutRef.current)
                awaitingRef.current = false
                setActiveTrial(null)
                restart()
              }}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-red-600 transition-colors"
            >
              <StopCircle className="h-4 w-4" /> {t('stopButton')}
            </button>
          </div>
        </div>
      )}

      {phase === 'saving' && <div className="p-6 sm:p-8 text-center text-[var(--muted)]">{t('savingLabel')}</div>}

      {phase === 'results' && score !== null && (
        <div className="p-6 sm:p-8">
          <h2 className="mb-1 font-bold text-[var(--ink)]">{t('resultsTitle')}</h2>
          <p className="mb-6 text-sm text-[var(--muted)]">{t('resultsSummary', { score })}</p>

          <div className="mb-6 grid gap-3 sm:grid-cols-2">
            {eyeResults.map((eyeResult) => (
              <div key={eyeResult.eye} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--muted)]">
                  {eyeResult.eye === 'left' ? t('eyeLeftLabel') : t('eyeRightLabel')}
                </p>
                <p className="mt-1 text-2xl font-bold text-[var(--ink)]">{eyeResult.score}%</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {t('falsePositivesLabel', { count: eyeResult.falsePositives, total: eyeResult.catchTrials })}
                </p>
              </div>
            ))}
          </div>

          {previousScore !== null && previousTestedAt && (
            <p className="mb-6 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold-pale)] p-4 text-sm text-[var(--ink)]">
              {t('resultsComparison', {
                score,
                previousScore,
                date: new Date(previousTestedAt).toLocaleDateString(),
              })}
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
