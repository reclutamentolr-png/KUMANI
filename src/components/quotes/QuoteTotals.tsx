import { quoteVatBreakdown, type QuoteVatMode } from '@/lib/quotes'

// Riquadro dei totali del preventivo: con l'aliquota IVA mostra imponibile,
// IVA e totale; senza, il totale con «+ IVA» / «IVA inclusa» accanto. Senza
// hook: lo usano sia il modulo (browser) sia il foglio del preventivo (server).
export type QuoteTotalsLabels = {
  total: string
  net: string
  vat: (rate: number) => string
  vatPlus: string
  vatIncluded: string
}

export default function QuoteTotals({
  total,
  vatMode,
  vatRate,
  labels,
  locale,
  className = '',
}: {
  total: number
  vatMode: QuoteVatMode | null | undefined
  vatRate: number | null | undefined
  labels: QuoteTotalsLabels
  locale?: string
  className?: string
}) {
  const money = (n: number) => n.toLocaleString(locale, { style: 'currency', currency: 'EUR' })
  const breakdown = quoteVatBreakdown(total, vatMode, vatRate)

  if (!breakdown) {
    const suffix = vatMode === 'plus' ? ` ${labels.vatPlus}` : vatMode === 'included' ? ` ${labels.vatIncluded}` : ''
    return (
      <div className={`rounded-xl bg-[var(--gold-pale)] px-5 py-3 text-right ${className}`}>
        <p className="text-xs uppercase tracking-wide text-[var(--ink)]/70">{labels.total}</p>
        <p className="text-2xl font-bold text-[var(--ink)]">
          {money(Number(total) || 0)}
          {suffix && <span className="text-sm font-semibold">{suffix}</span>}
        </p>
      </div>
    )
  }

  return (
    <div className={`min-w-[15rem] rounded-xl bg-[var(--gold-pale)] px-5 py-3 ${className}`}>
      <dl className="space-y-1 text-sm tabular-nums">
        <div className="flex justify-between gap-6 text-[var(--ink)]/80">
          <dt>{labels.net}</dt>
          <dd>{money(breakdown.net)}</dd>
        </div>
        <div className="flex justify-between gap-6 text-[var(--ink)]/80">
          <dt>{labels.vat(breakdown.rate)}</dt>
          <dd>{money(breakdown.vat)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-6 border-t border-[var(--ink)]/15 pt-1.5">
          <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--ink)]/70">{labels.total}</dt>
          <dd className="text-2xl font-bold text-[var(--ink)]">{money(breakdown.gross)}</dd>
        </div>
      </dl>
    </div>
  )
}
