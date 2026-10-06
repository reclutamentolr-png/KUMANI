import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getDashboardNetworkData } from '@/lib/dashboardNetworkData'
import { getCommunityItems } from '@/lib/servicesCatalog'
import AppHeader from '@/components/nav/AppHeader'
import NetworkSummaryCard from '@/components/dashboard/NetworkSummaryCard'
import { CommunityBlock } from '@/components/dashboard/CommunityBlock'
import KumanoDelGiornoPreview from '@/components/dashboard/KumanoDelGiornoPreview'
import DashboardDonations from '@/components/donations/DashboardDonations'
import { getSessionProfile, getSessionUser, preloadSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('hub')
  return { title: t('communityTitle'), robots: { index: false } }
}

// Community: la propria rete (riepilogo, il dettaglio è in /dashboard/rete),
// le sezioni della community, il Kumano del Giorno e le donazioni.
export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  // Utente letto una volta sola per la pagina e la sua intestazione
  preloadSession()
  const [t, supabase, user] = await Promise.all([getTranslations('hub'), createClient(), getSessionUser()])
  if (!user) redirect(`/${locale}/login`)

  // Profilo condiviso con l'intestazione (una sola lettura); la rete parte
  // subito e lo usa solo dopo le sue letture.
  const [communityItems, network] = await Promise.all([
    getCommunityItems(supabase, user.id),
    getDashboardNetworkData(supabase, user, getSessionProfile(), locale, { tree: false, claims: 'skip' }),
  ])

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
