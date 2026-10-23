'use client'

import { fmt, span, type ClockEvent, type ClockEventKey, type Minutes } from '@/lib/cronobioma'

// Quadrante delle 24 ore (mezzogiorno in alto, mezzanotte in basso, come il
// cielo): la notte in blu dall'ora di andare a letto al risveglio, il giorno
// in oro, i momenti della giornata come punti da toccare.
export const EVENT_COLOR: Record<ClockEventKey, string> = {
  light: '#f2b134',
  focus: '#c79a3b',
  dip: '#9ca3af',
  movement: '#16a34a',
  caffeine: '#8b5e34',
  dinner: '#ea580c',
  screens: '#7c3aed',
  melatonin: '#6366f1',
  bed: '#1e3a8a',
  tempLow: '#0ea5e9',
}

const SIZE = 320
const C = SIZE / 2
const R = 122

const point = (m: Minutes, r: number) => {
  const a = (((m - 720) / 1440) * 360 * Math.PI) / 180
  return { x: C + r * Math.sin(a), y: C - r * Math.cos(a) }
}

function arc(from: Minutes, to: Minutes, r: number) {
  const a = point(from, r)
  const b = point(to, r)
  const large = span(from, to) > 720 ? 1 : 0
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`
}

export default function ChronoClock({
  bed,
  wake,
  events,
  selected,
  onSelect,
  now,
  center,
  nowLabel,
  className = 'mx-auto h-auto w-full max-w-[22rem]',
}: {
  bed: Minutes
  wake: Minutes
  events: ClockEvent[]
  selected?: ClockEventKey | null
  onSelect?: (key: ClockEventKey) => void
  now?: Minutes | null
  center: { emoji: string; title: string; sub: string }
  nowLabel?: string
  className?: string
}) {
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className={className} role="img" aria-label={`${center.title} · ${center.sub}`}>
      <defs>
        <radialGradient id="cb-face" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#fffaf0" />
          <stop offset="100%" stopColor="#f3e7cf" />
        </radialGradient>
      </defs>
      <circle cx={C} cy={C} r={R + 26} fill="#171717" />
      <circle cx={C} cy={C} r={R - 16} fill="url(#cb-face)" />
      {/* Giorno e notte */}
      <path d={arc(wake, bed, R)} stroke="#e7c873" strokeWidth={18} fill="none" strokeLinecap="butt" />
      <path d={arc(bed, wake, R)} stroke="#1e2a5a" strokeWidth={18} fill="none" strokeLinecap="butt" />
      {/* Ore */}
      {Array.from({ length: 24 }, (_, h) => {
        const a = point(h * 60, R + 13)
        const b = point(h * 60, R + (h % 6 === 0 ? 4 : 8))
        return <line key={h} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#e5d3a8" strokeOpacity={h % 6 === 0 ? 0.9 : 0.4} strokeWidth={h % 6 === 0 ? 2 : 1} />
      })}
      {[0, 6, 12, 18].map((h) => {
        const p = point(h * 60, R - 30)
        return (
          <text key={h} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700} fill="#8a7650">
            {String(h).padStart(2, '0')}
          </text>
        )
      })}
      {/* Adesso */}
      {typeof now === 'number' && (
        <g>
          <line x1={C} y1={C} x2={point(now, R - 2).x} y2={point(now, R - 2).y} stroke="#171717" strokeOpacity={0.25} strokeWidth={2} />
          <circle cx={point(now, R).x} cy={point(now, R).y} r={5} fill="#fff" stroke="#171717" strokeWidth={2}>
            {nowLabel && <title>{`${nowLabel} ${fmt(now)}`}</title>}
          </circle>
        </g>
      )}
      {/* I momenti della giornata */}
      {events.map((e) => {
        const p = point(e.start, R)
        const on = selected === e.key
        return (
          <g
            key={e.key}
            onClick={onSelect ? () => onSelect(e.key) : undefined}
            style={onSelect ? { cursor: 'pointer' } : undefined}
            role={onSelect ? 'button' : undefined}
            aria-label={onSelect ? `${e.key} ${fmt(e.start)}` : undefined}
          >
            <circle cx={p.x} cy={p.y} r={on ? 11 : 8} fill={EVENT_COLOR[e.key]} stroke="#fff" strokeWidth={on ? 3 : 2} />
          </g>
        )
      })}
      {/* Centro: il cronotipo */}
      <text x={C} y={C - 26} textAnchor="middle" fontSize={34}>
        {center.emoji}
      </text>
      <text x={C} y={C + 10} textAnchor="middle" fontSize={17} fontWeight={800} fill="#171717">
        {center.title}
      </text>
      <text x={C} y={C + 30} textAnchor="middle" fontSize={11.5} fill="#6b5b3e">
        {center.sub}
      </text>
    </svg>
  )
}
