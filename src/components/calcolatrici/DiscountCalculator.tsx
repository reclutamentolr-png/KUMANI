'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X } from 'lucide-react'
import { cascadeDiscount, discountByAmount, discountByPercent } from '@/lib/calculators'
import { Card, EmptyResult, Note, NumberField, ResultPanel, Segmented, parsePositive, useFormatters, useReportResult, type ResultLine } from './ui'

type Mode = 'percent' | 'amount' | 'cascade'

const MAX_STEPS = 5

export default function DiscountCalculator() {
  const t = useTranslations('calcolatrici')
  const { money, percent } = useFormatters()
  const [mode, setMode] = useState<Mode>('percent')
  const [price, setPrice] = useState('')
  const [discount, setDiscount] = useState('')
  const [steps, setSteps] = useState<string[]>(['20', '10'])

  const priceValue = parsePositive(price)
  const discountValue = parsePositive(discount)
  const stepValues = steps.map(parsePositive)
  const percentTooHigh = (value: number | null) => (value !== null && value > 100 ? t('discountTooHigh') : null)
  const amountTooHigh = mode === 'amount' && discountValue !== null && priceValue !== null && discountValue > priceValue ? t('amountTooHigh') : null

  let result = null
  if (priceValue !== null) {
    if (mode === 'percent' && discountValue !== null && discountValue <= 100) result = discountByPercent(priceValue, discountValue)
    if (mode === 'amount' && discountValue !== null && !amountTooHigh) result = discountByAmount(priceValue, discountValue)
    if (mode === 'cascade' && stepValues.every((v) => v !== null && v <= 100)) result = cascadeDiscount(priceValue, stepValues as number[])
  }

  useReportResult(result ? `ds:${mode}:${result.price}:${result.finalPrice}` : null)

  const lines: ResultLine[] = []
  if (result) {
    lines.push({ label: t('dsFinal'), value: money(result.finalPrice), highlight: true })
    lines.push({ label: t('dsPrice'), value: money(result.price) })
    if (mode === 'cascade') {
      steps.forEach((step, i) => lines.push({ label: t('dsStep', { n: i + 1 }), value: percent(stepValues[i] ?? 0) }))
    }
    lines.push({ label: t('dsSaving'), value: money(result.saving), negative: true })
    lines.push({ label: mode === 'cascade' ? t('dsEquivalent') : t('dsPercent'), value: percent(result.percent) })
  }

  return (
    <div className="space-y-5">
      <Card title={t('dsTitle')}>
        <NumberField id="ds-price" label={t('dsPrice')} value={price} onChange={setPrice} suffix="€" help={t('decimalHint')} />
        <Segmented
          label={t('dsTitle')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'percent', label: t('dsModePercent') },
            { value: 'amount', label: t('dsModeAmount') },
            { value: 'cascade', label: t('dsModeCascade') },
          ]}
        />
        {mode === 'percent' && (
          <NumberField id="ds-percent" label={t('dsDiscountPercent')} value={discount} onChange={setDiscount} suffix="%" error={percentTooHigh(discountValue)} />
        )}
        {mode === 'amount' && (
          <NumberField id="ds-amount" label={t('dsDiscountAmount')} value={discount} onChange={setDiscount} suffix="€" error={amountTooHigh} />
        )}
        {mode === 'cascade' && (
          <div className="space-y-3">
            <p className="text-xs leading-5 text-[var(--muted)]">{t('dsCascadeHelp')}</p>
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2">
                <div className="flex-1">
                  <NumberField
                    id={`ds-step-${i}`}
                    label={t('dsStep', { n: i + 1 })}
                    value={step}
                    onChange={(value) => setSteps((prev) => prev.map((s, j) => (j === i ? value : s)))}
                    suffix="%"
                    error={percentTooHigh(stepValues[i])}
                  />
                </div>
                {steps.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setSteps((prev) => prev.filter((_, j) => j !== i))}
                    aria-label={t('dsRemove')}
                    title={t('dsRemove')}
                    className="mt-7 rounded-xl border border-gray-200 bg-white p-3 text-gray-500 hover:border-red-300 hover:text-red-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
            {steps.length < MAX_STEPS && (
              <button
                type="button"
                onClick={() => setSteps((prev) => [...prev, ''])}
                className="flex items-center gap-2 rounded-lg border border-dashed border-[var(--gold)] px-3.5 py-2 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]/40"
              >
                <Plus className="h-4 w-4" /> {t('dsAddStep')}
              </button>
            )}
            <Note>{t('dsCascadeExample')}</Note>
          </div>
        )}
      </Card>

      {result ? <ResultPanel title={t('dsTitle')} lines={lines} /> : <EmptyResult />}
    </div>
  )
}
