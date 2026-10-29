'use client'

import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { noteName, type Naming } from '@/lib/accordatore'

// Accordatura guidata: il disegno dello strumento (paletta con le chiavette
// o cordiera con i tiracantini), la corda da accordare in oro e la freccia
// che dice da che parte girare. Le corde si fanno una alla volta.
//
// Paletta vista di fronte (punta in alto): le chiavette a sinistra tendono la
// corda girando in senso antiorario, quelle a destra in senso orario.
// Violino, viola e violoncello: i tiracantini sulla cordiera alzano la nota
// in senso orario (per scarti grandi si usano i piroli, con delicatezza).

type Props = {
  instrument: string
  strings: number[]
  index: number
  naming: Naming
  // Scarto della nota suonata (centesimi), null se non si sente niente
  cents: number | null
  tolerance: number
  tuned: boolean[]
  onPrev: () => void
  onNext: () => void
}

const GOLD = '#c9a227'
const INK = '#2b2d52'

export default function GuidedTuning({ instrument, strings, index, naming, cents, tolerance, tuned, onPrev, onNext }: Props) {
  const t = useTranslations('accordatore')
  const bowed = instrument === 'violin' || instrument === 'viola' || instrument === 'cello'
  const total = strings.length
  // Numero della corda come lo dicono i musicisti: 1 = la più acuta (chitarra, basso); archi dalla più acuta
  const order = strings.map((m, i) => ({ m, i })).sort((a, b) => b.m - a.m)
  const stringNumber = order.findIndex((x) => x.i === index) + 1
  const lowest = strings.indexOf(Math.min(...strings))
  const highest = strings.indexOf(Math.max(...strings))
  const which = index === lowest ? t('guideLowest') : index === highest ? t('guideHighest') : ''
  const flat = cents !== null && cents < -tolerance
  const sharp = cents !== null && cents > tolerance
  const ok = cents !== null && !flat && !sharp

  // Da che parte si gira per alzare la nota: paletta a sinistra antiorario, a destra orario; archi orario
  const left = !bowed && index < Math.ceil(total / 2)
  const raiseClockwise = bowed ? true : !left
  const clockwise = sharp ? !raiseClockwise : raiseClockwise

  // Chiavette: le corde gravi a sinistra, le acute a destra; su ogni lato la
  // corda più esterna va alla chiavetta più lontana dal capotasto (in alto)
  const half = Math.ceil(total / 2)
  const gap = Math.round(Math.min(46, 130 / Math.max(1, half - 1)))
  const pegs = strings.map((_, i) => {
    const side = i < half ? 'left' : 'right'
    const row = side === 'left' ? i : total - 1 - i
    return { side, y: 36 + row * gap }
  })

  return (
    <div className="mt-4 rounded-3xl border border-[var(--gold)]/30 bg-[var(--background)] p-4 text-left">
      <p className="text-xs font-bold uppercase tracking-wider text-[var(--gold)]">{t('guideStep', { n: Math.min(index + 1, total), total })}</p>
      <p className="mt-1 text-lg font-extrabold text-[var(--ink)]">
        {t('guideString', { number: stringNumber, note: noteName(strings[index], naming) })}
        {which ? <span className="ml-1 text-sm font-semibold text-[var(--muted)]">· {which}</span> : null}
      </p>

      <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
        <svg viewBox="0 0 200 200" className="h-44 w-44 shrink-0" role="img" aria-label={t('guideDrawing')}>
          {bowed ? (
            <>
              {/* Cordiera con i tiracantini */}
              <path d="M70 20 Q100 6 130 20 L118 190 Q100 198 82 190 Z" fill="#3b2a1a" />
              {strings.map((_, i) => {
                const x = Math.round(82 + i * (36 / Math.max(1, total - 1)))
                const active = i === index
                return (
                  <g key={i}>
                    <line x1={x} y1="0" x2={x} y2="60" stroke={active ? GOLD : '#d6d3d1'} strokeWidth={active ? 3 : 1.5} />
                    <circle cx={x} cy="70" r={active ? 7 : 5} fill={active ? GOLD : '#a8a29e'} stroke="#fff" strokeWidth="1.5" />
                  </g>
                )
              })}
              {(flat || sharp || cents === null) && <TurnArrow cx={Math.round(82 + index * (36 / Math.max(1, total - 1)))} cy={70} clockwise={clockwise} />}
            </>
          ) : (
            <>
              {/* Paletta con le chiavette */}
              <path d="M70 186 L62 20 Q100 2 138 20 L130 186 Z" fill="#3b2a1a" />
              <rect x="66" y="182" width="68" height="8" rx="2" fill="#e7e5e4" />
              {strings.map((_, i) => {
                const p = pegs[i]
                const px = p.side === 'left' ? 74 : 126
                const knob = p.side === 'left' ? 30 : 170
                const sx = Math.round(80 + i * (40 / Math.max(1, total - 1)))
                const active = i === index
                return (
                  <g key={i}>
                    <line x1={sx} y1="200" x2={px} y2={p.y} stroke={active ? GOLD : '#d6d3d1'} strokeWidth={active ? 3 : 1.5} />
                    <line x1={px} y1={p.y} x2={knob} y2={p.y} stroke="#78716c" strokeWidth="3" />
                    <ellipse cx={knob} cy={p.y} rx="13" ry="9" fill={active ? GOLD : tuned[i] ? '#16a34a' : '#a8a29e'} stroke="#fff" strokeWidth="1.5" />
                    <circle cx={px} cy={p.y} r="5" fill="#d6d3d1" />
                  </g>
                )
              })}
              {(flat || sharp || cents === null) && <TurnArrow cx={pegs[index].side === 'left' ? 30 : 170} cy={pegs[index].y} clockwise={clockwise} />}
            </>
          )}
        </svg>
        <div className="w-full min-w-0 space-y-2 text-sm text-[var(--ink)]">
          <p className="font-bold" style={{ color: ok ? '#16a34a' : flat || sharp ? '#b45309' : INK }}>
            {cents === null ? t('guidePlay') : ok ? t('guideOk') : flat ? t('guideRaise') : t('guideLower')}
          </p>
          <p className="text-[var(--muted)]">{bowed ? t('guideBowedHint') : left ? t('guideLeftHint') : t('guideRightHint')}</p>
          {tuned[index] && index < total - 1 && <p className="font-semibold text-emerald-700">{t('guideNext', { note: noteName(strings[index + 1], naming) })}</p>}
        </div>
      </div>

      <div className="mt-3 flex justify-between gap-2">
        <button type="button" onClick={onPrev} disabled={index === 0} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--gold)]/40 px-4 text-sm font-bold text-[var(--ink)] disabled:opacity-40">
          <ChevronLeft className="h-4 w-4" /> {t('guidePrev')}
        </button>
        <button type="button" onClick={onNext} disabled={index >= total - 1} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-[var(--gold)]/40 px-4 text-sm font-bold text-[var(--ink)] disabled:opacity-40">
          {t('guideSkip')} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// Freccia curva attorno alla chiavetta: verso del giro
