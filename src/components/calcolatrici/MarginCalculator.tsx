'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { marginFromCostAndPrice, priceFromMargin, priceFromMarkup, type MarginResult } from '@/lib/calculators'
import { Card, EmptyResult, Note, NumberField, ResultPanel, Segmented, parsePositive, useFormatters, useReportResult, type ResultLine } from './ui'

// Ricarico = utile / costo; margine = utile / prezzo di vendita.
type Mode = 'fromPrice' | 'fromMargin' | 'fromMarkup'

export default function MarginCalculator() {
  const t = useTranslations('calcolatrici')
  const { money, percent } = useFormatters()
  const [mode, setMode] = useState<Mode>('fromPrice')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [marginInput, setMarginInput] = useState('')
  const [markupInput, setMarkupInput] = useState('')

  const costValue = parsePositive(cost)
  const priceValue = parsePositive(price)
  const marginValue = parsePositive(marginInput)
  const markupValue = parsePositive(markupInput)
  const marginError = marginValue !== null && marginValue >= 100 ? t('mgMarginTooHigh') : null

  let result: MarginResult | null = null
  if (costValue !== null) {
    if (mode === 'fromPrice' && priceValue !== null) result = marginFromCostAndPrice(costValue, priceValue)
    if (mode === 'fromMargin' && marginValue !== null) result = priceFromMargin(costValue, marginValue)
    if (mode === 'fromMarkup' && markupValue !== null) result = priceFromMarkup(costValue, markupValue)
  }

  useReportResult(result ? `mg:${mode}:${result.cost}:${result.price}` : null)

  const lines: ResultLine[] = []
  if (result) {
    const na = t('mgNotAvailable')
    const markup = result.markup === null ? na : percent(result.markup)
    const margin = result.margin === null ? na : percent(result.margin)
    if (mode === 'fromPrice') {
      lines.push({ label: t('mgMarkup'), value: markup, highlight: true })
      lines.push({ label: t('mgMargin'), value: margin, highlight: true })
    } else {
      lines.push({ label: t('mgSellingPrice'), value: money(result.price), highlight: true })
      lines.push({ label: t('mgMarkup'), value: markup })
      lines.push({ label: t('mgMargin'), value: margin })
    }
    lines.push({ label: t('mgCost'), value: money(result.cost) })
    if (mode === 'fromPrice') lines.push({ label: t('mgPrice'), value: money(result.price) })
    lines.push({ label: t('mgProfit'), value: money(result.profit) })
  }

  return (
    <div className="space-y-5">
      <Card title={t('mgTitle')}>
        <Segmented
          label={t('mgTitle')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'fromPrice', label: t('mgModeFromPrice') },
            { value: 'fromMargin', label: t('mgModeFromMargin') },
            { value: 'fromMarkup', label: t('mgModeFromMarkup') },
          ]}
        />
        <NumberField id="mg-cost" label={t('mgCost')} value={cost} onChange={setCost} suffix="€" help={t('decimalHint')} />
        {mode === 'fromPrice' && <NumberField id="mg-price" label={t('mgPrice')} value={price} onChange={setPrice} suffix="€" />}
        {mode === 'fromMargin' && (
          <NumberField id="mg-margin" label={t('mgMarginInput')} value={marginInput} onChange={setMarginInput} suffix="%" error={marginError} />
        )}
        {mode === 'fromMarkup' && <NumberField id="mg-markup" label={t('mgMarkupInput')} value={markupInput} onChange={setMarkupInput} suffix="%" />}
        <Note>{t('mgExplain')}</Note>
      </Card>

      {result ? <ResultPanel title={t('mgTitle')} lines={lines} /> : <EmptyResult />}
    </div>
  )
}
