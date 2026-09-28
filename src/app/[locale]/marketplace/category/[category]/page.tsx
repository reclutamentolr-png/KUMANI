import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ArrowRight, HandPlatter, Hourglass, PartyPopper, Sparkles, Star, Tag } from 'lucide-react'
import MarketplaceCard from '@/components/MarketplaceCard'
import { getMarketplaceAccessState } from '@/lib/marketplaceAccess'
import { getMarketplaceTools, MARKETPLACE_CATEGORIES, type MarketplaceCategory } from '@/lib/marketplaceTools'

function isMarketplaceCategory(value: string): value is MarketplaceCategory {
  return (MARKETPLACE_CATEGORIES as readonly string[]).includes(value)
}

export default async function MarketplaceCategoryPage({
  params,
}: {
  params: Promise<{ locale: string; category: string }>
}) {
  const { locale, category } = await params
  if (!isMarketplaceCategory(category)) notFound()

  const t = await getTranslations('marketplace')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { isSettingEnabled, isToolEnabled, disabledReason, requiredPlan } = await getMarketplaceAccessState(supabase, user.id)

  const categoryLabels: Record<MarketplaceCategory, string> = {
    marketing: t('categoryMarketing'),
    security: t('categorySecurity'),
    personal: t('categoryPersonal'),
    wellness: t('categoryWellness'),
    lavoro: t('categoryLavoro'),
    affinity: t('categoryAffinity'),
    svago: t('categorySvago'),
    community: t('categoryCommunity'),
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-[0_8px_30px_rgba(23,23,23,0.18)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/marketplace" className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] transition-colors hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {t('backToMarketplace')}
          </Link>
          <h1 className="text-lg font-semibold tracking-tight text-white">{categoryLabels[category]}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="mb-8 text-3xl font-bold tracking-tight text-[var(--ink)]">{categoryLabels[category]}</h2>

        {category === 'community' ? (
          <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/marketplace/listings"
              className="group relative flex min-h-[356px] h-full flex-col overflow-hidden rounded-xl border border-[var(--gold)]/45 bg-[var(--ink)] p-6 text-white shadow-[0_12px_35px_rgba(23,23,23,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--gold-bright)] hover:shadow-[0_18px_45px_rgba(23,23,23,0.24)]"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 transition-transform duration-500 group-hover:scale-125"></div>
              <div className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/5"></div>

              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--gold)]/55 bg-[var(--gold)]/10 shadow-md">
                    <Tag className="h-7 w-7 text-[var(--gold-bright)]" />
                  </div>
                  <span className="flex items-center gap-1 rounded-full border border-[var(--gold)]/45 bg-[var(--gold)]/15 px-2.5 py-1 text-xs font-bold text-[var(--gold-bright)]">
                    <Sparkles className="h-3 w-3" /> {t('points', { count: 10 })}
                  </span>
                </div>
                <h3 className="mb-1 text-xl font-bold text-white">{t('listings')}</h3>
                <p className="mb-4 text-sm leading-6 text-stone-300">{t('listingsDescription')}</p>
                <div className="mt-auto flex items-center text-sm font-semibold text-[var(--gold-bright)] transition-transform group-hover:translate-x-1">
                  {t('goToListings')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </Link>

            <Link
              href="/marketplace/spotlight"
              className="group relative flex min-h-[356px] h-full flex-col overflow-hidden rounded-xl border border-[var(--gold)]/45 bg-[var(--ink)] p-6 text-white shadow-[0_12px_35px_rgba(23,23,23,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--gold-bright)] hover:shadow-[0_18px_45px_rgba(23,23,23,0.24)]"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 transition-transform duration-500 group-hover:scale-125"></div>
              <div className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/5"></div>

              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--gold)]/55 bg-[var(--gold)]/10 shadow-md">
                  <Star className="h-7 w-7 text-[var(--gold-bright)]" />
                </div>
                <h3 className="mb-1 text-xl font-bold text-white">{t('kumanoDelGiorno')}</h3>
                <p className="mb-4 text-sm leading-6 text-stone-300">{t('kumanoDelGiornoDescription')}</p>
                <div className="mt-auto flex items-center text-sm font-semibold text-[var(--gold-bright)] transition-transform group-hover:translate-x-1">
                  {t('goToSpotlight')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </Link>

            <Link
              href="/marketplace/convivio"
              className="group relative flex min-h-[356px] h-full flex-col overflow-hidden rounded-xl border border-[var(--gold)]/45 bg-[var(--ink)] p-6 text-white shadow-[0_12px_35px_rgba(23,23,23,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--gold-bright)] hover:shadow-[0_18px_45px_rgba(23,23,23,0.24)]"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 transition-transform duration-500 group-hover:scale-125"></div>
              <div className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/5"></div>

              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--gold)]/55 bg-[var(--gold)]/10 shadow-md">
                  <HandPlatter className="h-7 w-7 text-[var(--gold-bright)]" />
                </div>
                <h3 className="mb-1 text-xl font-bold text-white">{t('convivio')}</h3>
                <p className="mb-4 text-sm leading-6 text-stone-300">{t('convivioDescription')}</p>
                <div className="mt-auto flex items-center text-sm font-semibold text-[var(--gold-bright)] transition-transform group-hover:translate-x-1">
                  {t('goToConvivio')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </Link>
            <Link
              href="/events"
              className="group relative flex min-h-[356px] h-full flex-col overflow-hidden rounded-xl border border-[var(--gold)]/45 bg-[var(--ink)] p-6 text-white shadow-[0_12px_35px_rgba(23,23,23,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--gold-bright)] hover:shadow-[0_18px_45px_rgba(23,23,23,0.24)]"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 transition-transform duration-500 group-hover:scale-125"></div>
              <div className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/5"></div>

              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--gold)]/55 bg-[var(--gold)]/10 shadow-md">
                  <PartyPopper className="h-7 w-7 text-[var(--gold-bright)]" />
                </div>
                <h3 className="mb-1 text-xl font-bold text-white">{t('events')}</h3>
                <p className="mb-4 text-sm leading-6 text-stone-300">{t('eventsDescription')}</p>
                <div className="mt-auto flex items-center text-sm font-semibold text-[var(--gold-bright)] transition-transform group-hover:translate-x-1">
                  {t('goToEvents')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </Link>
            <Link
              href="/marketplace/timebank"
              className="group relative flex min-h-[356px] h-full flex-col overflow-hidden rounded-xl border border-[var(--gold)]/45 bg-[var(--ink)] p-6 text-white shadow-[0_12px_35px_rgba(23,23,23,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--gold-bright)] hover:shadow-[0_18px_45px_rgba(23,23,23,0.24)]"
            >
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 transition-transform duration-500 group-hover:scale-125"></div>
              <div className="absolute -bottom-16 -left-8 h-36 w-36 rounded-full border border-[var(--gold)]/20 bg-[var(--gold)]/5"></div>

              <div className="relative z-10 flex h-full flex-col">
                <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-xl border border-[var(--gold)]/55 bg-[var(--gold)]/10 shadow-md">
                  <Hourglass className="h-7 w-7 text-[var(--gold-bright)]" />
                </div>
                <h3 className="mb-1 text-xl font-bold text-white">{t('timebank')}</h3>
                <p className="mb-4 text-sm leading-6 text-stone-300">{t('timebankDescription')}</p>
                <div className="mt-auto flex items-center text-sm font-semibold text-[var(--gold-bright)] transition-transform group-hover:translate-x-1">
                  {t('goToTimebank')}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </div>
              </div>
            </Link>
          </div>
        ) : (
          (() => {
            const categoryTools = getMarketplaceTools(t).filter(
              (tool) => tool.category === category && isSettingEnabled(tool.toolName)
            )

            if (categoryTools.length === 0) {
              return <p className="text-sm text-[var(--muted)]">{t('noToolsInCategory')}</p>
            }

            return (
              <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
                {categoryTools.map((tool) => (
                  <MarketplaceCard
                    key={tool.toolName}
                    toolName={tool.toolName}
                    isEnabled={isToolEnabled(tool.toolName)}
                    href={tool.href}
                    gradient={tool.gradient}
                    iconName={tool.iconName}
                    title={tool.title}
                    description={tool.description}
                    color={tool.color}
                    disabledReason={disabledReason(tool.toolName)}
                    isPro={requiredPlan(tool.toolName) === 'pro'}
                  />
                ))}
              </div>
            )
          })()
        )}
      </main>
    </div>
  )
}
