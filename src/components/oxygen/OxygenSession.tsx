'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, BellOff, Pause, Play, RotateCcw, ShieldAlert, SkipForward, Smartphone, Square, Wind } from 'lucide-react'
import { completeOxygenSession } from '@/app/actions/oxygen'

// KUMANI OXYGEN: respirazione 4-7-8 guidata a testo. Una sequenza di passi
// (frasi, preparazione, cicli) scandita da un timer al secondo; il cerchio
// si espande in 4 s, resta pieno 7 s e si svuota in 8 s. Suono (generato dal
// browser, nessun file audio) e vibrazione segnano i cambi di fase, così si
// può anche chiudere gli occhi.

type Mode = 'guided' | 'breath'
type Phase = 'inhale' | 'hold' | 'exhale'
type Step =
  | { kind: 'text'; key: string; seconds: number }
  | { kind: 'prepare'; seconds: number }
  | { kind: 'cycle'; index: number; total: number }

const PHASES: { phase: Phase; seconds: number }[] = [
  { phase: 'inhale', seconds: 4 },
  { phase: 'hold', seconds: 7 },
  { phase: 'exhale', seconds: 8 },
]
const CYCLE_SECONDS = 19

const INTRO: Step[] = [
  { kind: 'text', key: 'intro1', seconds: 6 },
  { kind: 'text', key: 'intro2', seconds: 7 },
  { kind: 'text', key: 'intro3', seconds: 8 },
  { kind: 'text', key: 'intro4', seconds: 7 },
  { kind: 'text', key: 'intro5', seconds: 9 },
]
const OUTRO: Step[] = [
  { kind: 'text', key: 'outro1', seconds: 6 },
  { kind: 'text', key: 'outro2', seconds: 7 },
  { kind: 'text', key: 'outro3', seconds: 8 },
  { kind: 'text', key: 'outro4', seconds: 9 },
]

function buildSteps(mode: Mode, cycles: number): Step[] {
  const cycleSteps: Step[] = Array.from({ length: cycles }, (_, index) => ({ kind: 'cycle', index, total: cycles }))
  if (mode === 'breath') return [{ kind: 'prepare', seconds: 5 }, ...cycleSteps]
  return [...INTRO, { kind: 'prepare', seconds: 6 }, ...cycleSteps, ...OUTRO]
}

const stepSeconds = (step: Step) => (step.kind === 'cycle' ? CYCLE_SECONDS : step.seconds)

// Fase del ciclo al secondo "elapsed" (0..18)
function cyclePhase(elapsed: number): { phase: Phase; count: number; seconds: number } {
  let start = 0
  for (const { phase, seconds } of PHASES) {
    if (elapsed < start + seconds) return { phase, count: elapsed - start + 1, seconds }
    start += seconds
  }
  return { phase: 'exhale', count: 8, seconds: 8 }
}

// Suono leggero (campanella) generato dal browser: tono diverso per fase
const TONES: Record<Phase, number> = { inhale: 528, hold: 440, exhale: 396 }
function playTone(context: AudioContext | null, frequency: number) {
  if (!context) return
  const now = context.currentTime
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(0.18, now + 0.04)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.6)
  oscillator.connect(gain).connect(context.destination)
  oscillator.start(now)
  oscillator.stop(now + 1.7)
}

// Frase di incoraggiamento durante i cicli guidati (dal secondo in poi)
const CYCLE_TIPS = ['cycleTip2', 'cycleTip3', 'cycleTipLast']

