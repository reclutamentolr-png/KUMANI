import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, ListChecks, PlusCircle } from 'lucide-react'
import OfferMakerCampaignCard from '@/components/OfferMakerCampaignCard'

export default async function OfferMakerCampaignsPage() {
  const t = await getTranslations('offermaker')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: campaigns } = await supabase
    .from('offermaker_campaigns')
    .select('id, code, campaign_title, status, click_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/marketplace/offermaker"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMarketplace')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <ListChecks className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('myCampaigns')}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="relative mb-8 flex flex-col gap-4 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <h2 className="relative text-2xl font-bold sm:text-3xl">{t('myCampaigns')}</h2>
          <Link
            href="/marketplace/offermaker"
            className="relative flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all"
          >
            <PlusCircle className="w-5 h-5" />
            {t('newCampaign')}
          </Link>
        </div>

        {campaigns && campaigns.length > 0 ? (
          <div className="space-y-4">
            {campaigns.map((campaign) => (
              <OfferMakerCampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white text-[var(--muted)]">
            <ListChecks className="w-12 h-12 mx-auto mb-4 text-[var(--gold)]" />
            <p>{t('noCampaignsYet')}</p>
          </div>
        )}
      </main>
    </div>
  )
}
