import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, MousePointerClick } from 'lucide-react'
import { hasActiveQrProAccess } from '@/lib/qrPro-server'
import QrProForm from '@/components/QrProForm'
import OfferMakerQR from '@/components/OfferMakerQR'
import CopyLinkButton from '@/components/CopyLinkButton'
import { buildWifiQrPayload, type QrContentType, type QrDestination, type WifiDestination } from '@/lib/qrPro'

export default async function QrCodeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('qrCodePro')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActiveQrProAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/marketplace')
  }

  const { data: qrCode } = await supabase
    .from('qr_pro_codes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!qrCode) notFound()

  const baseUrl = SITE_URL
  const shortLink = `${baseUrl}/q/${qrCode.code}`
  const isWifi = qrCode.content_type === 'wifi'
  const qrPayload = isWifi ? buildWifiQrPayload(qrCode.destination as WifiDestination) : shortLink

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[var(--gold-pale)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/marketplace/qr-code-pro"
            className="flex items-center gap-2 text-white hover:text-[var(--gold-bright)] font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="text-lg font-semibold text-white truncate max-w-xs">{qrCode.label}</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            <div className="sm:col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MousePointerClick className="w-4 h-4" />
                {qrCode.click_count} {t('clicks')}
              </div>

              {isWifi ? (
                <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-3">
                  {t('wifiStaticNotice')}
                </p>
              ) : (
                <div>
                  <p className="text-xs text-gray-500 mb-1">{t('shortLinkLabel')}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 break-all">
                      {shortLink}
                    </code>
                    <CopyLinkButton url={shortLink} />
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-center">
              <OfferMakerQR
                url={qrPayload}
                fileName={`qr-${qrCode.code}`}
                fgColor={qrCode.fg_color}
                bgColor={qrCode.bg_color}
                generatingLabel={t('generating')}
                downloadLabel={t('downloadQr')}
                accentClassName="bg-[var(--ink)] hover:bg-[var(--ink-soft)]"
              />
            </div>
          </div>
        </div>

        <QrProForm
          mode="edit"
          id={qrCode.id}
          initial={{
            label: qrCode.label,
            contentType: qrCode.content_type as QrContentType,
            destination: qrCode.destination as QrDestination,
            fgColor: qrCode.fg_color,
            bgColor: qrCode.bg_color,
          }}
        />
      </main>
    </div>
  )
}
