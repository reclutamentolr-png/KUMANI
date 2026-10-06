import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, MousePointerClick, QrCode } from 'lucide-react'
import { hasActiveQrProAccess } from '@/lib/qrPro-server'
import QrProForm from '@/components/QrProForm'
import { getMyBusinessProfile } from '@/lib/businessProfile-server'
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
    redirect('/dashboard')
  }

  const { data: qrCode } = await supabase
    .from('qr_pro_codes')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!qrCode) notFound()

  const business = await getMyBusinessProfile(supabase, user.id)

  const baseUrl = SITE_URL
  const shortLink = `${baseUrl}/q/${qrCode.code}`
  const isWifi = qrCode.content_type === 'wifi'
  const qrPayload = isWifi ? buildWifiQrPayload(qrCode.destination as WifiDestination) : shortLink

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-3">
          <Link
            href="/marketplace/qr-code-pro"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex min-w-0 items-center gap-2 font-semibold tracking-wide">
            <QrCode className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            <span className="truncate max-w-[10rem] sm:max-w-xs">{qrCode.label}</span>
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <div className="rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            <div className="sm:col-span-2 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-3 py-1 text-sm font-semibold text-[var(--gold-bright)]">
                <MousePointerClick className="w-4 h-4" />
                {qrCode.click_count} {t('clicks')}
              </div>

              {isWifi ? (
                <p className="text-xs text-white/70 bg-white/[0.06] border border-white/10 rounded-lg p-3">
                  {t('wifiStaticNotice')}
                </p>
              ) : (
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/50 mb-1">{t('shortLinkLabel')}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-white/[0.06] border border-white/10 rounded-lg px-3 py-2 text-sm text-white/90 break-all">
                      {shortLink}
                    </code>
                    <CopyLinkButton
                      url={shortLink}
                      colorClassName="bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] font-bold text-[var(--ink)] hover:brightness-105"
                    />
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
                accentClassName="border border-[var(--gold)]/40 bg-white/10 hover:bg-white/20"
              />
            </div>
          </div>
        </div>

        <QrProForm
          mode="edit"
          id={qrCode.id}
          business={business}
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
