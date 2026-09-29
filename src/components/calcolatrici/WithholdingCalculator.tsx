'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { computeWithholding, computeWithholdingFromNet, type WithholdingOptions } from '@/lib/calculators'
import { Card, EmptyResult, Note, NumberField, ResultPanel, Segmented, Toggle, parsePositive, useFormatters, useReportResult, type ResultLine } from './ui'

// Ritenuta d'acconto (prassi italiana):
// - la rivalsa INPS 4% (gestione separata) entra nella base della ritenuta;
// - il contributo integrativo cassa NON è soggetto a ritenuta;
// - l'IVA si applica su compenso + rivalsa + cassa.

type Mode = 'forward' | 'reverse'
type Contribution = 'none' | 'inps' | 'cassa'

const INPS_RATE = 4
const VAT_RATE = 22

export default function WithholdingCalculator() {
  const t = useTranslations('calcolatrici')
  const { locale, money, percent } = useFormatters()
  const [mode, setMode] = useState<Mode>('forward')
  const [amount, setAmount] = useState('')
  const [rate, setRate] = useState('20')
  const [contribution, setContribution] = useState<Contribution>('none')
  const [cassaRate, setCassaRate] = useState('4')
  const [vatOn, setVatOn] = useState(true)

  const amountValue = parsePositive(amount)
  const rateValue = parsePositive(rate)
  const cassaValue = contribution === 'cassa' ? parsePositive(cassaRate) : 0
  const rateError = rateValue !== null && rateValue > 100 ? t('rateTooHigh') : null
  const cassaError = cassaValue !== null && cassaValue > 100 ? t('rateTooHigh') : null

  const options: WithholdingOptions | null =
    rateValue === null || rateValue > 100 || cassaValue === null || cassaValue > 100
      ? null
      : {
          withholdingRate: rateValue,
          inpsRate: contribution === 'inps' ? INPS_RATE : 0,
          cassaRate: cassaValue,
          vatRate: vatOn ? VAT_RATE : 0,
        }
  const optionsKey = options ? `${options.withholdingRate}:${options.inpsRate}:${options.cassaRate}:${options.vatRate}` : ''

  // Calcolo immediato: costa pochi microsecondi, niente memo
  const result =
    amountValue === null || !options
      ? null
      : mode === 'forward'
        ? computeWithholding(amountValue, options)
        : computeWithholdingFromNet(amountValue, options)

  useReportResult(result ? `wh:${mode}:${result.compenso}:${optionsKey}` : null)

  const lines: ResultLine[] = []
  if (result && options) {
    if (mode === 'forward') {
      lines.push({ label: t('whNet'), value: money(result.netToPay), highlight: true })
    } else {
      lines.push({ label: t('whToInvoice'), value: money(result.compenso), highlight: true })
    }
    lines.push({ label: t('whCompenso'), value: money(result.compenso) })
    if (options.inpsRate > 0) lines.push({ label: t('whRivalsa'), value: money(result.rivalsaInps) })
    if (options.cassaRate > 0) lines.push({ label: `${t('whCassa')} ${percent(options.cassaRate)}`, value: money(result.cassa) })
    if (options.vatRate > 0) {
      lines.push({ label: t('whVatBase'), value: money(result.vatBase) })
      lines.push({ label: `${t('whVatAmount')} ${percent(options.vatRate)}`, value: money(result.vat) })
    }
    lines.push({ label: t('whTotal'), value: money(result.total) })
    lines.push({ label: t('whBase'), value: money(result.withholdingBase) })
    lines.push({ label: `${t('whWithholding')} ${percent(options.withholdingRate)}`, value: money(result.withholding), negative: true })
    lines.push({ label: t('whNet'), value: money(result.netToPay) })
  }

  return (
    <div className="space-y-5">
      <Card title={t('whTitle')}>
        {locale !== 'it' && <Note tone="warning">{t('whItalyNote')}</Note>}
        <Segmented
          label={t('whTitle')}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'forward', label: t('whModeForward') },
            { value: 'reverse', label: t('whModeReverse') },
          ]}
        />
        <NumberField
          id="wh-amount"
          label={mode === 'forward' ? t('whAmountForward') : t('whAmountReverse')}
          value={amount}
          onChange={setAmount}
          suffix="€"
          help={t('decimalHint')}
        />
        <NumberField id="wh-rate" label={t('whRate')} value={rate} onChange={setRate} suffix="%" error={rateError} />
        <div>
          <p className="mb-2 text-sm font-semibold text-[var(--ink)]">{t('whContribution')}</p>
          <Segmented
            label={t('whContribution')}
            value={contribution}
            onChange={setContribution}
            options={[
              { value: 'none', label: t('whContribNone') },
              { value: 'inps', label: t('whContribInps') },
              { value: 'cassa', label: t('whContribCassa') },
            ]}
          />
          {contribution === 'inps' && <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t('whInpsHelp')}</p>}
        </div>
        {contribution === 'cassa' && (
          <NumberField id="wh-cassa" label={t('whCassaRate')} value={cassaRate} onChange={setCassaRate} suffix="%" help={t('whCassaHelp')} error={cassaError} />
        )}
        <Toggle checked={vatOn} onChange={setVatOn} label={t('whVatToggle')} help={vatOn ? undefined : t('whForfettarioHelp')} />
      </Card>

      {result ? (
        <ResultPanel
          title={t('whTitle')}
          lines={lines}
          footer={mode === 'reverse' ? t('whReverseSummary', { net: money(result.netToPay), amount: money(result.compenso) }) : undefined}
        />
      ) : (
        <EmptyResult />
      )}

      <Note tone="warning">{t('whDisclaimer')}</Note>
    </div>
  )
}
