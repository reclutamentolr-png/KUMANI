import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, FileCheck2, FileSpreadsheet } from 'lucide-react'
import { hasActiveDigitalReceiptAccess } from '@/lib/digitalReceipt-server'
import { todayKey } from '@/lib/agenda'
import type { DigitalReceiptFormData } from '@/lib/digitalReceipt'
import DigitalReceiptForm from '@/components/DigitalReceiptForm'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function NewDigitalReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ fromQuote?: string }>
}) {
  const t = await getTranslations('digitalReceipt')
  const te = await getTranslations('ecosystem')
  const locale = await getLocale()
  const { fromQuote } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  const hasAccess = await hasActiveDigitalReceiptAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${await getLocale()}/dashboard`)
  }

  // Ricevuta di pagamento dal preventivo (?fromQuote=<id>): solo i propri
  let initialData: Partial<DigitalReceiptFormData> | undefined
  let quoteNumber: number | null = null
  if (typeof fromQuote === 'string' && UUID_RE.test(fromQuote)) {
    const { data: quote } = await supabase
      .from('quotes')
      .select('quote_number, client_name, total, issue_date')
      .eq('id', fromQuote)
      .eq('user_id', user.id)
      .maybeSingle()
    if (quote) {
      quoteNumber = quote.quote_number
      const issued = quote.issue_date
        ? new Date(`${quote.issue_date}T12:00:00Z`).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
        : ''
      initialData = {
        template: 'declared_payment',
        objectName: te('receiptFromQuoteObject', { number: quote.quote_number }),
        recipientName: quote.client_name || '',
        declaredValue: quote.total !== null && quote.total !== undefined ? Number(quote.total) : null,
        deliveryDate: todayKey(),
        notes: te('receiptFromQuoteNotes', { number: quote.quote_number, date: issued }),
      }
    }
  }

  // Clienti salvati nei Preventivi: suggeriti come destinatari
  const { data: clients } = await supabase
    .from('quote_clients')
    .select('name')
    .eq('user_id', user.id)
    .order('name')
    .limit(200)
  const savedClients = Array.from(new Set((clients ?? []).map((c) => (c.name || '').trim()).filter(Boolean)))

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/marketplace/digital-receipt"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <FileCheck2 className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('newReceipt')}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {quoteNumber !== null && (
          <p className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--gold)]" />
            {te('receiptFromQuoteBanner', { number: quoteNumber })}
          </p>
        )}
        <DigitalReceiptForm initialData={initialData} savedClients={savedClients} />
      </main>
    </div>
  )
}
