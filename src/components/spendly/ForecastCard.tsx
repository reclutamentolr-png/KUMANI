'use client'

import { useLocale, useTranslations } from 'next-intl'
import { TrendingUp } from 'lucide-react'
import type { MonthForecast } from '@/lib/spendlyForecast'

// «Come finirà il mese»: speso finora, previsione con la fascia «tra … e …»,
// barra del mese e (se ci sono le entrate) quanto resterebbe. Usato in
// Spendly e nelle spese condivise.
export default function ForecastCard({ forecast, monthName, income = null }: { forecast: MonthForecast; monthName: string; income?: number | null }) {
  const t = useTranslations('spendly')
  const locale = useLocale()
  const eur = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
  const max = Math.max(forecast.high, forecast.spent, 1)
  const pct = (n: number) => `${Math.min(100, (n / max) * 100)}%`
  const left = income !== null && income > 0 ? income - forecast.expected : null

  return (
    <section className="rounded-2xl border border-[var(--gold)]/40 bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-base font-bold text-[var(--ink)]">
        <TrendingUp className="h-5 w-5 text-[var(--gold)]" /> {t('forecastTitle', { month: monthName })}
      </h2>
      <p className="mt-2 text-sm text-gray-700">
        {t('forecastSpent', { spent: eur(forecast.spent), day: forecast.day, days: forecast.days })}{' '}
        <strong className="text-[var(--ink)]">{t('forecastExpected', { month: monthName, expected: eur(forecast.expected) })}</strong>{' '}
        {forecast.high - forecast.low >= 1 && t('forecastRange', { low: eur(forecast.low), high: eur(forecast.high) })}
      </p>
      {/* Barra: speso finora (pieno), fascia prevista (tratteggio chiaro), previsione (segno) */}
      <div className="relative mt-3 h-3 overflow-hidden rounded-full bg-gray-100" aria-hidden>
        <div className="absolute inset-y-0 bg-[var(--gold)]/25" style={{ left: pct(forecast.low), width: `calc(${pct(forecast.high)} - ${pct(forecast.low)})` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--gold)]" style={{ width: pct(forecast.spent) }} />
        <div className="absolute inset-y-0 w-0.5 bg-[var(--ink)]" style={{ left: pct(forecast.expected) }} />
      </div>
      {left !== null && (
        <p className={`mt-3 text-sm font-semibold ${left >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
          {left >= 0 ? t('forecastLeft', { amount: eur(left) }) : t('forecastOver', { amount: eur(-left) })}
        </p>
      )}
      <p className="mt-2 text-xs text-gray-500">{forecast.uncertain ? t('forecastUncertain') : t('forecastHow')}</p>
    </section>
  )
}
