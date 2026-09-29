'use client'

const PALETTE = ['#c79a3b', '#e7c56a', '#8b6914', '#a0793a', '#6b5433', '#d4af37', '#4a3f2a']

type Slice = { label: string; value: number }

// Donut a segmenti fatto con stroke-dasharray su un cerchio SVG — stesso
// principio "niente libreria esterna" degli altri grafici di Spendly.
export default function CategoryDonutChart({ data }: { data: Slice[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const size = 160
  const radius = 60
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  if (total <= 0) return null

  // Ogni fetta parte dove finisce la precedente (end = inizio + lunghezza)
  const segments = data.reduce<Array<(typeof data)[number] & { color: string; dasharray: string; dashoffset: number; end: number }>>(
    (acc, d, i) => {
      const fraction = d.value / total
      const dash = fraction * circumference
      const offset = acc.length > 0 ? acc[acc.length - 1].end : 0
      return [
        ...acc,
        {
          ...d,
          color: PALETTE[i % PALETTE.length],
          dasharray: `${dash} ${circumference - dash}`,
          dashoffset: -offset,
          end: offset + dash,
        },
      ]
    },
    []
  )

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Ripartizione per categoria">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="var(--background)" strokeWidth={20} />
        {segments.map((s) => (
          <circle
            key={s.label}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={s.color}
            strokeWidth={20}
            strokeDasharray={s.dasharray}
            strokeDashoffset={s.dashoffset}
            transform={`rotate(-90 ${center} ${center})`}
          />
        ))}
      </svg>
      <div className="flex flex-col gap-1.5 text-sm">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-[var(--ink)]">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
