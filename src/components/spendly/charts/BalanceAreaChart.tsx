'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { monthNames } from '@/lib/spendly'
import { useChartScale } from './useChartScale'

type Point = { month: number; balance: number }

const LINE = '#B8892E'
const NEGATIVE = '#C4383A'

const fmt = (v: number) => `${v < 0 ? '−' : ''}${new Intl.NumberFormat('it-IT').format(Math.round(Math.abs(v)))} €`

// Passo «tondo» della griglia (100, 250, 500, 1.000…) per circa 4 righe
function niceStep(span: number) {
  const raw = span / 4 || 100
  const p = 10 ** Math.floor(Math.log10(raw))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= raw) return m * p
  return 10 * p
}

// Grafico ad area «Andamento del saldo» fatto a mano in SVG (nessuna
// libreria di grafici nel progetto). Il saldo è cumulativo: l'ultimo punto
// coincide con il Saldo netto della KPI card. In evidenza la cifra del mese
// indicato (oggi, o dicembre per gli anni passati) e il punto più basso;
// gli altri mesi si leggono passandoci sopra.
export default function BalanceAreaChart({ data, highlightMonth }: { data: Point[]; highlightMonth?: number }) {
  const t = useTranslations('spendly')
  const locale = useLocale()
  const monthShort = monthNames(locale, 'short')
  const monthLong = monthNames(locale)
  const [hover, setHover] = useState<number | null>(null)
  const k = useChartScale()

  const width = 700
  const height = k > 1 ? 330 : 240
  const last = Math.min(Math.max((highlightMonth ?? data.length) - 1, 0), data.length - 1)
  // Spazio a destra solo quando la cifra evidenziata è sull'ultimo mese
  const pad = { top: 20 * k, right: (last === data.length - 1 ? 92 : 16) * k, bottom: 26 * k, left: 52 * k }
  const innerW = width - pad.left - pad.right

  const values = data.map((d) => d.balance)
  const rawMax = Math.max(0, ...values)
  const rawMin = Math.min(0, ...values)
  const step = niceStep(rawMax - rawMin)
  const max = Math.ceil(rawMax / step) * step || step
  const min = Math.floor(rawMin / step) * step
  const ticks: number[] = []
  for (let v = min; v <= max + step / 2; v += step) ticks.push(v)

  const x = (i: number) => pad.left + (i / (data.length - 1 || 1)) * innerW
  const y = (v: number) => pad.top + ((max - v) / (max - min || 1)) * (height - pad.top - pad.bottom)
  const zeroY = y(0)

  const linePoints = data.map((d, i) => `${x(i)},${y(d.balance)}`).join(' ')
  const areaPoints = `${x(0)},${zeroY} ${linePoints} ${x(data.length - 1)},${zeroY}`

  // Punto più basso fino al mese evidenziato (escluso il primo mese, che parte da zero)
  let low = -1
  for (let i = 1; i < last; i++) if (low < 0 || values[i] < values[low]) low = i
  const showLow = low > 0 && values[low] < values[last] && values[low] < values[low - 1]

  // Vicino al fondo la cifra finale va sopra il punto, per non coprire i mesi
  const endUp = y(values[last]) > height - pad.bottom - 24 * k
  const lastLabel = highlightMonth && highlightMonth < 12 ? t('chartToday') : t('chartEndOfYear')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full touch-pan-y" role="img" aria-label={t('balanceTrend')} onPointerLeave={() => setHover(null)}>
      <defs>
        <linearGradient id="spendly-balance-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={LINE} stopOpacity={0.3} />
          <stop offset="1" stopColor={LINE} stopOpacity={0} />
        </linearGradient>
      </defs>

      {ticks.map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#cfc6b0' : '#ece7da'} />
          <text x={pad.left - 8} y={y(v) + 4 * k} textAnchor="end" className="fill-[var(--muted)]" fontSize={11 * k}>
            {new Intl.NumberFormat('it-IT').format(v)}
          </text>
        </g>
      ))}

      <polygon points={areaPoints} fill="url(#spendly-balance-fill)" />
      <polyline points={linePoints} fill="none" stroke={LINE} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {data.map((d, i) => (
        <g key={d.month}>
          {/* I mesi in cui il saldo va sotto zero restano segnati in rosso */}
          {d.balance < 0 && i !== last && <circle cx={x(i)} cy={y(d.balance)} r={4} fill={NEGATIVE} stroke="#fff" strokeWidth={2} />}
          <text x={x(i)} y={height - 8 * k} textAnchor="middle" className="fill-[var(--muted)]" fontSize={11 * k}>
            {monthShort[d.month - 1]}
          </text>
        </g>
      ))}

      {showLow && hover === null && (
        <g>
          <circle cx={x(low)} cy={y(values[low])} r={4.5} fill="#fff" stroke={values[low] < 0 ? NEGATIVE : LINE} strokeWidth={2} />
          <text x={x(low)} y={y(values[low]) + 20 * k} textAnchor="middle" className="fill-[var(--muted)]" fontSize={11 * k}>
            {fmt(values[low])}
          </text>
        </g>
      )}

      <circle cx={x(last)} cy={y(values[last])} r={6} fill={values[last] < 0 ? NEGATIVE : LINE} stroke="#fff" strokeWidth={2} />
      {last === data.length - 1 ? (
        <g>
          <text x={x(last) + 12} y={y(values[last]) + (endUp ? -18 : 4) * k} className="fill-[var(--ink)]" fontSize={13 * k} fontWeight={700}>
            {fmt(values[last])}
          </text>
          <text x={x(last) + 12} y={y(values[last]) + (endUp ? -4 : 18) * k} className="fill-[var(--muted)]" fontSize={10.5 * k}>
            {lastLabel}
          </text>
        </g>
      ) : (
        hover === null && (
          <g>
            <text x={x(last)} y={y(values[last]) - 22 * k} textAnchor="middle" className="fill-[var(--ink)]" fontSize={13 * k} fontWeight={700}>
              {fmt(values[last])}
            </text>
            <text x={x(last)} y={y(values[last]) - 10 * k} textAnchor="middle" className="fill-[var(--muted)]" fontSize={10.5 * k}>
              {lastLabel}
            </text>
          </g>
        )
      )}

      {hover !== null && (
        <g pointerEvents="none">
          <line x1={x(hover)} x2={x(hover)} y1={pad.top} y2={height - pad.bottom} stroke="#cfc6b0" strokeDasharray="3 3" />
          <circle cx={x(hover)} cy={y(values[hover])} r={5} fill={LINE} stroke="#fff" strokeWidth={2} />
          {(() => {
            const boxW = 130 * k
            const bx = Math.min(Math.max(x(hover) - boxW / 2, pad.left), width - pad.right - boxW)
            return (
              <g>
                <rect x={bx} y={0} width={boxW} height={38 * k} rx={8} fill="#fffdf7" stroke="#e6dcc2" />
                <text x={bx + 10 * k} y={15 * k} className="fill-[var(--muted)]" fontSize={11 * k}>
                  {monthLong[data[hover].month - 1]}
                </text>
                <text x={bx + 10 * k} y={31 * k} className="fill-[var(--ink)]" fontSize={12 * k} fontWeight={700}>
                  {fmt(values[hover])}
                </text>
              </g>
            )
          })()}
        </g>
      )}

      {data.map((d, i) => (
        <rect
          key={`hit-${d.month}`}
          x={x(i) - innerW / (2 * Math.max(1, data.length - 1))}
          y={pad.top}
          width={innerW / Math.max(1, data.length - 1)}
          height={height - pad.top}
          fill="transparent"
          onPointerEnter={() => setHover(i)}
          onClick={() => setHover(i)}
        />
      ))}
    </svg>
  )
}
