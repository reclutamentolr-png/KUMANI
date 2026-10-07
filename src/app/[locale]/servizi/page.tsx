import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, BookMarked, Crown } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { getCommunityItems, getServicesCatalog } from '@/lib/servicesCatalog'
import { CommunityBlock } from '@/components/dashboard/CommunityBlock'
import { getPlanPrices } from '@/lib/planPrices'
import AppHeader from '@/components/nav/AppHeader'
import ServicesBrowser from '@/components/services/ServicesBrowser'
import { getSessionUser, preloadSession } from '@/lib/session'

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
  // Utente letto una volta sola per la pagina e la sua intestazione
  preloadSession()
  const [t, tiersT, tc, supabase, user] = await Promise.all([
    getTranslations('hub'),
    getTranslations('toolTiers'),
    getTranslations('catalog'),
    createClient(),
    getSessionUser(),
  ])
  if (!user) redirect(`/${locale}/login`)

  const [{ items, favorites, userPlan }, planPrices, communityItems] = await Promise.all([
    getServicesCatalog(supabase, user.id, locale),
    getPlanPrices(),
    getCommunityItems(supabase, user.id),
  ])
  const formatEur = (value: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value)
  const lockedCount = items.filter((item) => !item.open).length

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('servicesTitle')} subtitle={t('servicesSubtitle', { count: items.length })} />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Il catalogo: come funziona ogni servizio, per categorie (anche in PDF) */}
        <Link
          href="/catalogo"
          className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/35 bg-[var(--gold-pale)] px-4 py-3 text-sm font-semibold text-[var(--ink)] transition-colors hover:border-[var(--gold)]"
        >
          <span className="flex items-center gap-2">
            <BookMarked className="h-5 w-5 shrink-0 text-[var(--gold)]" /> {tc('servicesLink')}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
        <ServicesBrowser items={items} favorites={favorites} />

        {/* In fondo: le sezioni della Community (Bacheca, Kordata, Eventi…) */}
        {communityItems.length > 0 && <CommunityBlock items={communityItems} />}

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
