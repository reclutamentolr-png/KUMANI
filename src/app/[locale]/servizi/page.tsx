import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Crown } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { getServicesCatalog } from '@/lib/servicesCatalog'
import { getPlanPrices } from '@/lib/planPrices'
import HubHeader from '@/components/nav/HubHeader'
import ServicesBrowser from '@/components/services/ServicesBrowser'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('hub')
  return { title: t('servicesTitle'), robots: { index: false } }
}

// Tutti i servizi in un posto solo, divisi per bisogno, con ricerca e filtri
// (Tutti / I miei / Da sbloccare). Quelli bloccati restano visibili, più
// chiari, con il lucchetto e dove si sbloccano.
export default async function ServicesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('hub')
  const tiersT = await getTranslations('toolTiers')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [{ items, favorites, userPlan }, planPrices] = await Promise.all([getServicesCatalog(supabase, user.id, locale), getPlanPrices()])
  const formatEur = (value: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value)
  const lockedCount = items.filter((item) => !item.open).length

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <HubHeader title={t('servicesTitle')} subtitle={t('servicesSubtitle', { count: items.length })} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <ServicesBrowser items={items} favorites={favorites} />

        {/* Sblocca tutto: solo a chi ha ancora servizi chiusi */}
        {lockedCount > 0 && (
          <section className="rounded-2xl border border-[var(--gold)]/40 bg-[var(--ink)] p-5 text-white shadow-[0_12px_30px_rgba(23,23,23,0.18)] sm:flex sm:items-center sm:justify-between sm:gap-6">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-extrabold">
                <Crown className="h-5 w-5 text-[var(--gold-bright)]" /> {t('unlockTitle')}
              </h2>
              <p className="mt-1 text-sm text-white/70">{t('unlockText', { count: lockedCount })}</p>
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:shrink-0">
              {userPlan === 'none' && (
                <Link
                  href="/billing"
                  className="rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-center text-sm font-extrabold text-[var(--ink)] hover:brightness-105"
                >
                  {tiersT('ctaBase', { price: formatEur(planPrices.base) })}
                </Link>
              )}
              <Link
                href="/pro"
                className={`rounded-xl px-4 py-2.5 text-center text-sm font-extrabold ${
                  userPlan === 'none' ? 'border border-[var(--gold)]/60 text-[var(--gold-bright)] hover:bg-white/5' : 'bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] hover:brightness-105'
                }`}
              >
                {tiersT('ctaPro', { price: formatEur(planPrices.pro) })}
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
