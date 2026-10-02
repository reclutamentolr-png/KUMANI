'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowRight, ArrowUp, EyeOff, PlayCircle, RotateCcw, Ruler } from 'lucide-react'
import ScreenCalibration, { savedPxPerMm } from '@/components/aureya/ScreenCalibration'
import { saveAcuityTestResult } from '@/app/actions/aureya'
import {
  ACUITY_LEVELS,
  ACUITY_PASS,
  ACUITY_TRIES_PER_LEVEL,
  computeAcuityScore,
  logMarToTenths,
  optotypeMm,
  type AcuityEyeResult,
  type Direction,
  type Eye,
} from '@/lib/aureya'

// Acuità visiva con la "E" girata (come al controllo dall'oculista): per
// ogni grandezza si indica dove sono rivolte le "gambe" della E, senza limiti
// di tempo. Un livello si supera con 2 risposte giuste su 3; ci si ferma al
// primo livello non superato. Un occhio alla volta, prima il destro.
type Phase = 'intro' | 'calibration' | 'eye' | 'testing' | 'saving' | 'results'

const DIRECTIONS: Direction[] = ['up', 'right', 'down', 'left']
const ROTATION: Record<Direction, number> = { right: 0, down: 90, left: 180, up: 270 }
const EYES: Eye[] = ['right', 'left']
// La E ha 5 righe (barre e spazi): serve almeno 1 pixel vero dello schermo
// per riga, quindi la E da 10/10 deve essere alta almeno 5 pixel veri.
const MIN_DEVICE_PX_10_10 = 5
const TAN_5_ARCMIN = Math.tan((5 / 60) * (Math.PI / 180))

// Distanza: telefono 40 cm; computer quanto basta perché anche la E da 10/10
// sia nitida (schermi con pixel più grandi = più lontano), da 60 cm a 2,5 m
function chooseDistanceCm(pxPerMm: number, dpr: number, phone: boolean) {
  if (phone) return 40
  const neededMm = MIN_DEVICE_PX_10_10 / (pxPerMm * dpr) / TAN_5_ARCMIN
  return Math.min(250, Math.max(60, Math.ceil(neededMm / 100) * 10))
}

const randomDirection = (previous: Direction | null) => {
  const options = DIRECTIONS.filter((d) => d !== previous)
  return options[Math.floor(Math.random() * options.length)]
}

// La E disegnata su una griglia 5×5: tre barre e il dorso a sinistra
function LetterE({ size, direction }: { size: number; direction: Direction }) {
  return (
    <svg width={size} height={size} viewBox="0 0 5 5" shapeRendering="crispEdges" style={{ transform: `rotate(${ROTATION[direction]}deg)` }} aria-hidden>
      <path d="M0 0h5v1H1v1h4v1H1v1h4v1H0z" fill="#111" />
    </svg>
  )
}

