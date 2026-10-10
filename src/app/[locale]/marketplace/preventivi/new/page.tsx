import { localizedRedirect } from '@/lib/localizedRedirect'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, Calculator, FileSpreadsheet } from 'lucide-react'
import { hasActivePreventiviAccess, loadQuoteInventoryProducts } from '@/lib/quotes-server'
import QuoteForm from '@/components/QuoteForm'

export default async function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; line?: string; price?: string }>
}) {
  const t = await getTranslations('preventivi')
  const te = await getTranslations('ecosystem')
  const { from, line, price } = await searchParams
  const backSuffix = from === 'dashboard' ? '?from=dashboard' : ''

  // Riga arrivata dalle Calcolatrici (?line=…&price=…)
  const lineText = typeof line === 'string' ? line.trim().slice(0, 200) : ''
  const linePrice = typeof price === 'string' ? Number(price.replace(',', '.')) : NaN
  const initialLine = lineText
    ? { description: lineText, unitPrice: Number.isFinite(linePrice) && linePrice >= 0 ? Math.round(linePrice * 100) / 100 : 0 }
    : undefined

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return localizedRedirect('/login')

  const hasAccess = await hasActivePreventiviAccess(supabase, user.id)
  if (!hasAccess) {
    return localizedRedirect('/dashboard')
  }

  const { data: profile } = await supabase
    .from('quote_issuer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  const inventoryProducts = await loadQuoteInventoryProducts(supabase, user.id)
  // Numero che avrà il preventivo (per l'anteprima dal vivo)
  const { data: lastQuote } = await supabase.from('quotes').select('quote_number').eq('user_id', user.id).order('quote_number', { ascending: false }).limit(1).maybeSingle()
  const nextNumber = (lastQuote?.quote_number ?? 0) + 1

  const logoUrl = profile?.logo_path
    ? supabase.storage.from('quote-logos-v2').getPublicUrl(profile.logo_path).data.publicUrl
    : null

  // KUMANI Shop: pagamento online possibile solo con il conto Stripe pronto
  const { data: stripeAccount } = await supabase.from('seller_stripe_accounts').select('charges_enabled').eq('user_id', user.id).maybeSingle()
  const canChargeOnline = !!stripeAccount?.charges_enabled

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-3xl xl:max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href={`/marketplace/preventivi${backSuffix}`}
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <FileSpreadsheet className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('newQuote')}
          </h1>
        </div>
      </header>

      <main className="max-w-3xl xl:max-w-[1500px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {initialLine && (
          <p className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">
            <Calculator className="h-4 w-4 shrink-0 text-[var(--gold)]" />
            {te('quoteFromCalcBanner')}
          </p>
        )}
        <QuoteForm
          canChargeOnline={canChargeOnline}
          issuer={profile || null}
          logoUrl={logoUrl}
          mode="create"
          inventoryProducts={inventoryProducts ?? undefined}
          initialLine={initialLine}
          quoteNumber={nextNumber}
        />
      </main>
    </div>
  )
}
