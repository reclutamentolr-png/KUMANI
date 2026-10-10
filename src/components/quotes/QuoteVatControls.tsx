'use client'

import { useTranslations } from 'next-intl'
import { DEFAULT_VAT_RATE, QUOTE_VAT_MODES, QUOTE_VAT_RATES, type QuoteVatMode } from '@/lib/quotes'

// Come si leggono gli importi («+ IVA», «IVA inclusa», senza indicazione) e,
// con l'IVA, l'aliquota: il preventivo mostra imponibile, IVA e totale e il
// pagamento online addebita il totale con l'IVA.
export default function QuoteVatControls({
  vatMode,
  vatRate,
  onChange,
}: {
  vatMode: QuoteVatMode
  vatRate: number | null
  onChange: (next: { vatMode: QuoteVatMode; vatRate: number | null }) => void
}) {
  const t = useTranslations('preventivi')
  const chip = (on: boolean) =>
    `min-h-9 rounded-lg border px-3 py-1 text-xs font-semibold ${on ? 'border-[var(--gold)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 text-gray-600 hover:border-[var(--gold)]/60'}`

  return (
    <div className="space-y-2">
      <div>
        <span className="mb-1 block text-xs font-medium text-gray-600">{t('vatModeField')}</span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('vatModeField')}>
          {QUOTE_VAT_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ vatMode: m, vatRate: m === 'none' ? null : (vatRate ?? DEFAULT_VAT_RATE) })}
              aria-pressed={vatMode === m}
              className={chip(vatMode === m)}
            >
              {t(`vatMode_${m}`)}
            </button>
          ))}
        </div>
      </div>
      {vatMode !== 'none' && (
        <div>
          <span className="mb-1 block text-xs font-medium text-gray-600">{t('vatRateField')}</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('vatRateField')}>
            {QUOTE_VAT_RATES.map((r) => (
              <button key={r} type="button" onClick={() => onChange({ vatMode, vatRate: r })} aria-pressed={vatRate === r} className={chip(vatRate === r)}>
                {r}%
              </button>
            ))}
          </div>
        </div>
      )}
      {vatMode === 'none' && <p className="text-xs text-gray-500">{t('vatNoneHint')}</p>}
    </div>
  )
}
