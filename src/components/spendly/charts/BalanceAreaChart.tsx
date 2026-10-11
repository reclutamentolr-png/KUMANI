'use client'

import { useLocale } from 'next-intl'
import { monthNames } from '@/lib/spendly'

type Point = { month: number; balance: number }

// Grafico ad area "Andamento del saldo" fatto a mano in SVG (nessuna
// libreria di grafici nel progetto — vedi commento in
// src/components/spendly/charts/IncomeExpenseBarChart.tsx). Gestisce saldi
// negativi disegnando una linea di zero e scalando min/max sui dati reali;
// le etichette in euro (solo sul lato destro) sono agganciate all'altezza
// reale del picco/minimo del saldo, non a un valore "gonfiato" dal margine
// di respiro del grafico, così corrispondono esattamente a ciò che la
// curva mostra.
export default function BalanceAreaChart({ data }: { data: Point[] }) {
  const locale = useLocale()
  const monthShort = monthNames(locale, 'short')
  const width = 700
  const height = 240
  const padding = { top: 16, right: 60, bottom: 24, left: 16 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const values = data.map((d) => d.balance)
  const rawMax = Math.max(0, ...values)
  const rawMin = Math.min(0, ...values)
  const span = rawMax - rawMin || 1
  const max = rawMax + span * 0.1
  const min = rawMin - span * 0.1

  const x = (i: number) => padding.left + (i / (data.length - 1 || 1)) * innerW
  const y = (v: number) => padding.top + innerH - ((v - min) / (max - min)) * innerH
  const zeroY = y(0)
  const maxValY = y(rawMax)
  const minValY = y(rawMin)

  const linePoints = data.map((d, i) => `${x(i)},${y(d.balance)}`).join(' ')
  const areaPoints = `${x(0)},${zeroY} ${linePoints} ${x(data.length - 1)},${zeroY}`

  // Etichette assi compatte (senza decimali) per stare nello spazio a lato
  // del grafico — il valore esatto è già visibile nelle KPI card sopra.
  const axisLabel = (value: number) => `${new Intl.NumberFormat('it-IT').format(Math.round(value))} €`

  const showZeroLabel = rawMax > 0 && rawMin < 0 && zeroY > maxValY + 10 && zeroY < minValY - 10
  const sameValue = rawMax === rawMin

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Andamento del saldo">
      <line x1={padding.left} y1={zeroY} x2={width - padding.right} y2={zeroY} stroke="currentColor" className="text-[var(--gold)]/25" strokeDasharray="4 4" />
      <polygon points={areaPoints} fill="var(--gold)" fillOpacity={0.15} />
      <polyline points={linePoints} fill="none" stroke="var(--gold)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={d.month} cx={x(i)} cy={y(d.balance)} r={3} fill={d.balance < 0 ? '#dc2626' : 'var(--gold-bright)'} />
      ))}
      {data.map((d, i) => (
        <text key={d.month} x={x(i)} y={height - 4} textAnchor="middle" className="fill-[var(--muted)] text-[10px]">
          {monthShort[d.month - 1]}
        </text>
      ))}

      {/* Valore massimo del saldo, all'altezza reale in cui la curva lo raggiunge */}
      <text x={width - padding.right + 8} y={maxValY + 4} textAnchor="start" className="fill-[var(--muted)] text-[10px] font-medium">
        {axisLabel(rawMax)}
      </text>

      {/* Linea dello zero, solo se il saldo attraversa davvero sia positivo che negativo */}
      {showZeroLabel && (
        <text x={width - padding.right + 8} y={zeroY + 4} textAnchor="start" className="fill-[var(--muted)] text-[10px] font-medium">
          € 0
        </text>
      )}

      {/* Valore minimo del saldo, all'altezza reale in cui la curva lo raggiunge */}
      {!sameValue && (
        <text x={width - padding.right + 8} y={minValY + 4} textAnchor="start" className="fill-[var(--muted)] text-[10px] font-medium">
          {axisLabel(rawMin)}
        </text>
      )}
    </svg>
  )
}
