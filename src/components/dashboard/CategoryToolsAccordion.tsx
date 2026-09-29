'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import type { MarketplaceTool, MarketplaceCategory } from '@/lib/marketplaceTools'
import FavoriteStarButton from '@/components/FavoriteStarButton'
import { Megaphone, ShieldCheck, CalendarClock, Waves, Briefcase, ChevronDown, ChevronUp, Smartphone, Lock, Zap, PartyPopper, Users } from 'lucide-react'

const CATEGORY_ICONS: Record<MarketplaceCategory, typeof Megaphone> = {
  marketing: Megaphone,
  security: ShieldCheck,
  personal: CalendarClock,
  wellness: Waves,
  lavoro: Briefcase,
  svago: PartyPopper,
  community: Users,
}

// Each category is its own closed card, same collapsed-until-clicked
// pattern as DirectAffiliatesList / NotYetKumaniList, instead of dumping
// every tool from every category on screen at once.
export default function CategoryToolsAccordion({
  category,
  label,
  toolsLabel,
  tools,
  lockedToolNames,
  proToolNames = [],
  favoriteToolNames,
}: {
  category: MarketplaceCategory
  label: string
  toolsLabel: string
  tools: MarketplaceTool[]
  lockedToolNames: string[]
  // Strumenti del piano Pro (badge PRO; se bloccati portano a "Passa a Pro").
  proToolNames?: string[]
  favoriteToolNames: string[]
}) {
  const t = useTranslations('marketplace')
  const td = useTranslations('dashboard')
  const [open, setOpen] = useState(false)
  const CategoryIcon = CATEGORY_ICONS[category]

  return (
    <div className="rounded-xl border border-[var(--gold)]/25 bg-[var(--paper)] shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--ink)] text-[var(--gold-bright)]">
            <CategoryIcon className="h-5 w-5" strokeWidth={1.7} />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[var(--ink)] truncate">{label}</p>
            <p className="text-xs text-[var(--muted)]">{toolsLabel}</p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-[var(--muted)] shrink-0" />
        ) : (
          <ChevronDown className="h-5 w-5 text-[var(--muted)] shrink-0" />
        )}
      </button>

      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4 pt-0">
          {tools.map((tool) => {
            const Icon = marketplaceIconMap[tool.iconName] || Smartphone
            const locked = lockedToolNames.includes(tool.toolName)
            const isPro = proToolNames.includes(tool.toolName)

            if (locked) {
              return (
                <Link
                  key={tool.toolName}
                  href={isPro ? `/pro?tool=${tool.toolName}` : { pathname: '/billing' }}
                  className="group relative rounded-xl border border-[var(--gold)]/25 bg-[var(--background)] p-4 opacity-50 transition-opacity hover:opacity-80"
                  title={isPro ? t('proRequired') : t('subscriptionRequired')}
                >
                  <span className={`absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold ${isPro ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-red-500 text-white'}`}>
                    {isPro ? t('proRequired') : t('subscriptionRequired')}
                  </span>
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ink)] text-[var(--gold-bright)]">
                    <Lock className="h-4.5 w-4.5" strokeWidth={1.7} />
                  </div>
                  <p className="font-bold text-[var(--ink)] text-sm mb-1 pr-6">{tool.title}</p>
                  <p className="text-xs text-[var(--muted)] leading-5 line-clamp-2 mb-2">{tool.description}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--gold)] group-hover:text-[var(--ink)]">
                    <Zap className="h-3 w-3" /> {td('subscribeNow')}
                  </span>
                </Link>
              )
            }

            return (
              <Link
                key={tool.toolName}
                href={`${tool.href}?from=dashboard`}
                className="group relative rounded-xl border border-[var(--gold)]/25 bg-[var(--background)] p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]/60 hover:shadow-md"
              >
                {(tool.category as string) !== 'community' && (
                  <FavoriteStarButton toolName={tool.toolName} initialIsFavorite={favoriteToolNames.includes(tool.toolName)} variant="light" />
                )}
                {isPro && (
                  <span className="absolute left-14 top-[22px] rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-[var(--ink)]">
                    PRO
                  </span>
                )}
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ink)] text-[var(--gold-bright)]">
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.7} />
                </div>
                <p className="font-bold text-[var(--ink)] text-sm mb-1 pr-6">{tool.title}</p>
                <p className="text-xs text-[var(--muted)] leading-5 line-clamp-2">{tool.description}</p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
