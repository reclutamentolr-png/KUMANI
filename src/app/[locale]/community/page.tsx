import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboardNetworkData } from '@/lib/dashboardNetworkData'
import { getCommunityItems } from '@/lib/servicesCatalog'
import type { MyProfile } from '@/lib/myProfile'
import AppHeader from '@/components/nav/AppHeader'
import NetworkSummaryCard from '@/components/dashboard/NetworkSummaryCard'
import { CommunityBlock } from '@/components/dashboard/CommunityBlock'
import KumanoDelGiornoPreview from '@/components/dashboard/KumanoDelGiornoPreview'
import DashboardDonations from '@/components/donations/DashboardDonations'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('hub')
  return { title: t('communityTitle'), robots: { index: false } }
}

// Community: la propria rete (riepilogo, il dettaglio è in /dashboard/rete),
// le sezioni della community, il Kumano del Giorno e le donazioni.
export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('hub')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [{ data: profile }, communityItems] = await Promise.all([
    supabase.rpc('get_my_profile').maybeSingle<MyProfile>(),
    getCommunityItems(supabase, user.id),
  ])
  const network = await getDashboardNetworkData(supabase, user, profile, locale, { tree: false, claims: 'skip' })

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('communityTitle')} subtitle={t('communitySubtitle')} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <NetworkSummaryCard network={network} />
        {communityItems.length > 0 && <CommunityBlock items={communityItems} />}
        <KumanoDelGiornoPreview />
        <DashboardDonations />
      </main>
    </div>
  )
}
