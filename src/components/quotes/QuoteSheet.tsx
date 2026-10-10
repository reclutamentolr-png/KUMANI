import { getTranslations } from 'next-intl/server'
import { quoteGrossTotal, quoteImageUrl, quoteVatBreakdown, sectionLines, type QuoteItem, type QuoteSection } from '@/lib/quotes'
import QuoteTotals from '@/components/quotes/QuoteTotals'
import { LayersView } from '@/components/quotes/QuoteSectionExtras'

// Il preventivo come un foglio (cliente, righe o sezioni, totale, pagamento,
// note e firma): lo stesso nella pagina del venditore e in quella pubblica
// per il cliente (/preventivo/<link>).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function QuoteSheet({ quote }: { quote: Record<string, any> }) {
  const t = await getTranslations('preventivi')
  // Totale da pagare: con l'aliquota è il totale con l'IVA
  const breakdown = quoteVatBreakdown(Number(quote.total), quote.vat_mode, quote.vat_rate)
  const totalsLabels = { total: t('totalLabel'), net: t('netLabel'), vat: (rate: number) => t('vatRateLabel', { rate }), vatPlus: t('vatPlus'), vatIncluded: t('vatIncluded') }
  const totalsBlock = (
    <div className="mt-4 flex justify-end">
      <QuoteTotals total={Number(quote.total)} vatMode={quote.vat_mode} vatRate={quote.vat_rate} labels={totalsLabels} />
    </div>
  )
  // Come un foglio: pagamento e note restano in fondo, comunque siano lunghe le righe
  return (
  <div className="flex flex-col bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8 sm:min-h-[1100px]">
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wide mb-1">{t('clientSectionTitle')}</p>
        <p className="text-xl font-bold text-[var(--ink)]">{quote.client_name}</p>
        {quote.client_vat && <p className="text-sm text-gray-500">{t('clientVatField')}: {quote.client_vat}</p>}
        {(quote.client_address || quote.client_city || quote.client_postal_code) && (
          <p className="text-sm text-gray-500">
            {[quote.client_address, [quote.client_postal_code, quote.client_city].filter(Boolean).join(' ')]
              .filter(Boolean)
              .join(', ')}
          </p>
        )}
        {quote.client_email && <p className="text-sm text-gray-500">{quote.client_email}</p>}
        {quote.client_pec && <p className="text-sm text-gray-500">{t('clientPecField')}: {quote.client_pec}</p>}
        {quote.client_phone && <p className="text-sm text-gray-500">{quote.client_phone}</p>}
      </div>
      <div className="text-right">
        <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wide mb-1">{t('totalLabel')}</p>
        <p className="text-3xl font-bold text-[var(--gold)]">
          {quoteGrossTotal(Number(quote.total), quote.vat_mode, quote.vat_rate).toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}
        </p>
        {breakdown ? (
          <p className="text-xs text-gray-500">{t('vatIncludedRate', { rate: breakdown.rate })}</p>
        ) : quote.vat_mode === 'plus' ? (
          <p className="text-xs text-gray-500">{t('vatPlus')}</p>
        ) : null}
      </div>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600 border-t border-[var(--gold)]/15 pt-4 mb-6">
      <p>{t('issueDateField')}: {new Date(quote.issue_date).toLocaleDateString()}</p>
      {quote.valid_until && <p>{t('validUntilField')}: {new Date(quote.valid_until).toLocaleDateString()}</p>}
    </div>

    {quote.layout === 'descriptive' ? (
      <div className="space-y-6 border-t border-[var(--gold)]/15 pt-4">
        {quote.subject && (
          <p className="text-[var(--ink)]">
            <span className="font-bold">{t('subjectField')}:</span> {quote.subject}
          </p>
        )}
        {quote.intro && <p className="whitespace-pre-wrap text-gray-700">{quote.intro}</p>}
        {((quote.sections || []) as QuoteSection[]).map((s, i) => (
          <section key={i}>
            {s.title && (
              <h3 className="mb-2 text-lg font-bold text-[var(--ink)]">
                {s.title}
                <span className="mt-1 block h-0.5 w-8 bg-[var(--gold)]" />
              </h3>
            )}
            {s.kind === 'image' ? (
              <figure className="space-y-2">
                {s.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={quoteImageUrl(s.image)} alt={s.title} className="max-h-96 w-full rounded-lg border border-gray-200 object-contain" />
                )}
                {s.body && <figcaption className="text-sm italic text-gray-500">{s.body}</figcaption>}
              </figure>
            ) : s.kind === 'layers' ? (
              <div className="space-y-2">
                <LayersView layers={s.layers ?? []} />
                {s.body && <p className="text-sm italic text-gray-500">{s.body}</p>}
              </div>
            ) : s.kind === 'text' ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{s.body}</p>
            ) : s.kind === 'numbered' ? (
              <ol className="list-decimal space-y-1 pl-6 text-sm text-gray-700">
                {sectionLines(s.body).map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ol>
            ) : (
              <ul className="list-disc space-y-1 pl-6 text-sm text-gray-700">
                {sectionLines(s.body).map((line, j) => (
                  <li key={j}>{line}</li>
                ))}
              </ul>
            )}
            {typeof s.amount === 'number' && (
              <p className="mt-2 text-right font-bold text-[var(--gold)]">
                {s.amount.toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}
                {quote.vat_mode === 'plus' ? ` ${t('vatPlus')}` : quote.vat_mode === 'included' ? ` ${t('vatIncluded')}` : ''}
              </p>
            )}
          </section>
        ))}
        {quote.show_total !== false && (quote.sections || []).some((s: QuoteSection) => typeof s.amount === 'number') && totalsBlock}
        {quote.closing && <p className="whitespace-pre-wrap text-gray-700">{quote.closing}</p>}
        {quote.signature !== false && (
          <div className="ml-auto w-56 pt-4 text-center text-sm">
            <p className="font-bold text-[var(--ink)]">{t('pdfSignature')}</p>
            <p className="text-xs text-gray-500">{t('pdfSignatureHint')}</p>
            <div className="mt-10 border-b border-[var(--ink)]" />
          </div>
        )}
      </div>
    ) : (
    <div className="border-t border-[var(--gold)]/15 pt-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[var(--muted)] uppercase">
            <th className="pb-2">{t('itemDescriptionHeader')}</th>
            <th className="pb-2 text-right">{t('itemQuantityHeader')}</th>
            <th className="pb-2 text-right">{t('itemPriceHeader')}</th>
            <th className="pb-2 text-right">{t('itemTotalHeader')}</th>
          </tr>
        </thead>
        <tbody>
          {((quote.items || []) as QuoteItem[]).map((item, i) => (
            <tr key={i} className="border-t border-[var(--gold)]/15">
              <td className="py-2 text-[var(--ink)]">{item.description}</td>
              <td className="py-2 text-right text-gray-600">{item.quantity}</td>
              <td className="py-2 text-right text-gray-600">
                {Number(item.unitPrice).toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}
              </td>
              <td className="py-2 text-right font-medium text-[var(--ink)]">
                {(item.quantity * item.unitPrice).toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {totalsBlock}
    </div>
    )}

    <div className="mt-auto pt-6">
    {quote.payment_info && (
      <div className="border-t border-[var(--gold)]/15 mt-6 pt-4">
        <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wide mb-1">{t('paymentInfoField')}</p>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.payment_info}</p>
      </div>
    )}

    {quote.notes && (
      <div className="border-t border-[var(--gold)]/15 mt-6 pt-4">
        <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wide mb-1">{t('notesField')}</p>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
      </div>
    )}
    {quote.layout !== 'descriptive' && quote.signature !== false && (
      <div className="ml-auto mt-6 w-56 text-center text-sm">
        <p className="font-bold text-[var(--ink)]">{t('pdfSignature')}</p>
        <p className="text-xs text-gray-500">{t('pdfSignatureHint')}</p>
        <div className="mt-10 border-b border-[var(--ink)]" />
      </div>
    )}
    </div>
  </div>
  )
}
