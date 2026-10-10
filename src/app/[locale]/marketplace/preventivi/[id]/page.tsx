import { localizedRedirect } from '@/lib/localizedRedirect'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft } from 'lucide-react'
import { hasActivePreventiviAccess } from '@/lib/quotes-server'
import QuotePdfButton from '@/components/QuotePdfButton'
import QuoteShareButtons from '@/components/QuoteShareButtons'
import QuoteActions from '@/components/QuoteActions'
import QuoteWorkChain from '@/components/ecosystem/QuoteWorkChain'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { quoteVatUnknown, type QuoteItem } from '@/lib/quotes'
import QuoteSheet from '@/components/quotes/QuoteSheet'
import QuoteLinkBox from '@/components/shop/QuoteLinkBox'
import { SITE_URL } from '@/lib/siteUrl'

export default async function QuoteDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; id: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { locale, id } = await params
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

  const { data: issuer } = await supabase
    .from('quote_issuer_profiles')
    .select('company_name, vat_number, address, city, postal_code, province, pec, email, phone, logo_path')
    .eq('user_id', user.id)
    .maybeSingle()

  const logoUrl = issuer?.logo_path
    ? supabase.storage.from('quote-logos-v2').getPublicUrl(issuer.logo_path).data.publicUrl
    : null

  // Catena di lavoro: scarico dal Magazzino (righe collegate) e ricevuta di pagamento
  const hasLinkedProducts = ((quote.items || []) as QuoteItem[]).some((item) => typeof item.productId === 'string')
  const [canMagazzino, canReceipt] = await Promise.all([
    hasLinkedProducts ? hasActiveToolAccess(supabase, user.id, 'magazzino') : Promise.resolve(false),
    hasActiveToolAccess(supabase, user.id, 'digital-receipt'),
  ])
  // KUMANI Shop: il venditore può incassare online (conto Stripe pronto)
  const { data: stripeAccount } = await supabase.from('seller_stripe_accounts').select('charges_enabled').eq('user_id', user.id).maybeSingle()
  const unloadedOn = quote.stock_unloaded_at
    ? new Date(quote.stock_unloaded_at).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
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
        <QuoteSheet quote={quote} />

        <QuoteLinkBox
          siteUrl={SITE_URL}
          quoteId={quote.id}
          quoteNumber={quote.quote_number}
          initialToken={quote.public_token ?? null}
          paymentMode={quote.payment_mode ?? 'none'}
          depositPercent={quote.deposit_percent ?? null}
          canCharge={!!stripeAccount?.charges_enabled}
          acceptedAt={quote.accepted_at ?? null}
          acceptedBy={quote.accepted_by_name ?? null}
          paymentStatus={quote.payment_status ?? 'unpaid'}
          paidAmount={quote.paid_amount !== null && quote.paid_amount !== undefined ? Number(quote.paid_amount) : null}
          paidAt={quote.paid_at ?? null}
          vatMissing={quoteVatUnknown(quote.vat_mode, quote.vat_rate)}
        />

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <QuotePdfButton quote={quote} issuer={issuer || null} logoUrl={logoUrl} />
            <QuoteActions id={quote.id} />
          </div>
          <QuoteShareButtons quote={quote} issuer={issuer || null} logoUrl={logoUrl} />
          <QuoteWorkChain
            quoteId={quote.id}
            showUnload={hasLinkedProducts && canMagazzino}
            unloadedOn={unloadedOn}
            showReceipt={canReceipt}
          />
        </div>
      </main>
    </div>
  )
}