export default function AureyaAcuityTest({ previousScore, previousTestedAt }: { previousScore: number | null; previousTestedAt: string | null }) {
  const t = useTranslations('aureya.acuity')
  const [phase, setPhase] = useState<Phase>('intro')
  const [pxPerMm, setPxPerMm] = useState<number | null>(null)
  const [isPhone, setIsPhone] = useState(true)
  const [dpr, setDpr] = useState(1)
  const [eyeIndex, setEyeIndex] = useState(0)
  const [levelIndex, setLevelIndex] = useState(0)
  const [tries, setTries] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [direction, setDirection] = useState<Direction>('right')
  const [results, setResults] = useState<AcuityEyeResult[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Telefono o computer e densità dei pixel: si sanno solo nel browser
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsPhone(window.matchMedia('(pointer: coarse)').matches)
    setDpr(window.devicePixelRatio || 1)
    setPxPerMm(savedPxPerMm())
  }, [])

  const distanceCm = chooseDistanceCm(pxPerMm ?? 3.8, dpr, isPhone)

  // Grandezza della E in pixel veri dello schermo, arrotondata a righe intere
  // (così resta nitida); 0 = troppo piccola per questo schermo
  const letterPx = (logMar: number) => {
    if (!pxPerMm) return 0
    const device = optotypeMm(logMar, distanceCm) * pxPerMm * dpr
    if (device / 5 < 0.75) return 0
    return (Math.max(1, Math.round(device / 5)) * 5) / dpr
  }

  const eye = EYES[eyeIndex]
  const level = ACUITY_LEVELS[levelIndex]
  const sizePx = letterPx(level)

  const startEye = () => {
    setLevelIndex(0)
    setTries(0)
    setCorrect(0)
    setDirection(randomDirection(null))
    setPhase('testing')
  }

  const finishEye = async (bestLogMar: number | null, limitedByScreen = false) => {
    const all = [...results, { eye, bestLogMar, ...(limitedByScreen ? { limitedByScreen } : {}) }]
    setResults(all)
    if (eyeIndex + 1 < EYES.length) {
      setEyeIndex(eyeIndex + 1)
      setPhase('eye')
      return
    }
    setPhase('saving')
    setScore(computeAcuityScore(all))
    const saved = await saveAcuityTestResult({ distanceCm, pxPerMm: pxPerMm ?? 0, eyes: all })
    if (!saved.success) setError(saved.message)
    setPhase('results')
  }

  const answer = (chosen: Direction | null) => {
    const nextTries = tries + 1
    const nextCorrect = correct + (chosen === direction ? 1 : 0)
    // Livello superato appena le risposte giuste bastano
    if (nextCorrect >= ACUITY_PASS) {
      // Lo schermo non può disegnare la E del livello dopo: ci si ferma qui
      if (levelIndex + 1 < ACUITY_LEVELS.length && letterPx(ACUITY_LEVELS[levelIndex + 1]) === 0) {
        void finishEye(level, true)
      } else if (levelIndex + 1 < ACUITY_LEVELS.length) {
        setLevelIndex(levelIndex + 1)
        setTries(0)
        setCorrect(0)
        setDirection(randomDirection(direction))
      } else {
        void finishEye(level)
      }
      return
    }
    // Non superato quando gli errori non lasciano più speranze
    if (nextTries - nextCorrect > ACUITY_TRIES_PER_LEVEL - ACUITY_PASS) {
      void finishEye(levelIndex > 0 ? ACUITY_LEVELS[levelIndex - 1] : null)
      return
    }
    setTries(nextTries)
    setCorrect(nextCorrect)
    setDirection(randomDirection(direction))
  }

  // Dal computer si risponde anche con le frecce della tastiera
  useEffect(() => {
    if (phase !== 'testing') return
    const keys: Record<string, Direction> = { ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down', ArrowLeft: 'left' }
    const onKey = (event: KeyboardEvent) => {
      const chosen = keys[event.key]
      if (!chosen) return
      event.preventDefault()
      answer(chosen)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const restart = () => {
    setEyeIndex(0)
    setResults([])
    setScore(null)
    setError(null)
    setPhase('intro')
  }

  const eyeLabel = (e: Eye) => (e === 'right' ? t('eyeRight') : t('eyeLeft'))
  const tenths = (logMar: number | null) => (logMar === null ? t('belowMin') : t('tenths', { value: logMarToTenths(logMar) }))

  return (
    <div className="overflow-hidden rounded-3xl border border-[var(--gold)]/25 bg-[var(--paper)] shadow-[0_14px_40px_rgba(23,23,23,0.12)]">
      <div className="relative overflow-hidden bg-[var(--ink)] p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
        <div className="relative">
          <h1 className="text-2xl font-bold sm:text-3xl">{t('title')}</h1>
          <p className="mt-2 text-white/70">{t('intro')}</p>
        </div>
      </div>

      {phase === 'intro' && (
        <div className="p-6 sm:p-8">
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <p className="text-sm leading-6 text-amber-800">{t('medicalDisclaimer')}</p>
          </div>
          <h2 className="mb-2 font-bold text-[var(--ink)]">{t('howTitle')}</h2>
          <ul className="mb-6 space-y-2 text-sm leading-6 text-[var(--muted)]">
            <li>• {t('how1', { distance: distanceCm })}</li>
            <li>• {t('how2')}</li>
            <li>• {t('how3')}</li>
            <li>• {t('how4')}</li>
            {!isPhone && <li>• {t('how5')}</li>}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setPhase(pxPerMm ? 'eye' : 'calibration')}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
            >
              <PlayCircle className="h-5 w-5" /> {t('start')}
            </button>
            {pxPerMm && (
              <button type="button" onClick={() => setPhase('calibration')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
                <Ruler className="h-4 w-4" /> {t('recalibrate')}
              </button>
            )}
          </div>
        </div>
      )}

      {phase === 'calibration' && (
        <ScreenCalibration
          onDone={(value) => {
            setPxPerMm(value)
            setPhase('eye')
          }}
        />
      )}

      {phase === 'eye' && (
        <div className="p-6 text-center sm:p-8">
          <EyeOff className="mx-auto mb-3 h-10 w-10 text-[var(--gold)]" />
          <h2 className="text-lg font-bold text-[var(--ink)]">{t('eyeTitle', { eye: eyeLabel(eye) })}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">
            {t('eyeBody', { cover: eye === 'right' ? t('coverLeft') : t('coverRight'), distance: distanceCm })}
          </p>
          <button
            type="button"
            onClick={startEye}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
          >
            {t('ready')}
          </button>
        </div>
      )}

      {phase === 'testing' && (
        <div className="p-6 text-center sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">
            {eyeLabel(eye)} · {t('levelOf', { current: levelIndex + 1, total: ACUITY_LEVELS.length })}
          </p>
          {/* La E, su fondo bianco, con lo spazio che serve alla più grande */}
          <div className="mx-auto my-6 flex h-48 items-center justify-center rounded-2xl bg-white sm:h-56">
            <LetterE size={sizePx} direction={direction} />
          </div>
          <p className="mb-4 text-sm text-[var(--muted)]">{t('question')}</p>
          <div className="mx-auto grid w-48 grid-cols-3 gap-2">
            <span />
            <DirButton label={t('dirUp')} onClick={() => answer('up')}><ArrowUp className="h-6 w-6" /></DirButton>
            <span />
            <DirButton label={t('dirLeft')} onClick={() => answer('left')}><ArrowLeft className="h-6 w-6" /></DirButton>
            <span />
            <DirButton label={t('dirRight')} onClick={() => answer('right')}><ArrowRight className="h-6 w-6" /></DirButton>
            <span />
            <DirButton label={t('dirDown')} onClick={() => answer('down')}><ArrowDown className="h-6 w-6" /></DirButton>
            <span />
          </div>
          <button type="button" onClick={() => answer(null)} className="mt-5 text-sm font-semibold text-[var(--muted)] underline-offset-2 hover:text-[var(--ink)] hover:underline">
            {t('cantSee')}
          </button>
        </div>
      )}

      {phase === 'saving' && <div className="p-6 text-center text-[var(--muted)] sm:p-8">{t('saving')}</div>}

      {phase === 'results' && score !== null && (
        <div className="p-6 sm:p-8">
          <h2 className="mb-4 font-bold text-[var(--ink)]">{t('resultsTitle')}</h2>
          <div className="mb-5 grid grid-cols-2 gap-3">
            {results.map((r) => (
              <div key={r.eye} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 text-center">
                <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{eyeLabel(r.eye)}</p>
                <p className="mt-1 text-2xl font-extrabold text-[var(--ink)]">{tenths(r.bestLogMar)}</p>
              </div>
            ))}
          </div>
          <p className="mb-4 text-sm text-[var(--muted)]">{t('resultsSummary', { score })}</p>
          {previousScore !== null && previousTestedAt && (
            <p className="mb-4 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold-pale)] p-4 text-sm text-[var(--ink)]">
              {t('resultsComparison', { score, previousScore, date: new Date(previousTestedAt).toLocaleDateString() })}
            </p>
          )}
          {results.some((r) => r.limitedByScreen) && (
            <p className="mb-4 rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold-pale)] p-4 text-sm leading-6 text-[var(--ink)]">
              {t('limitedNote')}
            </p>
          )}
          <p className="mb-5 flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> {t('resultsAdvice')}
          </p>
          {error ? <p className="mb-4 text-sm text-red-600">{t('saveError')}</p> : <p className="mb-4 text-sm text-emerald-600">{t('saveSuccess')}</p>}
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/60 px-5 py-3 font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)]"
          >
            <RotateCcw className="h-4 w-4" /> {t('restart')}
          </button>
        </div>
      )}
    </div>
  )
}

function DirButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ink)] text-[var(--gold-bright)] shadow transition hover:scale-105 active:scale-95"
    >
      {children}
    </button>
  )
}
