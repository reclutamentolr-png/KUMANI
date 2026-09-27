'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, TrendingUp, Repeat, Wallet, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import YearSelect from './YearSelect'
import {
  computeMonthlyTotals,
  computeMonthCapacity,
  formatCurrency,
  currentYearOnly,
  MONTH_NAMES_IT,
  MONTH_SHORT_IT,
  type SpendlyIncome,
  type SpendlyFixedExpense,
  type SpendlyFixedPayment,
  type SpendlyVariableExpense,
  type BudgetStatus,
} from '@/lib/spendly'

const STATUS_STYLE: Record<BudgetStatus, { bar: string; text: string; icon: typeof CheckCircle2 }> = {
  positivo: { bar: 'bg-[var(--gold)]', text: 'text-[var(--gold)]', icon: CheckCircle2 },
  in_guardia: { bar: 'bg-orange-400', text: 'text-orange-500', icon: AlertTriangle },
  critico: { bar: 'bg-red-500', text: 'text-red-600', icon: XCircle },
}

export default function SpendlyCapacity({
  income,
  fixedExpenses,
  payments = [],
  variableExpenses,
  year,
}: {
  income: SpendlyIncome[]
  fixedExpenses: SpendlyFixedExpense[]
  payments?: SpendlyFixedPayment[]
  variableExpenses: SpendlyVariableExpense[]
  year: number
}) {
  const t = useTranslations('spendly')
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)

  const capacities = useMemo(() => {
    const totals = computeMonthlyTotals(income, fixedExpenses, variableExpenses, year, payments)
    return totals.map(computeMonthCapacity)
  }, [income, fixedExpenses, variableExpenses, year, payments])

  const selected = capacities[selectedMonth - 1]
  const style = STATUS_STYLE[selected.status]
  const StatusIcon = style.icon

  const statusMessage =
    selected.status === 'critico' ? t('statusOverBudget') : selected.status === 'in_guardia' ? t('statusOnTrackWarning') : t('statusOnTrack')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--ink)]">{t('capacityPageTitle')}</h2>
          <p className="text-sm text-[var(--muted)]">{t('capacityPageDescription')}</p>
        </div>
        <YearSelect year={year} years={currentYearOnly()} />
      </div>

      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedMonth((m) => (m === 1 ? 1 : m - 1))}
          className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--gold)]/30 text-[var(--ink)] hover:bg-[var(--gold)]/10 disabled:opacity-30"
          disabled={selectedMonth === 1}
          aria-label="Mese precedente"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        {MONTH_SHORT_IT.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setSelectedMonth(i + 1)}
            className={`shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedMonth === i + 1 ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'text-[var(--ink)] hover:bg-[var(--gold)]/10'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setSelectedMonth((m) => (m === 12 ? 12 : m + 1))}
          className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--gold)]/30 text-[var(--ink)] hover:bg-[var(--gold)]/10 disabled:opacity-30"
          disabled={selectedMonth === 12}
          aria-label="Mese successivo"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-6 mb-8">
        <h3 className="text-lg font-bold text-[var(--ink)]">{MONTH_NAMES_IT[selectedMonth - 1]} {year}</h3>
        <p className="text-xs text-[var(--muted)] mb-4">{t('capacityFormula')}</p>

        <div className="space-y-3">
          <Row icon={TrendingUp} label={t('totalIncomeRow')} value={formatCurrency(selected.income)} />
          <Row icon={Repeat} label={t('fixedExpensesRow')} value={`- ${formatCurrency(selected.fixedExpenses)}`} negative />
          <Row icon={Wallet} label={t('variableExpensesRow')} value={`- ${formatCurrency(selected.variableExpenses)}`} negative />
          <div className="border-t border-[var(--gold)]/15 pt-3">
            <Row icon={StatusIcon} label={t('availableBudgetRow')} value={formatCurrency(selected.remaining)} bold negative={selected.remaining < 0} />
          </div>
        </div>

        <div className="mt-5">
          <div className="flex justify-between text-sm font-bold text-[var(--ink)] mb-1">
            <span>{t('budgetUsed')}</span>
            <span>{selected.usedPercent}%</span>
          </div>
          <div className="h-2.5 rounded-full bg-[var(--background)] overflow-hidden">
            <div className={`h-full rounded-full ${style.bar}`} style={{ width: `${Math.min(100, selected.usedPercent)}%` }} />
          </div>
        </div>

        <div className={`flex items-center gap-2 mt-3 text-sm ${style.text}`}>
          <StatusIcon className="w-4 h-4" />
          {statusMessage}
        </div>
      </div>

      <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] overflow-hidden">
        <h3 className="text-sm font-bold text-[var(--ink)] px-5 pt-5 pb-2">{t('allMonths')} · {year}</h3>
        <ul className="divide-y divide-[var(--gold)]/10">
          {capacities.map((c) => {
            const s = STATUS_STYLE[c.status]
            return (
              <li key={c.month} className="flex items-center gap-4 px-5 py-3">
                <span className="w-20 shrink-0 text-sm font-medium text-[var(--ink)]">{MONTH_NAMES_IT[c.month - 1]}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--background)] overflow-hidden">
                  <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${Math.min(100, c.usedPercent)}%` }} />
                </div>
                <span className={`w-24 shrink-0 text-right text-sm font-semibold ${c.remaining < 0 ? 'text-red-600' : 'text-[var(--ink)]'}`}>
                  {formatCurrency(c.remaining)}
                </span>
                <span className="w-12 shrink-0 text-right text-xs text-[var(--muted)]">{c.usedPercent}%</span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

function Row({
  icon: Icon,
  label,
  value,
  negative,
  bold,
}: {
  icon: typeof TrendingUp
  label: string
  value: string
  negative?: boolean
  bold?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Icon className="w-4 h-4 text-[var(--gold)]" />
        {label}
      </span>
      <span className={`${bold ? 'font-bold text-base' : 'font-medium text-sm'} ${negative ? 'text-red-600' : 'text-[var(--ink)]'}`}>{value}</span>
    </div>
  )
}
