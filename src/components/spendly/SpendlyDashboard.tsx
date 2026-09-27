'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { TrendingUp, Repeat, Wallet, PiggyBank, AlertTriangle } from 'lucide-react'
import KpiCard from './KpiCard'
import YearSelect from './YearSelect'
import BalanceAreaChart from './charts/BalanceAreaChart'
import IncomeExpenseBarChart from './charts/IncomeExpenseBarChart'
import CategoryDonutChart from './charts/CategoryDonutChart'
import {
  computeMonthlyTotals,
  formatCurrency,
  dashboardYears,
  MONTH_NAMES_IT,
  VARIABLE_EXPENSE_CATEGORIES,
  type SpendlyIncome,
  type SpendlyFixedExpense,
  type SpendlyFixedPayment,
  type SpendlyVariableExpense,
  type VariableExpenseCategory,
} from '@/lib/spendly'

const CATEGORY_KEY: Record<VariableExpenseCategory, string> = {
  spesa_alimentari: 'categorySpesaAlimentari',
  svago_ristoranti: 'categorySvagoRistoranti',
  trasporti: 'categoryTrasporti',
  salute: 'categorySalute',
  casa: 'categoryCasa',
  shopping: 'categoryShopping',
  altro: 'categoryAltro',
}

export default function SpendlyDashboard({
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

  const monthly = useMemo(
    () => computeMonthlyTotals(income, fixedExpenses, variableExpenses, year, payments),
    [income, fixedExpenses, variableExpenses, year, payments]
  )

  const totalIncome = monthly.reduce((s, m) => s + m.income, 0)
  const totalFixed = monthly.reduce((s, m) => s + m.fixedExpenses, 0)
  const totalVariable = monthly.reduce((s, m) => s + m.variableExpenses, 0)
  const netBalance = totalIncome - totalFixed - totalVariable

  // "Andamento del saldo" deve mostrare l'evoluzione cumulativa nel tempo
  // (come un vero saldo di conto), non il risultato netto del singolo mese:
  // l'ultimo punto del grafico deve coincidere con il Saldo netto annuale
  // mostrato nella KPI card qui sopra.
  const cumulativeBalance = useMemo(() => {
    let running = 0
    return monthly.map((m) => {
      running += m.balance
      return { month: m.month, balance: running }
    })
  }, [monthly])

  const selected = monthly[selectedMonth - 1]

  const selectedCategoryData = VARIABLE_EXPENSE_CATEGORIES.map((c) => ({
    label: t(CATEGORY_KEY[c]),
    value: variableExpenses
      .filter((e) => {
        const d = new Date(e.expense_date)
        return e.category === c && d.getUTCFullYear() === year && d.getUTCMonth() + 1 === selectedMonth
      })
      .reduce((s, e) => s + e.amount, 0),
  })).filter((c) => c.value > 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-[var(--ink)]">{t('dashboardTitle')}</h2>
          <p className="text-sm text-[var(--muted)]">{t('dashboardDescription')}</p>
        </div>
        <YearSelect year={year} years={dashboardYears()} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label={t('totalIncomeCard')} value={formatCurrency(totalIncome)} icon={TrendingUp} tone="positive" />
        <KpiCard label={t('fixedExpensesCard')} value={formatCurrency(totalFixed)} icon={Repeat} />
        <KpiCard label={t('variableExpensesCard')} value={formatCurrency(totalVariable)} icon={Wallet} tone="negative" />
        <KpiCard label={t('netBalanceCard')} value={formatCurrency(netBalance)} icon={PiggyBank} tone={netBalance < 0 ? 'negative' : 'positive'} />
      </div>

      <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-5 mb-6">
        <h3 className="text-sm font-bold text-[var(--ink)] mb-2">{t('balanceTrend')}</h3>
        <BalanceAreaChart data={cumulativeBalance} />
      </div>

      <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-5 mb-6">
        <h3 className="text-sm font-bold text-[var(--ink)] mb-2">{t('incomeVsExpenses')}</h3>
        <IncomeExpenseBarChart data={monthly.map((m) => ({ month: m.month, income: m.income, expenses: m.fixedExpenses + m.variableExpenses }))} />
      </div>

      <div className="flex items-center justify-between mb-4 mt-8">
        <div>
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('monthlyMonitoring')}</h3>
          <p className="text-sm text-[var(--muted)]">{t('monthlyMonitoringDescription')}</p>
        </div>
        <select
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          className="rounded-lg border border-[var(--gold)]/30 bg-[var(--paper)] px-3 py-2 text-sm font-medium text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]"
        >
          {MONTH_NAMES_IT.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label={t('totalIncomeCard')} value={formatCurrency(selected.income)} icon={TrendingUp} tone="positive" />
        <KpiCard label={t('fixedExpensesCard')} value={formatCurrency(selected.fixedExpenses)} icon={Repeat} />
        <KpiCard label={t('variableExpensesCard')} value={formatCurrency(selected.variableExpenses)} icon={Wallet} tone="negative" />
        <KpiCard label={t('netBalanceCard')} value={formatCurrency(selected.balance)} icon={PiggyBank} tone={selected.balance < 0 ? 'negative' : 'positive'} />
      </div>

      <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-5 mb-8">
        <h3 className="text-sm font-bold text-[var(--ink)] mb-3">{t('variableExpensesByCategory', { month: MONTH_NAMES_IT[selectedMonth - 1] })}</h3>
        {selectedCategoryData.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t('noDataToShow')}</p>
        ) : (
          <CategoryDonutChart data={selectedCategoryData} />
        )}
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-[var(--muted)]">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)]" /> {t('statusPositive')}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> {t('statusWarning')}</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> {t('statusCritical')}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {monthly.map((m) => {
          const negative = m.balance < 0
          return (
            <div
              key={m.month}
              className={`rounded-xl border p-4 ${negative ? 'border-red-300 bg-red-50' : 'border-[var(--gold)]/20 bg-[var(--paper)]'}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-[var(--ink)] text-sm">{MONTH_NAMES_IT[m.month - 1]}</span>
                {negative && <AlertTriangle className="w-4 h-4 text-red-500" />}
              </div>
              <dl className="space-y-1 text-xs text-[var(--muted)]">
                <div className="flex justify-between"><dt>{t('navIncome')}</dt><dd>{formatCurrency(m.income)}</dd></div>
                <div className="flex justify-between"><dt>{t('navFixedExpenses')}</dt><dd>-{formatCurrency(m.fixedExpenses)}</dd></div>
                <div className="flex justify-between"><dt>{t('navVariableExpenses')}</dt><dd>-{formatCurrency(m.variableExpenses)}</dd></div>
              </dl>
              <div className={`flex justify-between mt-2 pt-2 border-t text-sm font-bold ${negative ? 'border-red-200 text-red-600' : 'border-[var(--gold)]/15 text-[var(--gold)]'}`}>
                <span>{t('netBalanceCard')}</span>
                <span>{formatCurrency(m.balance)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
