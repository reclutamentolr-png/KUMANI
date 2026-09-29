'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { computeVat, type VatMode } from '@/lib/calculators'
import { Card, EmptyResult, Note, NumberField, ResultPanel, Segmented, parsePositive, useFormatters, useReportResult } from './ui'

// Aliquote italiane proposte come scorciatoie (esempi)
const IT_RATES = ['22', '10', '5', '4'] as const
type RateChoice = (typeof IT_RATES)[number] | 'custom'

// Aliquota ordinaria di esempio per le lingue diverse dall'italiano
const LOCALE_DEFAULT_RATE: Record<string, string> = {
  en: '20',
  fr: '20',
  de: '19',
  es: '21',
  pt: '23',
  ru: '22',
}

export default function VatCalculator() {
  const t = useTranslations('calcolatrici')
  const { locale, money, percent } = useFormatters()
  const localeRate = LOCALE_DEFAULT_RATE[locale]
  const [mode, setMode] = useState<VatMode>('add')
  const [amount, setAmount] = useState('')
  const [choice, setChoice] = useState<RateChoice>(localeRate ? 'custom' : '22')
  const [customRate, setCustomRate] = useState(localeRate ?? '')

  const rateValue = choice === 'custom' ? parsePositive(customRate) : Number(choice)
  const rateError = choice === 'custom' && rateValue !== null && rateValue > 100 ? t('rateTooHigh') : null
  const amountValue = parsePositive(amount)

  const result = useMemo(() => {
    if (amountValue === null || rateValue === null || rateValue > 100) return null
    return computeVat(mode, amountValue, rateValue)
  }, [mode, amountValue, rateValue])

  useReportResult(result ? `vat:${mode}:${result.net}:${result.rate}` : null)

  return (
    <div className="space-y-5">
      <Card title={t('vatTitle')}>
        <Segmented
          label={t('vatTitle')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'add', label: t('vatModeAdd') },
            { value: 'extract', label: t('vatModeExtract') },
          ]}
        />
        <NumberField
          id="vat-amount"
          label={mode === 'add' ? t('vatAmountNet') : t('vatAmountGross')}
          value={amount}
          onChange={setAmount}
          suffix="€"
          help={t('decimalHint')}
        />
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--ink)]">{t('vatRate')}</p>
          <Segmented
            label={t('vatRate')}
            value={choice}
            onChange={setChoice}
            options={[...IT_RATES.map((r) => ({ value: r, label: `${r}%` })), { value: 'custom' as const, label: t('vatCustom') }]}
          />
        </div>
        {choice === 'custom' && (
          <NumberField id="vat-custom-rate" label={t('vatCustomLabel')} value={customRate} onChange={setCustomRate} suffix="%" error={rateError} />
        )}
        <Note>{t('vatRatesNote')}</Note>
      </Card>

      {result ? (
        <ResultPanel
          title={`${t('vatTitle')} (${percent(result.rate)})`}
          lines={[
            { label: mode === 'add' ? t('vatGross') : t('vatNet'), value: money(mode === 'add' ? result.gross : result.net), highlight: true },
            { label: t('vatNet'), value: money(result.net) },
            { label: `${t('vatAmount')} ${percent(result.rate)}`, value: money(result.vat) },
            { label: t('vatGross'), value: money(result.gross) },
          ]}
        />
      ) : (
        <EmptyResult />
      )}
    </div>
  )
}
