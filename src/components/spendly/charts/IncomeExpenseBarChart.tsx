'use client'

import { useLocale } from 'next-intl'
import { monthNames } from '@/lib/spendly'

type Point = { month: number; income: number; expenses: number }

// Nessuna libreria di grafici è già presente nel progetto (verificato prima
// di iniziare) — per non introdurre una nuova dipendenza solo per Spendly,
// questi grafici sono semplice SVG disegnato a mano, sullo stesso principio
// dei mini-grafici già presenti altrove nell'app.
export default function IncomeExpenseBarChart({ data }: { data: Point[] }) {
  const locale = useLocale()
  const monthShort = monthNames(locale, 'short')
  const width = 700
  const height = 220
  const padding = { top: 16, right: 12, bottom: 24, left: 12 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expenses)))
  const groupW = innerW / data.length
  const barW = Math.min(14, groupW * 0.32)

  const barHeight = (v: number) => (v / max) * innerH
  const groupX = (i: number) => padding.left + i * groupW + groupW / 2

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Entrate vs Spese">
      <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} stroke="currentColor" className="text-[var(--gold)]/20" />
      {data.map((d, i) => {
        const cx = groupX(i)
        const incomeH = barHeight(d.income)
        const expenseH = barHeight(d.expenses)
        const baseY = height - padding.bottom
        return (
          <g key={d.month}>
            <rect x={cx - barW - 2} y={baseY - incomeH} width={barW} height={incomeH} rx={2} fill="var(--gold-bright)" />
            <rect x={cx + 2} y={baseY - expenseH} width={barW} height={expenseH} rx={2} fill="#dc2626" fillOpacity={0.8} />
            <text x={cx} y={height - 4} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">
              {monthShort[d.month - 1]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
