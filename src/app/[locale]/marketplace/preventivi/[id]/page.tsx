import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft } from 'lucide-react'
import { hasActivePreventiviAccess } from '@/lib/quotes-server'
import QuotePdfButton from '@/components/QuotePdfButton'
import QuoteShareButtons from '@/components/QuoteShareButtons'
import QuoteActions from '@/components/QuoteActions'
import type { QuoteItem } from '@/lib/quotes'

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id } = await params
  const { from } = await searchParams
  const backSuffix = from === 'dashboard' ? '?from=dashboard' : ''
  const t = await getTranslations('preventivi')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActivePreventiviAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/marketplace')
  }

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!quote) notFound()

  const { data: issuer } = await supabase
    .from('quote_issuer_profiles')
    .select('company_name, vat_number, address, city, postal_code, province, pec, email, phone, logo_path')
    .eq('user_id', user.id)
    .maybeSingle()

  const logoUrl = issuer?.logo_path
    ? supabase.storage.from('quote-logos-v2').getPublicUrl(issuer.logo_path).data.publicUrl
    : null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href={`/marketplace/preventivi${backSuffix}`}
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="font-semibold tracking-wide">{t('quoteNumberLabel', { number: quote.quote_number })}</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8">
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
                {Number(quote.total).toLocaleString(undefined, { style: 'currency', currency: 'EUR' })}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600 border-t border-[var(--gold)]/15 pt-4 mb-6">
            <p>{t('issueDateField')}: {new Date(quote.issue_date).toLocaleDateString()}</p>
            {quote.valid_until && <p>{t('validUntilField')}: {new Date(quote.valid_until).toLocaleDateString()}</p>}
          </div>

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
          </div>

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
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <QuotePdfButton quote={quote} issuer={issuer || null} logoUrl={logoUrl} />
            <QuoteActions id={quote.id} />
          </div>
          <QuoteShareButtons quote={quote} issuer={issuer || null} logoUrl={logoUrl} />
        </div>
      </main>
    </div>
  )
}
