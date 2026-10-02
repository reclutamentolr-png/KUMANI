'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, EyeOff, PlayCircle, RotateCcw, Ruler } from 'lucide-react'
import ScreenCalibration, { savedPxPerMm } from '@/components/aureya/ScreenCalibration'
import { saveAmslerTestResult } from '@/app/actions/aureya'
import { AMSLER_SIZE, type AmslerEyeResult, type Eye } from '@/lib/aureya'

// Griglia di Amsler: si guarda il punto al centro con un occhio alla volta e
// si toccano le caselle dove le linee sembrano storte, sfocate o mancanti.
// Nessun tempo e nessun punteggio: il risultato è la "mappa" delle zone.
// Formato classico: 20 × 20 caselle da 5 mm, guardata a circa 30 cm.
type Phase = 'intro' | 'calibration' | 'eye' | 'grid' | 'saving' | 'results'

const EYES: Eye[] = ['right', 'left']
const CELL_MM = 5

function Grid({
  cell,
  marked,
  onToggle,
}: {
  cell: number
  marked: Set<number>
  onToggle?: (index: number) => void
}) {
  const size = cell * AMSLER_SIZE
  return (
    <div className="relative mx-auto touch-manipulation select-none bg-white" style={{ width: size + 1, height: size + 1 }}>
      <svg width={size + 1} height={size + 1} className="absolute inset-0" aria-hidden>
        {Array.from({ length: AMSLER_SIZE + 1 }, (_, i) => (
          <g key={i}>
            <line x1={i * cell + 0.5} y1={0} x2={i * cell + 0.5} y2={size} stroke="#111" strokeWidth={1} />
            <line x1={0} y1={i * cell + 0.5} x2={size} y2={i * cell + 0.5} stroke="#111" strokeWidth={1} />
          </g>
        ))}
        {/* Il punto da guardare, al centro */}
        <circle cx={size / 2 + 0.5} cy={size / 2 + 0.5} r={Math.max(3, cell * 0.35)} fill="#111" />
      </svg>
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${AMSLER_SIZE}, ${cell}px)` }}>
        {Array.from({ length: AMSLER_SIZE * AMSLER_SIZE }, (_, index) => (
          <button
            key={index}
            type="button"
            disabled={!onToggle}
            onClick={() => onToggle?.(index)}
            aria-pressed={marked.has(index)}
            aria-label={`${Math.floor(index / AMSLER_SIZE) + 1}-${(index % AMSLER_SIZE) + 1}`}
            className={`h-full w-full ${marked.has(index) ? 'bg-red-500/45' : ''}`}
            style={{ height: cell }}
          />
        ))}
      </div>
    </div>
  )
}

export default function AureyaAmslerTest() {
  const t = useTranslations('aureya.amsler')
  const [phase, setPhase] = useState<Phase>('intro')
  const [pxPerMm, setPxPerMm] = useState<number | null>(null)
  const [eyeIndex, setEyeIndex] = useState(0)
  const [marked, setMarked] = useState<Set<number>>(new Set())
  const [results, setResults] = useState<AmslerEyeResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [width, setWidth] = useState(320)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPxPerMm(savedPxPerMm())
  }, [])

  // La griglia è di 10 cm se c'è spazio, altrimenti si adatta allo schermo
  useEffect(() => {
    const measure = () => setWidth(boxRef.current?.clientWidth ?? 320)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [phase])

  const eye = EYES[eyeIndex]
  const cell = Math.max(10, Math.floor(Math.min(CELL_MM * (pxPerMm ?? 4), (width - 2) / AMSLER_SIZE)))

  const toggle = (index: number) =>
    setMarked((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })

  const finishEye = async () => {
    const all = [...results, { eye, marked: [...marked].sort((a, b) => a - b) }]
    setResults(all)
    setMarked(new Set())
    if (eyeIndex + 1 < EYES.length) {
      setEyeIndex(eyeIndex + 1)
      setPhase('eye')
      return
    }
    setPhase('saving')
    const saved = await saveAmslerTestResult({ eyes: all })
    if (!saved.success) setError(saved.message)
    setPhase('results')
  }

  const restart = () => {
    setEyeIndex(0)
    setResults([])
    setMarked(new Set())
    setError(null)
    setPhase('intro')
  }

  const eyeLabel = (e: Eye) => (e === 'right' ? t('eyeRight') : t('eyeLeft'))
  const anyMarked = results.some((r) => r.marked.length > 0)

  return (
    <div ref={boxRef} className="overflow-hidden rounded-3xl border border-[var(--gold)]/25 bg-[var(--paper)] shadow-[0_14px_40px_rgba(23,23,23,0.12)]">
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
            <li>• {t('how1')}</li>
            <li>• {t('how2')}</li>
            <li>• {t('how3')}</li>
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
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{t('eyeBody', { cover: eye === 'right' ? t('coverLeft') : t('coverRight') })}</p>
          <button
            type="button"
            onClick={() => setPhase('grid')}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
          >
            {t('ready')}
          </button>
        </div>
      )}

      {phase === 'grid' && (
        <div className="py-6 sm:p-8">
          <p className="mb-1 px-4 text-center text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">{eyeLabel(eye)}</p>
          <p className="mx-auto mb-4 max-w-md px-4 text-center text-sm leading-6 text-[var(--muted)]">{t('gridHint')}</p>
          <Grid cell={cell} marked={marked} onToggle={toggle} />
          <div className="mt-5 flex flex-col items-center gap-2 px-4">
            <p className="text-sm font-semibold text-[var(--ink)]">{t('markedCount', { count: marked.size })}</p>
            <button
              type="button"
              onClick={() => void finishEye()}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-md transition-all hover:brightness-105"
            >
              {marked.size === 0 ? t('allGood') : t('done')}
            </button>
          </div>
        </div>
      )}

      {phase === 'saving' && <div className="p-6 text-center text-[var(--muted)] sm:p-8">{t('saving')}</div>}

      {phase === 'results' && (
        <div className="p-6 sm:p-8">
          <h2 className="mb-4 font-bold text-[var(--ink)]">{t('resultsTitle')}</h2>
          <div className="mb-5 grid gap-4 sm:grid-cols-2">
            {results.map((r) => (
              <div key={r.eye} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 text-center">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{eyeLabel(r.eye)}</p>
                <Grid cell={Math.max(6, Math.floor(Math.min(9, (width - 80) / AMSLER_SIZE)))} marked={new Set(r.marked)} />
                <p className={`mt-3 flex items-center justify-center gap-1.5 text-sm font-semibold ${r.marked.length ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {r.marked.length ? <AlertTriangle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {r.marked.length ? t('zonesMarked', { count: r.marked.length }) : t('noZones')}
                </p>
              </div>
            ))}
          </div>
          <p className={`mb-5 flex gap-2 rounded-2xl border p-4 text-sm leading-6 ${anyMarked ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-[var(--gold)]/25 bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {anyMarked ? t('adviceMarked') : t('adviceClear')}
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
