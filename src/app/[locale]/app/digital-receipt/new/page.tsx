import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, BookUser, FileCheck2, FileSpreadsheet } from 'lucide-react'
import { hasActiveDigitalReceiptAccess } from '@/lib/digitalReceipt-server'
import { todayKey } from '@/lib/agenda'
import type { DigitalReceiptFormData } from '@/lib/digitalReceipt'
import DigitalReceiptForm from '@/components/DigitalReceiptForm'
import HubBar from '@/components/hubs/HubBar'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function NewDigitalReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ fromQuote?: string; fromPayment?: string }>
}) {
  const t = await getTranslations('digitalReceipt')
  const te = await getTranslations('ecosystem')
  const locale = await getLocale()
  const { fromQuote, fromPayment } = await searchParams

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
      .select('quote_number, client_name, total, issue_date, vat_mode')
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
        vatMode: quote.vat_mode === 'plus' || quote.vat_mode === 'included' ? quote.vat_mode : 'none',
        deliveryDate: todayKey(),
        notes: te('receiptFromQuoteNotes', { number: quote.quote_number, date: issued }),
      }
    }
  }

  // Ricevuta di un pagamento registrato in Clienti e Lavori (?fromPayment=<id>)
  let paymentId: string | undefined
  let paymentClient: string | null = null
  if (!initialData && typeof fromPayment === 'string' && UUID_RE.test(fromPayment)) {
    const { data: payment } = await supabase
      .from('client_payments')
      .select('id, client_id, job_id, amount, paid_on, method, note, receipt_id')
      .eq('id', fromPayment)
      .eq('user_id', user.id)
      .maybeSingle()
    if (payment && !payment.receipt_id) {
      const [{ data: client }, { data: job }] = await Promise.all([
        supabase.from('quote_clients').select('name').eq('id', payment.client_id).eq('user_id', user.id).maybeSingle(),
        payment.job_id ? supabase.from('client_jobs').select('title').eq('id', payment.job_id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ])
      const tc = await getTranslations('clienti')
      paymentId = payment.id
      paymentClient = client?.name ?? null
      initialData = {
        template: 'declared_payment',
        objectName: job?.title ? tc('receipt.objectJob', { title: job.title }) : tc('receipt.object'),
        recipientName: client?.name ?? '',
        declaredValue: Number(payment.amount),
        vatMode: 'none',
        deliveryDate: payment.paid_on,
        notes: [tc(`pay.methods.${payment.method}`), payment.note].filter(Boolean).join(' · '),
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-3">
          <Link
            href="/app/digital-receipt"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)] shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide min-w-0 text-right leading-tight">
            <FileCheck2 className="h-5 w-5 text-[var(--gold-bright)] shrink-0" />
            {t('newReceipt')}
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {quoteNumber !== null && (
          <p className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-[var(--gold)]" />
            {te('receiptFromQuoteBanner', { number: quoteNumber })}
          </p>
        )}
        {paymentId && (
          <p className="mb-6 flex items-center gap-2 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">
            <BookUser className="h-4 w-4 shrink-0 text-[var(--gold)]" />
            {te('receiptFromPaymentBanner', { name: paymentClient ?? '' })}
          </p>
        )}
        <DigitalReceiptForm initialData={initialData} savedClients={savedClients} paymentId={paymentId} />
      </main>
    </div>
  )
}
