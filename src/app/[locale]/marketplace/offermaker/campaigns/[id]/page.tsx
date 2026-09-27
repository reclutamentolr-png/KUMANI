import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, MousePointerClick, ExternalLink } from 'lucide-react'
import OfferMakerReview from '@/components/OfferMakerReview'
import OfferMakerQR from '@/components/OfferMakerQR'
import CopyLinkButton from '@/components/CopyLinkButton'

export default async function OfferMakerCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const t = await getTranslations('offermaker')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaign } = await supabase
    .from('offermaker_campaigns')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!campaign) notFound()

  const baseUrl = SITE_URL
  const shortLink = `${baseUrl}/o/${campaign.code}`
  const landingUrl = `${baseUrl}/offerte/${campaign.code}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/marketplace/offermaker/campaigns"
            className="flex items-center gap-2 text-gray-600 hover:text-violet-600 font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('myCampaigns')}
          </Link>
          <h1 className="text-lg font-semibold text-gray-800 truncate max-w-xs">{campaign.campaign_title}</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
            <div className="sm:col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MousePointerClick className="w-4 h-4" />
                {campaign.click_count} {t('clicks')}
              </div>

              <div>
                <p className="text-xs text-gray-500 mb-1">{t('shortLinkLabel')}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 break-all">
                    {shortLink}
                  </code>
                  <CopyLinkButton url={shortLink} />
                </div>
              </div>

              <a
                href={landingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium text-violet-600 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                {t('viewLanding')}
              </a>
            </div>

            <div className="flex justify-center">
              <OfferMakerQR
                url={shortLink}
                fileName={`offer-${campaign.code}`}
                generatingLabel={t('generating')}
                downloadLabel={t('downloadQr')}
              />
            </div>
          </div>
        </div>

        <OfferMakerReview
          mode="edit"
          campaignId={campaign.id}
          initialDraft={{
            campaignTitle: campaign.campaign_title,
            headline: campaign.headline,
            offerSummary: campaign.offer_summary,
            description: campaign.description,
            ctaLabel: campaign.cta_label,
            whatsappMessageSoft: campaign.whatsapp_message_soft,
            whatsappMessageDirect: campaign.whatsapp_message_direct,
            whatsappMessageFollowup: campaign.whatsapp_message_followup,
          }}
        />
      </main>
    </div>
  )
}
