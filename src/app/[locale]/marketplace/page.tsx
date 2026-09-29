import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { getTranslations } from 'next-intl/server'
import { Megaphone, ShieldCheck, CalendarClock, Waves, Briefcase, Tag, ArrowRight, Crown, PartyPopper } from 'lucide-react'
import { getMarketplaceAccessState } from '@/lib/marketplaceAccess'
import { getMarketplaceTools, MARKETPLACE_CATEGORIES, type MarketplaceCategory } from '@/lib/marketplaceTools'

const CATEGORY_ICONS: Record<MarketplaceCategory, typeof Megaphone> = {
  marketing: Megaphone,
  security: ShieldCheck,
  personal: CalendarClock,
  wellness: Waves,
  lavoro: Briefcase,
  svago: PartyPopper,
  community: Tag,
}

export default async function MarketplacePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('marketplace')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { isSettingEnabled } = await getMarketplaceAccessState(supabase, user.id)

  const tools = getMarketplaceTools(t)
  const visibleTools = tools.filter((tool) => isSettingEnabled(tool.toolName))

  const categoryLabels: Record<MarketplaceCategory, string> = {
    marketing: t('categoryMarketing'),
    security: t('categorySecurity'),
    personal: t('categoryPersonal'),
    wellness: t('categoryWellness'),
    lavoro: t('categoryLavoro'),
    svago: t('categorySvago'),
    community: t('categoryCommunity'),
  }

  const categoryDescriptions: Record<MarketplaceCategory, string> = {
    marketing: t('categoryMarketingDesc'),
    security: t('categorySecurityDesc'),
    personal: t('categoryPersonalDesc'),
    wellness: t('categoryWellnessDesc'),
    lavoro: t('categoryLavoroDesc'),
    svago: t('categorySvagoDesc'),
    community: t('categoryCommunityDesc'),
  }

  // Community (Bacheca Annunci) isn't in the generic tools list — it's
  // always available, never admin-gated the way the rest of the tools are.
  const categoryTiles = MARKETPLACE_CATEGORIES.map((category) => ({
    category,
    label: categoryLabels[category],
    description: categoryDescriptions[category],
    toolCount: category === 'community' ? 5 : visibleTools.filter((tool) => tool.category === category).length,
  })).filter((tile) => tile.toolCount > 0)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-[0_8px_30px_rgba(23,23,23,0.18)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] transition-colors hover:text-white">
            <span aria-hidden="true">←</span> {t('backToDashboard')}
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white"><Crown className="h-5 w-5 text-[var(--gold-bright)]" /> {t('title')}</h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.28em] text-[var(--gold)]">Kumani Digital Suite</p>
          <h2 className="mb-4 text-4xl font-bold tracking-tight text-[var(--ink)] sm:text-5xl">{t('subtitle')}</h2>
          <p className="text-base leading-7 text-[var(--muted)]">{t('description')}</p>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
          {categoryTiles.map((tile) => {
            const Icon = CATEGORY_ICONS[tile.category]
            return (
              <Link
                key={tile.category}
                href={`/marketplace/category/${tile.category}`}
                className="group relative flex min-h-[220px] h-full flex-col overflow-hidden rounded-xl border border-[var(--gold)]/45 bg-[var(--ink)] p-6 text-white shadow-[0_12px_35px_rgba(23,23,23,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--gold-bright)] hover:shadow-[0_18px_45px_rgba(23,23,23,0.24)]"
              >
                <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 transition-transform duration-500 group-hover:scale-125"></div>
                <div className="relative z-10 flex h-full flex-col">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-[var(--gold)]/55 bg-[var(--gold)]/10 shadow-md">
                    <Icon className="h-7 w-7 text-[var(--gold-bright)]" />
                  </div>
                  <h3 className="mb-1 text-xl font-bold text-white">{tile.label}</h3>
                  <p className="mb-4 text-sm leading-6 text-stone-300">{tile.description}</p>
                  <div className="mt-auto flex items-center justify-between text-sm font-semibold text-[var(--gold-bright)]">
                    <span>{t('categoryToolCount', { count: tile.toolCount })}</span>
                    <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
