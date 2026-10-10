import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Store } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import ShopManager from '@/components/shop/ShopManager'
import { getMyShop } from '@/app/actions/shopStore'
import { getSellerPaymentsDetail } from '@/app/actions/shop'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('shop')
  return { title: t('title'), robots: { index: false, follow: false } }
}

// KUMANI Shop (piano Pro): la pagina è protetta dal proxy come gli altri strumenti.
export default async function ShopPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [t, tc, locale, { tab }] = await Promise.all([getTranslations('shop'), getTranslations('common'), getLocale(), searchParams])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=/marketplace/shop`)
  // Prima lo stato del conto Stripe (aggiorna anche il database), poi il negozio
  const payments = await getSellerPaymentsDetail()
  const shop = await getMyShop()
  if (!shop) redirect(`/${locale}/pro?tool=shop`)
  const initialTab = tab === 'orders' ? 'orders' : tab === 'products' ? 'products' : tab === 'payments' ? 'payments' : 'shop'

  return (
    <div className="min-h-screen bg-[var(--background)] pb-24">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToDashboard')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" />
            {t('back')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <Store className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)]">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('eyebrow')}</p>
          <h2 className="relative mt-2 text-2xl font-bold sm:text-3xl">{t('heroTitle')}</h2>
          <p className="relative mt-2 text-white/70">{t('heroText')}</p>
        </div>
        <ShopManager userId={user.id} initial={shop} initialTab={initialTab} payments={payments} />
      </main>
    </div>
  )
}