export default function OxygenSession() {
  const t = useTranslations('oxygen')
  const [mode, setMode] = useState<Mode>('guided')
  const [cycles, setCycles] = useState(4)
  const [sound, setSound] = useState(true)
  const [vibration, setVibration] = useState(true)
  const [status, setStatus] = useState<'setup' | 'running' | 'paused' | 'done'>('setup')
  const [steps, setSteps] = useState<Step[]>([])
  const [stepIndex, setStepIndex] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)
  const audio = useRef<AudioContext | null>(null)
  const wakeLock = useRef<{ release: () => Promise<void> } | null>(null)
  // Impostazioni lette dal timer senza farlo ripartire
  const settings = useRef({ sound, vibration })
  useEffect(() => {
    settings.current = { sound, vibration }
  }, [sound, vibration])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])

  // Schermo acceso durante la sessione (dove il browser lo consente)
  const keepScreenOn = useCallback(async (on: boolean) => {
    try {
      if (on && !wakeLock.current && 'wakeLock' in navigator) {
        wakeLock.current = await (navigator as Navigator & { wakeLock: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock.request('screen')
      } else if (!on && wakeLock.current) {
        await wakeLock.current.release()
        wakeLock.current = null
      }
    } catch {
      // non disponibile: la sessione funziona lo stesso
    }
  }, [])

  const cue = useCallback((phase: Phase) => {
    if (settings.current.sound) playTone(audio.current, TONES[phase])
    if (settings.current.vibration && 'vibrate' in navigator) navigator.vibrate(phase === 'hold' ? [40, 60, 40] : 70)
  }, [])

  // Timer al secondo
  useEffect(() => {
    if (status !== 'running') return
    const timer = window.setInterval(() => {
      setElapsed((current) => current + 1)
    }, 1000)
    return () => window.clearInterval(timer)
  }, [status])

  // Avanzamento tra i passi e segnali di fase
  useEffect(() => {
    if (status !== 'running') return
    const step = steps[stepIndex]
    if (!step) return
    if (elapsed >= stepSeconds(step)) {
      if (stepIndex + 1 >= steps.length) {
        queueMicrotask(() => setStatus('done'))
        void keepScreenOn(false)
        void completeOxygenSession()
      } else {
        queueMicrotask(() => {
          setStepIndex(stepIndex + 1)
          setElapsed(0)
        })
      }
      return
    }
    if (step.kind === 'cycle' && (elapsed === 0 || elapsed === 4 || elapsed === 11)) cue(cyclePhase(elapsed).phase)
  }, [elapsed, stepIndex, steps, status, cue, keepScreenOn])

  // Pausa automatica se si cambia app o scheda
  useEffect(() => {
    const onHide = () => {
      if (document.hidden) setStatus((current) => (current === 'running' ? 'paused' : current))
    }
    document.addEventListener('visibilitychange', onHide)
    return () => document.removeEventListener('visibilitychange', onHide)
  }, [])

  useEffect(() => () => void keepScreenOn(false), [keepScreenOn])

  const start = () => {
    try {
      const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!audio.current && Context) audio.current = new Context()
      void audio.current?.resume()
    } catch {
      audio.current = null
    }
    setSteps(buildSteps(mode, cycles))
    setStepIndex(0)
    setElapsed(0)
    setStatus('running')
    void keepScreenOn(true)
  }

  const togglePause = () => {
    setStatus((current) => (current === 'running' ? 'paused' : 'running'))
    void keepScreenOn(status !== 'running')
    void audio.current?.resume()
  }

  const stop = () => {
    setStatus('setup')
    void keepScreenOn(false)
  }

  const skipIntro = () => {
    const prepareIndex = steps.findIndex((step) => step.kind === 'prepare')
    if (prepareIndex > stepIndex) {
      setStepIndex(prepareIndex)
      setElapsed(0)
    }
  }

  // ── Impostazione ──
  if (status === 'setup' || status === 'done') {
    return (
      <div className="space-y-5">
        {status === 'done' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center sm:p-6">
            <p className="text-xl font-bold text-emerald-800">{t('doneTitle')}</p>
            <p className="mt-1 text-sm text-emerald-900">{t('doneText', { cycles: steps.filter((s) => s.kind === 'cycle').length })}</p>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
          <p className="mb-3 font-bold text-[var(--ink)]">{t('chooseMode')}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(['guided', 'breath'] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  mode === value ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-gray-200 bg-white text-[var(--ink)] hover:border-[var(--gold)]'
                }`}
              >
                <span className="block font-bold">{t(value === 'guided' ? 'modeGuided' : 'modeBreath')}</span>
                <span className={`mt-1 block text-sm ${mode === value ? 'text-white/70' : 'text-gray-500'}`}>
                  {t(value === 'guided' ? 'modeGuidedHint' : 'modeBreathHint')}
                </span>
              </button>
            ))}
          </div>

          <p className="mb-2 mt-5 text-sm font-semibold text-[var(--ink)]">{t('cyclesLabel')}</p>
          <div className="flex gap-2">
            {[4, 8].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setCycles(value)}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold ${cycles === value ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 text-gray-700 hover:border-[var(--gold)]'}`}
              >
                {t('cycles', { count: value })}
                {value === 4 ? ` · ${t('recommended')}` : ''}
              </button>
            ))}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
              <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} className="h-4 w-4 accent-[var(--ink)]" />
              {sound ? <Bell className="h-4 w-4 text-[var(--gold)]" /> : <BellOff className="h-4 w-4 text-gray-400" />} {t('optionSound')}
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700">
              <input type="checkbox" checked={vibration} onChange={(e) => setVibration(e.target.checked)} className="h-4 w-4 accent-[var(--ink)]" />
              <Smartphone className="h-4 w-4 text-[var(--gold)]" /> {t('optionVibration')}
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-500">{t('eyesNote')}</p>
        </div>

        {/* Avvertenze, sempre visibili prima di iniziare */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="mb-2 flex items-center gap-2 font-bold text-amber-900">
            <ShieldAlert className="h-5 w-5" /> {t('safetyTitle')}
          </p>
          <ul className="space-y-1.5 text-sm leading-6 text-amber-950">
            {['safety1', 'safety2', 'safety3', 'safety4', 'safety5'].map((key) => (
              <li key={key}>• {t(key)}</li>
            ))}
          </ul>
        </div>

        <button
          type="button"
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-3.5 text-base font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
        >
          {status === 'done' ? <RotateCcw className="h-5 w-5" /> : <Wind className="h-5 w-5" />}
          {status === 'done' ? t('again') : t('start')}
        </button>
      </div>
    )
  }

  // ── Sessione ──
  const step = steps[stepIndex]
  const inCycle = step?.kind === 'cycle'
  const current = inCycle ? cyclePhase(elapsed) : null
  // Dimensione del cerchio: piccolo a riposo, grande pieno, animato nella fase
  const target = current ? (current.phase === 'exhale' ? 0.5 : 1) : 0.5
  const transitionSeconds = current ? (current.phase === 'hold' ? 0.3 : current.seconds) : 1
  const label = current ? t(`phase_${current.phase}`) : step?.kind === 'prepare' ? t('phase_prepare') : ''
  const cycleNumber = step?.kind === 'cycle' ? step.index + 1 : 0
  const cycleTotal = step?.kind === 'cycle' ? step.total : 0
  const tipKey =
    step?.kind === 'cycle' && mode === 'guided' && step.index > 0
      ? step.index === step.total - 1
        ? CYCLE_TIPS[2]
        : CYCLE_TIPS[(step.index - 1) % 2]
      : null
  const inIntro = mode === 'guided' && steps.findIndex((s) => s.kind === 'prepare') > stepIndex

  return (
    <div className="rounded-3xl bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
      <div className="flex min-h-[26px] items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[var(--gold-bright)]">
        <span>{cycleTotal > 0 ? t('cycleOf', { current: cycleNumber, total: cycleTotal }) : t('title')}</span>
        {status === 'paused' && <span className="text-white/70">{t('paused')}</span>}
      </div>

      {/* Il cerchio che respira */}
      <div className="relative mx-auto my-6 flex aspect-square w-full max-w-[18rem] items-center justify-center">
        <div className="absolute inset-0 rounded-full border border-[var(--gold)]/25" />
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--gold)]/60 to-[var(--gold-bright)]/30 shadow-[0_0_60px_rgba(199,154,59,0.35)]"
          style={
            reducedMotion
              ? { opacity: current ? (current.phase === 'exhale' ? 0.35 : 0.8) : 0.35 }
              : { transform: `scale(${target})`, transition: `transform ${transitionSeconds}s ease-in-out` }
          }
        />
        <div className="relative text-center">
          {current ? (
            <>
              <p className="text-6xl font-bold tabular-nums">{current.count}</p>
              <p className="mt-1 text-base font-semibold text-[var(--gold-bright)]">{label}</p>
            </>
          ) : step?.kind === 'prepare' ? (
            <>
              <p className="text-5xl font-bold tabular-nums">{step.seconds - elapsed}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--gold-bright)]">{label}</p>
            </>
          ) : (
            <Wind className="h-10 w-10 text-[var(--gold-bright)]" />
          )}
        </div>
      </div>

      {/* Testo che accompagna */}
      <p className="mx-auto min-h-[4.5rem] max-w-md text-center text-lg leading-8 text-white/90" aria-live="polite">
        {step?.kind === 'text'
          ? t(step.key)
          : step?.kind === 'prepare'
            ? t('prepareText')
            : tipKey
              ? t(tipKey)
              : current
                ? t(`phaseHint_${current.phase}`)
                : ''}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={togglePause} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20">
          {status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          {status === 'paused' ? t('resume') : t('pause')}
        </button>
        {inIntro && (
          <button type="button" onClick={skipIntro} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20">
            <SkipForward className="h-4 w-4" /> {t('skipIntro')}
          </button>
        )}
        <button type="button" onClick={() => setSound((value) => !value)} className="rounded-xl bg-white/10 p-2.5 hover:bg-white/20" aria-label={t('optionSound')} title={t('optionSound')}>
          {sound ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4 text-white/50" />}
        </button>
        <button type="button" onClick={stop} className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20">
          <Square className="h-4 w-4" /> {t('stop')}
        </button>
      </div>
    </div>
  )
}
