import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft } from 'lucide-react'
import { hasActiveDigitalReceiptAccess } from '@/lib/digitalReceipt-server'
import { defaultLocale } from '../../../../../../i18n'
import OfferMakerQR from '@/components/OfferMakerQR'
import CopyLinkButton from '@/components/CopyLinkButton'
import DigitalReceiptActions from '@/components/DigitalReceiptActions'
import DigitalReceiptPdfButton from '@/components/DigitalReceiptPdfButton'

export default async function DigitalReceiptDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  const t = await getTranslations('digitalReceipt')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const hasAccess = await hasActiveDigitalReceiptAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${locale}/marketplace`)
  }

  const { data: receipt } = await supabase
    .from('digital_receipts')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!receipt) notFound()

  const { data: profile } = await supabase
    .rpc('get_my_profile')
    .maybeSingle<{ first_name: string | null; last_name: string | null; email: string | null }>()
  const issuedByName =
    [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim() || profile?.email || user.email || ''

  const photoUrl = receipt.photo_path
    ? supabase.storage.from('receipt-photos-v2').getPublicUrl(receipt.photo_path).data.publicUrl
    : null

  const baseUrl = SITE_URL
  const receiptUrl =
    locale === defaultLocale ? `${baseUrl}/ricevute/${receipt.code}` : `${baseUrl}/${locale}/ricevute/${receipt.code}`

  const statusLabel = receipt.returned_at
    ? t('statusReturned')
    : receipt.confirmed_at
      ? t('statusConfirmed')
      : t('statusPending')
  const statusColor = receipt.returned_at
    ? 'bg-[var(--ink)] text-[var(--gold-bright)]'
    : receipt.confirmed_at
      ? 'bg-green-100 text-green-700'
      : 'bg-amber-100 text-amber-800'

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
          <h1 className="font-semibold tracking-wide truncate max-w-[50%] sm:max-w-xs">{receipt.object_name}</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            <div className="sm:col-span-2 space-y-4">
              <div>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                  {statusLabel}
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--gold)] mb-1">{t('shareLinkLabel')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-[var(--background)] border border-[var(--gold)]/20 rounded-lg px-3 py-2 text-sm text-gray-700 break-all">
                    {receiptUrl}
                  </code>
                  <CopyLinkButton url={receiptUrl} />
                </div>
              </div>
              <p className="text-sm text-gray-600">
                {t('recipientField')}: <span className="font-medium text-[var(--ink)]">{receipt.recipient_name}</span>
              </p>
            </div>

            <div className="flex justify-center">
              <OfferMakerQR
                url={receiptUrl}
                fileName={`receipt-${receipt.code}`}
                generatingLabel={t('generatingQr')}
                downloadLabel={t('downloadQr')}
                accentClassName="bg-[var(--ink)] hover:bg-[var(--ink-soft)]"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <DigitalReceiptPdfButton
            receipt={receipt}
            receiptUrl={receiptUrl}
            photoUrl={photoUrl}
            issuedByName={issuedByName}
          />
          <DigitalReceiptActions
            id={receipt.id}
            showConfirmReturn={receipt.template === 'loan' && !!receipt.confirmed_at && !receipt.returned_at}
          />
        </div>
      </main>
    </div>
  )
}
