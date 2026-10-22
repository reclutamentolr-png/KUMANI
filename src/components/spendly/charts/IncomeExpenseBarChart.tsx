'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { monthNames } from '@/lib/spendly'
import { useChartScale } from './useChartScale'

type Point = { month: number; income: number; expenses: number }
type View = 'net' | 'split'

// Colori validati per chi non distingue bene i colori (oro/blu per le due
// serie). Rosso e verde sono riservati al risultato del mese: verde = hai
// risparmiato, rosso = hai speso più di quanto è entrato.
const INCOME = '#B8892E'
const EXPENSE = '#4A6FB5'
const POSITIVE = '#2E7D4F'
const NEGATIVE = '#C4383A'

const fmt = (v: number) => `${new Intl.NumberFormat('it-IT').format(Math.round(Math.abs(v)))} €`
const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(v)}`

// Scala «tonda» per la griglia: 500, 1.000, 2.500, 5.000…
function niceLimit(v: number) {
  if (v <= 0) return 100
  const p = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p
  return 10 * p
}

// Barra con l'estremità arrotondata dal lato del valore e base piatta sullo zero
function barPath(x: number, w: number, y0: number, y1: number) {
  const h = Math.abs(y1 - y0)
  if (h < 0.5) return ''
  const r = Math.min(4, h, w / 2)
  if (y1 < y0) {
    return `M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + r} V${y0} Z`
  }
  return `M${x},${y0} V${y1 - r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 - r} V${y0} Z`
}

// Grafico mensile di Spendly, fatto a mano in SVG (nessuna libreria di
// grafici nel progetto). Due viste: «Saldo di ogni mese» (predefinita, una
// barra sopra o sotto lo zero) ed «Entrate e spese» (entrate sopra, spese
// sotto, con il pallino del saldo).
export default function IncomeExpenseBarChart({ data }: { data: Point[] }) {
  const t = useTranslations('spendly')
  const locale = useLocale()
  const monthShort = monthNames(locale, 'short')
  const monthLong = monthNames(locale)
  const [view, setView] = useState<View>('net')
  const [hover, setHover] = useState<number | null>(null)
  const k = useChartScale()

  const width = 700
  const height = k > 1 ? 330 : 240
  const pad = { top: 18, right: 10, bottom: 26 * k, left: 52 * k }
  const innerW = width - pad.left - pad.right
  const groupW = innerW / Math.max(1, data.length)
  const net = data.map((d) => d.income - d.expenses)

  const limit = niceLimit(view === 'net' ? Math.max(...net.map(Math.abs), 0) : Math.max(...data.flatMap((d) => [d.income, d.expenses]), 0))
  const y = (v: number) => pad.top + ((limit - v) / (2 * limit)) * (height - pad.top - pad.bottom)
  const zeroY = y(0)
  const ticks = [limit, limit / 2, 0, -limit / 2, -limit]
  const barW = Math.min(view === 'net' ? 34 : 30, groupW * (view === 'net' ? 0.56 : 0.5))

  // Valore scritto solo sul mese migliore e peggiore; gli altri al passaggio
  const hasData = net.some((v) => v !== 0)
  const best = hasData ? net.indexOf(Math.max(...net)) : -1
  const worst = hasData ? net.indexOf(Math.min(...net)) : -1

  const tip = hover !== null ? data[hover] : null

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[var(--ink)]">{view === 'net' ? t('monthlyNet') : t('incomeVsExpenses')}</h3>
        <div role="tablist" className="inline-flex rounded-lg border border-[var(--gold)]/30 p-0.5 text-xs font-semibold">
          {(['net', 'split'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1.5 ${view === v ? 'bg-[var(--gold)]/15 text-[var(--ink)]' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}
            >
              {v === 'net' ? t('chartViewNet') : t('chartViewSplit')}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
        {(view === 'net'
          ? [
              [POSITIVE, t('legendMonthPositive')],
              [NEGATIVE, t('legendMonthNegative')],
            ]
          : [
              [INCOME, t('legendIncome')],
              [EXPENSE, t('legendExpenses')],
              [POSITIVE, t('legendNetPositive')],
              [NEGATIVE, t('legendNetNegative')],
            ]
        ).map(([c, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <i className={`inline-block h-2.5 w-2.5 ${view === 'split' && (c === POSITIVE || c === NEGATIVE) ? 'rounded-full' : 'rounded-[3px]'}`} style={{ background: c }} />
            {label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full touch-pan-y" role="img" aria-label={view === 'net' ? t('monthlyNet') : t('incomeVsExpenses')} onPointerLeave={() => setHover(null)}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={pad.left} x2={width - pad.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#cfc6b0' : '#ece7da'} />
            <text x={pad.left - 8} y={y(v) + 4 * k} textAnchor="end" className="fill-[var(--muted)]" fontSize={11 * k}>
              {/* Nella vista entrate/spese le spese scendono, ma la scala resta in positivo */}
              {new Intl.NumberFormat('it-IT').format(view === 'split' ? Math.abs(v) : v)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = pad.left + i * groupW + groupW / 2
          const x = cx - barW / 2
          const dim = hover !== null && hover !== i ? 0.45 : 1
          return (
            <g key={d.month} opacity={dim}>
              {view === 'net' ? (
                <path d={barPath(x, barW, zeroY, y(net[i]))} fill={net[i] >= 0 ? POSITIVE : NEGATIVE} />
              ) : (
                <>
                  {d.income > 0 && <path d={barPath(x, barW, zeroY - 1, y(d.income))} fill={INCOME} />}
                  {d.expenses > 0 && <path d={barPath(x, barW, zeroY + 1, y(-d.expenses))} fill={EXPENSE} />}
                  {(d.income > 0 || d.expenses > 0) && <circle cx={cx} cy={y(net[i])} r={5} fill={net[i] >= 0 ? POSITIVE : NEGATIVE} stroke="#fff" strokeWidth={2} />}
                </>
              )}
              {view === 'net' && (i === best || i === worst) && net[i] !== 0 && hover === null && (
                <text x={cx} y={net[i] >= 0 ? y(net[i]) - 6 : y(net[i]) + 15 * k} textAnchor="middle" className="fill-[var(--ink)]" fontSize={12 * k} fontWeight={700}>
                  {signed(net[i])}
                </text>
              )}
              <text x={cx} y={height - 8 * k} textAnchor="middle" className="fill-[var(--muted)]" fontSize={11 * k}>
                {monthShort[d.month - 1]}
              </text>
              {/* Area sensibile più grande della barra, comoda anche col dito */}
              <rect x={pad.left + i * groupW} y={pad.top} width={groupW} height={height - pad.top} fill="transparent" onPointerEnter={() => setHover(i)} onClick={() => setHover(i)} />
            </g>
          )
        })}

        {tip && hover !== null && (() => {
          const cx = pad.left + hover * groupW + groupW / 2
          const boxW = 150 * k
          const boxX = Math.min(Math.max(cx - boxW / 2, pad.left), width - pad.right - boxW)
          const n = net[hover]
          return (
            <g pointerEvents="none">
              <rect x={boxX} y={2} width={boxW} height={80 * k} rx={8} fill="#fffdf7" stroke="#e6dcc2" />
              <text x={boxX + 10 * k} y={20 * k} className="fill-[var(--ink)]" fontSize={12 * k} fontWeight={700}>
                {monthLong[tip.month - 1]}
              </text>
              <text x={boxX + 10 * k} y={38 * k} className="fill-[var(--muted)]" fontSize={11 * k}>
                {t('legendIncome')}: {fmt(tip.income)}
              </text>
              <text x={boxX + 10 * k} y={54 * k} className="fill-[var(--muted)]" fontSize={11 * k}>
                {t('legendExpenses')}: {fmt(tip.expenses)}
              </text>
              <text x={boxX + 10 * k} y={71 * k} className="fill-[var(--ink)]" fontSize={11 * k} fontWeight={700}>
                {t('chartNet')}: {signed(n)}
              </text>
            </g>
          )
        })()}
      </svg>
    </div>
  )
}
