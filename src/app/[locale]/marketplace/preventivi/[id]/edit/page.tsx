import { localizedRedirect } from '@/lib/localizedRedirect'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, FileSpreadsheet } from 'lucide-react'
import { hasActivePreventiviAccess, loadQuoteInventoryProducts } from '@/lib/quotes-server'
import QuoteForm from '@/components/QuoteForm'
import { DEFAULT_DEPOSIT_PERCENT, DEFAULT_VAT_RATE, QUOTE_PAYMENT_MODES, type QuoteFormData } from '@/lib/quotes'

export default async function EditQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { id, locale } = await params
  const { from } = await searchParams
  const backSuffix = from === 'dashboard' ? '?from=dashboard' : ''
  const t = await getTranslations('preventivi')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return localizedRedirect('/login')

  const hasAccess = await hasActivePreventiviAccess(supabase, user.id)
  if (!hasAccess) {
    return localizedRedirect('/dashboard')
  }

  const { data: quote } = await supabase.from('quotes').select('*').eq('id', id).eq('user_id', user.id).single()
  if (!quote) notFound()
  // Accettato o pagato: si torna alla scheda (lì c'è «Duplica»)
  if (quote.accepted_at || (quote.payment_status ?? 'unpaid') !== 'unpaid') redirect(`/${locale}/marketplace/preventivi/${id}${backSuffix}`)

  const { data: profile } = await supabase
    .from('quote_issuer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const inventoryProducts = await loadQuoteInventoryProducts(supabase, user.id)

  const logoUrl = profile?.logo_path
    ? supabase.storage.from('quote-logos-v2').getPublicUrl(profile.logo_path).data.publicUrl
    : null

  const initialData: QuoteFormData = {
    layout: quote.layout === 'descriptive' ? 'descriptive' : 'table',
    logoPosition: quote.logo_position || 'left',
    bandStyle: quote.band_style ?? null,
    subject: quote.subject || '',
    intro: quote.intro || '',
    sections: Array.isArray(quote.sections) ? quote.sections : [],
    showTotal: quote.show_total !== false,
    vatMode: quote.vat_mode || 'plus',
    // Preventivi vecchi senza aliquota: si propone il 22% (visibile nel modulo prima di salvare)
    vatRate: quote.vat_rate != null ? Number(quote.vat_rate) : (quote.vat_mode || 'plus') === 'none' ? null : DEFAULT_VAT_RATE,
    closing: quote.closing || '',
    signature: quote.signature !== false,
    clientName: quote.client_name || '',
    clientEmail: quote.client_email || '',
    clientPhone: quote.client_phone || '',
    clientAddress: quote.client_address || '',
    clientCity: quote.client_city || '',
    clientPostalCode: quote.client_postal_code || '',
    clientPec: quote.client_pec || '',
    clientVat: quote.client_vat || '',
    issueDate: quote.issue_date,
    validUntil: quote.valid_until || '',
    items: quote.items && quote.items.length > 0 ? quote.items : [{ description: '', quantity: 1, unitPrice: 0 }],
    paymentInfo: quote.payment_info || '',
    notes: quote.notes || '',
    paymentMode: QUOTE_PAYMENT_MODES.includes(quote.payment_mode) ? quote.payment_mode : 'none',
    depositPercent: quote.deposit_percent ?? DEFAULT_DEPOSIT_PERCENT,
  }

  // KUMANI Shop: pagamento online possibile solo con il conto Stripe pronto
  const { data: stripeAccount } = await supabase.from('seller_stripe_accounts').select('charges_enabled').eq('user_id', user.id).maybeSingle()
  const canChargeOnline = !!stripeAccount?.charges_enabled

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-3xl xl:max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href={`/marketplace/preventivi/${id}${backSuffix}`}
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('quoteNumberLabel', { number: quote.quote_number })}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <FileSpreadsheet className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('editQuote')}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl xl:max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <QuoteForm
          canChargeOnline={canChargeOnline}
          issuer={profile || null}
          logoUrl={logoUrl}
          mode="edit"
          quoteId={quote.id}
          initialData={initialData}
          quoteNumber={quote.quote_number}
          inventoryProducts={inventoryProducts ?? undefined}
        />
      </main>
    </div>
  )
}
