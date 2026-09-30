import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, Gift } from 'lucide-react'
import RewardsGrid from '@/components/RewardsGrid'
import { isRewardsCatalogEnabled } from '@/lib/rewardsCatalog'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function RewardsPage() {
  const t = await getTranslations('rewards')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  // Catalogo Premi spento dall'Admin: si torna al Portafoglio
  if (!(await isRewardsCatalogEnabled(supabase))) redirect('/wallet')

  const { data: profile } = await supabase.from('profiles').select('network_points').eq('id', user.id).single()

  const { data: rewards } = await supabase
    .from('reward_catalog')
    .select('id, title, description, image_url, points_cost')
    .eq('is_visible', true)
    .order('points_cost', { ascending: true })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[var(--gold-pale)]">
      <header className="sticky top-0 z-10 border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/wallet"
            className="flex items-center gap-2 font-medium text-gray-600 transition-colors hover:text-[var(--gold)]"
          >
            <ArrowLeft className="h-5 w-5" />
            {t('backToWallet')}
          </Link>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 p-2">
              <Gift className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <p className="mb-6 max-w-2xl text-gray-600">{t('intro')}</p>
        <RewardsGrid rewards={rewards || []} initialBalance={profile?.network_points || 0} />
      </main>
    </div>
  )
}