function TurnArrow({ cx, cy, clockwise }: { cx: number; cy: number; clockwise: boolean }) {
  const r = 20
  // Arco di tre quarti con la punta alla fine, nel verso giusto
  const start = clockwise ? -150 : -30
  const end = clockwise ? 60 : -240
  // Arrotondati: server e browser devono scrivere gli stessi numeri
  const fix = (v: number) => Math.round(v * 10) / 10
  const pt = (deg: number) => [fix(cx + r * Math.cos((deg * Math.PI) / 180)), fix(cy + r * Math.sin((deg * Math.PI) / 180))]
  const [x1, y1] = pt(start)
  const [x2, y2] = pt(end)
  const tip = pt(end)
  const dir = clockwise ? end + 90 : end - 90
  const a1 = [fix(tip[0] + 7 * Math.cos(((dir + 150) * Math.PI) / 180)), fix(tip[1] + 7 * Math.sin(((dir + 150) * Math.PI) / 180))]
  const a2 = [fix(tip[0] + 7 * Math.cos(((dir - 150) * Math.PI) / 180)), fix(tip[1] + 7 * Math.sin(((dir - 150) * Math.PI) / 180))]
  return (
    <g className="animate-pulse">
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 1 ${clockwise ? 1 : 0} ${x2} ${y2}`} fill="none" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" />
      <path d={`M ${a1[0]} ${a1[1]} L ${tip[0]} ${tip[1]} L ${a2[0]} ${a2[1]}`} fill="none" stroke={GOLD} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}
