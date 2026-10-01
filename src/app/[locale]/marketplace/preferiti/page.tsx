import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, Star } from 'lucide-react'
import { getMarketplaceAccessState } from '@/lib/marketplaceAccess'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getFavoriteToolNames } from '@/lib/favorites'
import FavoritesGrid from '@/components/FavoritesGrid'

export default async function MarketplaceFavoritesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ from?: string }>
}) {
  const { locale } = await params
  const { from } = await searchParams
  const fromDashboard = from === 'dashboard'
  const t = await getTranslations('marketplace')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { isSettingEnabled, isToolEnabled, disabledReason, requiredPlan, passPriceCents } = await getMarketplaceAccessState(supabase, user.id)
  const favoriteToolNames = await getFavoriteToolNames(supabase, user.id)

  const favoriteTools = getMarketplaceTools(t)
    .filter((tool) => favoriteToolNames.includes(tool.toolName) && isSettingEnabled(tool.toolName))
    // Most recently favorited first, matching getFavoriteToolNames' order.
    .sort((a, b) => favoriteToolNames.indexOf(a.toolName) - favoriteToolNames.indexOf(b.toolName))
    .map((tool) => ({
      toolName: tool.toolName,
      isEnabled: isToolEnabled(tool.toolName),
      // Preserve the "came from the dashboard" origin into each tool, same
      // as ToolTiers does — otherwise a tool opened from here
      // (itself reached via the dashboard's "Preferiti" shortcut) loses
      // track of it and its own back-link falls back to "Marketplace".
      href: fromDashboard ? `${tool.href}?from=dashboard` : tool.href,
      gradient: tool.gradient,
      iconName: tool.iconName,
      title: tool.title,
      description: tool.description,
      color: tool.color,
      isPro: requiredPlan(tool.toolName) === 'pro',
      disabledReason: disabledReason(tool.toolName),
      hasPass: passPriceCents(tool.toolName) !== null,
    }))

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-[0_8px_30px_rgba(23,23,23,0.18)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> {commonT('backToDashboard')}
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
            <Star className="h-5 w-5 text-[var(--gold-bright)]" fill="currentColor" /> {t('favoritesTitle')}
          </h1>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8 max-w-2xl">
          <h2 className="mb-3 text-3xl font-bold tracking-tight text-[var(--ink)]">{t('favoritesTitle')}</h2>
          <p className="text-base leading-7 text-[var(--muted)]">{t('favoritesDescription')}</p>
        </div>

        {favoriteTools.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-[var(--gold)]/40 bg-[var(--gold-pale)] p-10 text-center">
            <Star className="mx-auto mb-3 h-10 w-10 text-[var(--gold)]" />
            <h3 className="mb-2 text-lg font-bold text-[var(--ink)]">{t('noFavoritesTitle')}</h3>
            <p className="mx-auto max-w-md text-sm leading-6 text-[var(--muted)]">{t('noFavoritesBody')}</p>
            <Link
              href="/dashboard"
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--ink)] px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[var(--ink-soft)]"
            >
              {t('browseMarketplace')}
            </Link>
          </div>
        ) : (
          <FavoritesGrid initialTools={favoriteTools} />
        )}
      </main>
    </div>
  )
}
