import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Mail, MapPin, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import QuoteSheet from '@/components/quotes/QuoteSheet'
import QuotePdfButton from '@/components/QuotePdfButton'
import QuotePublicActions from '@/components/shop/QuotePublicActions'
import { confirmQuotePayment } from '@/app/actions/shop'
import { quoteAmountDueCents, type QuotePaymentMode } from '@/lib/quotes'
import type { IssuerForPdf, QuoteForPdf } from '@/lib/quotePdf'

// Pagina del preventivo per il cliente (link dal venditore): lo legge, lo
// scarica in PDF, lo accetta e, se previsto, lo paga online (KUMANI Shop).
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false } }

type PublicQuote = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote: Record<string, any> & {
    quote_number: number
    total: number
    payment_mode: QuotePaymentMode
    deposit_percent: number | null
    payment_status: string
    accepted_at: string | null
    accepted_by_name: string | null
    paid_amount: number | null
    paid_at: string | null
    valid_until: string | null
  }
  issuer: (NonNullable<IssuerForPdf> & { logo_path: string | null }) | null
  can_charge: boolean
}

export default async function PublicQuotePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ paid?: string; cancelled?: string }> }) {
  const [{ token }, { paid, cancelled }] = await Promise.all([params, searchParams])
  const t = await getTranslations('quotePublic')
  // Ritorno dal pagamento: si conferma prima di leggere il preventivo
  if (paid) await confirmQuotePayment(token, paid)

  const supabase = await createClient()
  const { data } = await supabase.rpc('get_public_quote', { p_token: token })
  const pub = data as PublicQuote | null
  if (!pub?.quote) notFound()
  const { quote, issuer } = pub
  const sellerName = issuer?.company_name || t('sellerFallback')
  const logoUrl = issuer?.logo_path ? supabase.storage.from('quote-logos-v2').getPublicUrl(issuer.logo_path).data.publicUrl : null
  const today = new Date().toISOString().slice(0, 10)
  const amountDue = quoteAmountDueCents(Number(quote.total), quote.payment_mode, quote.deposit_percent) / 100
  const address = [issuer?.address, [issuer?.postal_code, issuer?.city].filter(Boolean).join(' '), issuer?.province].filter(Boolean).join(', ')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-4 px-4 py-5 sm:px-6">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--gold-bright)]">{t('quoteFrom')}</p>
            <h1 className="truncate text-xl font-bold sm:text-2xl">{sellerName}</h1>
            <p className="text-sm text-white/70">
              {[issuer?.vat_number ? t('vat', { vat: issuer.vat_number }) : null, address || null].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-col gap-1 text-sm text-white/80">
            {issuer?.email && (
              <a href={`mailto:${issuer.email}`} className="flex items-center gap-1.5 hover:text-white">
                <Mail className="h-4 w-4" /> {issuer.email}
              </a>
            )}
            {issuer?.phone && (
              <a href={`tel:${issuer.phone.replace(/[^\d+]/g, '')}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="h-4 w-4" /> {issuer.phone}
              </a>
            )}
            {address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" /> {issuer?.city}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
        <QuotePublicActions
          token={token}
          sellerName={sellerName}
          mode={quote.payment_mode}
          depositPercent={quote.deposit_percent}
          amountDue={amountDue}
          canCharge={pub.can_charge}
          expired={!!quote.valid_until && quote.valid_until < today}
          acceptedAt={quote.accepted_at}
          acceptedBy={quote.accepted_by_name}
          paymentStatus={quote.payment_status}
          paidAmount={quote.paid_amount !== null ? Number(quote.paid_amount) : null}
          paidAt={quote.paid_at}
          cancelled={!!cancelled}
        />
        <div className="flex flex-wrap items-center gap-3">
          <QuotePdfButton quote={quote as unknown as QuoteForPdf} issuer={issuer} logoUrl={logoUrl} />
        </div>
        <QuoteSheet quote={quote} />
        <p className="text-center text-xs text-[var(--muted)]">{t('legalNote', { seller: sellerName })}</p>
        <Link href="/" className="mx-auto flex w-fit items-center gap-2 text-xs font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
          <Logo size={18} className="h-[18px] w-[18px]" /> {t('madeWith')}
        </Link>
      </main>
    </div>
  )
}
