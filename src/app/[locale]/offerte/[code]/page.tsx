import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { MessageCircle, ShieldCheck } from 'lucide-react'
import { whatsappDigits } from '@/lib/clienti'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

interface PublicCampaign {
  code: string
  locale: string
  campaign_title: string
  headline: string
  offer_summary: string
  description: string
  cta_label: string
  whatsapp_message_direct: string
  contact_whatsapp: string
  objective: string
}

export default async function OfferLandingPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('get_offer_campaign_by_code', { p_code: code })
    .single() as { data: PublicCampaign | null; error: unknown }

  if (error || !data) {
    notFound()
  }

  const campaign = data
  // Numero completo per wa.me: senza prefisso (es. 328…) si aggiunge il +39,
  // altrimenti WhatsApp leggerebbe «32» come il Belgio
  const whatsappNumber = whatsappDigits(campaign.contact_whatsapp) ?? ''
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(campaign.whatsapp_message_direct)}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-purple-50">
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-violet-100 text-violet-700 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            <ShieldCheck className="w-4 h-4" />
            {campaign.campaign_title}
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">{campaign.headline}</h1>
          <p className="text-xl text-violet-700 font-semibold mb-6">{campaign.offer_summary}</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 sm:p-8 mb-8">
          <p className="text-gray-700 leading-relaxed">{campaign.description}</p>
        </div>

        <div className="text-center">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            <MessageCircle className="w-6 h-6" />
            {campaign.cta_label}
          </a>
        </div>

      </main>
    </div>
  )
}
