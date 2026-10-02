'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowRight, ChevronDown, ChevronUp, Lock, Smartphone, Ticket, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import FavoriteStarButton from '@/components/FavoriteStarButton'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import type { MarketplaceCategory, MarketplaceTool } from '@/lib/marketplaceTools'
import { readDashboardReturn, saveDashboardReturn } from '@/lib/dashboardReturn'

type Tier = 'free' | 'base' | 'pro'
const PREVIEW = 8

// Sezioni della Community (Bacheca, Kumano del Giorno, Kordata, Eventi,
// Banca del Tempo): non sono servizi del Marketplace, niente stella.
export type CommunityItem = { toolName: string; href: string; iconName: string; title: string; description: string; locked: boolean }

// Servizi della dashboard in tre fasce: Gratis, Base (49 €) e Pro (149 €).
// Le schede bloccate restano a colori pieni con il lucchetto e l'etichetta
// del piano (più "Solo questo …" se si possono attivare con un Pass): si
// capisce che si sbloccano, non che sono rotte. Stella dei preferiti su tutte.
export default function ToolTiers({
  tools,
  toolPlans,
  lockedToolNames,
  passPrices,
  favoriteToolNames,
  categoryLabels,
  basePrice,
  proPrice,
  community = [],
}: {
  community?: CommunityItem[]
  tools: MarketplaceTool[]
  toolPlans: Record<string, Tier>
  lockedToolNames: string[]
  passPrices: Record<string, string>
  favoriteToolNames: string[]
  categoryLabels: Record<MarketplaceCategory, string>
  basePrice: string
  proPrice: string
}) {
  const t = useTranslations('toolTiers')
  const byTier = (tier: Tier) => tools.filter((tool) => (toolPlans[tool.toolName] ?? 'base') === tier)
  const tiers = (['free', 'base', 'pro'] as const).map((tier) => ({ tier, items: byTier(tier) })).filter((group) => group.items.length > 0)
  const counts = Object.fromEntries(tiers.map(({ tier, items }) => [tier, items.length])) as Record<Tier, number | undefined>
  const anyPass = Object.keys(passPrices).length > 0

  return (
    <div>
      <p className="text-sm leading-6 text-[var(--muted)]">{t('intro')}</p>
      {/* Legenda dei livelli */}
      <div className="mt-3 flex flex-wrap gap-2">
        {counts.free ? <LegendPill dot="bg-emerald-600" label={t('legendFree', { count: counts.free })} /> : null}
        {counts.base ? <LegendPill dot="bg-[var(--gold)]" label={t('legendBase', { price: basePrice, count: counts.base })} /> : null}
        {counts.pro ? <LegendPill dot="bg-[var(--ink)]" label={t('legendPro', { price: proPrice, count: counts.pro })} /> : null}
        {anyPass && (
          <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-[var(--gold)] bg-white px-3 py-1.5 text-xs font-bold text-[var(--ink)]">
            <Ticket className="h-3.5 w-3.5 text-[var(--gold)]" /> {t('legendPass')}
          </span>
        )}
      </div>

      <div className="mt-5 space-y-5">
        {tiers.map(({ tier, items }) => (
          <TierBlock
            key={tier}
            tier={tier}
            items={items}
            lockedToolNames={lockedToolNames}
            passPrices={passPrices}
            favoriteToolNames={favoriteToolNames}
            categoryLabels={categoryLabels}
            basePrice={basePrice}
            proPrice={proPrice}
          />
        ))}
        {community.length > 0 && <CommunityBlock items={community} />}
      </div>
    </div>
  )
}

function CommunityBlock({ items }: { items: CommunityItem[] }) {
  const t = useTranslations('toolTiers')
  return (
    <section className="overflow-hidden rounded-2xl border border-sky-200 bg-[#f5f9fd] shadow-[0_12px_30px_rgba(23,23,23,0.08)]">
      <div className="flex items-start gap-3 border-b border-sky-200 bg-sky-50 px-5 py-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-700 text-white">
          <Users className="h-4.5 w-4.5" />
        </span>
        <div>
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-extrabold text-[var(--ink)]">
            {t('communityTitle')}
            <span className="rounded-full bg-sky-700 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider text-white">{t('communityBadge')}</span>
          </h3>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{t('communitySub')}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {items.map((item) => {
          const Icon = marketplaceIconMap[item.iconName] || Smartphone
          return (
            <Link
              key={item.toolName}
              href={item.locked ? { pathname: '/billing' } : `${item.href}?from=dashboard`}
              onClick={() => saveDashboardReturn('tier-community')}
              className="group relative flex min-h-[150px] flex-col rounded-xl border border-sky-200 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md"
            >
              <div className="relative mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-sky-700 text-white">
                <Icon className="h-4.5 w-4.5" strokeWidth={1.7} />
                {item.locked && (
                  <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[var(--gold)] text-white">
                    <Lock className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-[var(--ink)] group-hover:text-sky-700">{item.title}</p>
              <p className="mt-0.5 line-clamp-3 flex-1 text-xs leading-5 text-[var(--muted)]">{item.description}</p>
              <div className="mt-2">
                {item.locked ? (
                  <span className="rounded-full bg-[var(--gold-pale)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink)]">{t('includedBase')}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                    {t('open')} <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

function LegendPill({ dot, label }: { dot: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/35 bg-white px-3 py-1.5 text-xs font-bold text-[var(--ink)]">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} /> {label}
    </span>
  )
}

const TIER_STYLE: Record<Tier, { box: string; head: string; title: string; sub: string; badge: string; more: string }> = {
  free: {
    box: 'bg-[#f7fcf8] border border-emerald-200',
    head: 'bg-emerald-50 border-b border-emerald-200',
    title: 'text-[var(--ink)]',
    sub: 'text-[var(--muted)]',
    badge: 'bg-emerald-600 text-white',
    more: 'text-emerald-700',
  },
  base: {
    box: 'bg-[#fffaf0] border border-[var(--gold)]/40',
    head: 'bg-[var(--gold-pale)] border-b border-[var(--gold)]/45',
    title: 'text-[var(--ink)]',
    sub: 'text-[var(--ink)]/75',
    badge: 'bg-[var(--gold)] text-white',
    more: 'text-[var(--gold)]',
  },
  pro: {
    box: 'bg-[#24221d] border border-[var(--gold)]/40',
    head: 'bg-[var(--ink)]',
    title: 'text-white',
    sub: 'text-white/70',
    badge: 'bg-[var(--gold-bright)] text-[var(--ink)]',
    more: 'text-[var(--gold-bright)]',
  },
}

function TierBlock({
  tier,
  items,
  lockedToolNames,
  passPrices,
  favoriteToolNames,
  categoryLabels,
  basePrice,
  proPrice,
}: {
  tier: Tier
  items: MarketplaceTool[]
  lockedToolNames: string[]
  passPrices: Record<string, string>
  favoriteToolNames: string[]
  categoryLabels: Record<MarketplaceCategory, string>
  basePrice: string
  proPrice: string
}) {
  const t = useTranslations('toolTiers')
  const returnKey = `tier-${tier}`
  const [expanded, setExpanded] = useState(false)
  const style = TIER_STYLE[tier]
  const active = items.every((tool) => !lockedToolNames.includes(tool.toolName))
  const shown = expanded ? items : items.slice(0, PREVIEW)

  // Ritorno da un servizio aperto da questa fascia: si riapre per intero
  useEffect(() => {
    // Lettura di sessionStorage solo nel browser, dopo il primo disegno
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (readDashboardReturn()?.category === returnKey) setExpanded(true)
  }, [returnKey])

  const title = tier === 'free' ? t('tierFreeTitle') : tier === 'base' ? t('tierBaseTitle') : t('tierProTitle')
  const sub =
    tier === 'free' ? t('tierFreeSub') : tier === 'base' ? t('tierBaseSub', { count: items.length }) : t('tierProSub', { count: items.length })
  const price = tier === 'base' ? basePrice : proPrice

  return (
    <section data-tour={tier === 'free' ? 'free' : undefined} className={`overflow-hidden rounded-2xl shadow-[0_12px_30px_rgba(23,23,23,0.08)] ${style.box}`}>
      <div className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between ${style.head}`}>
        <div>
          <h3 className={`flex flex-wrap items-center gap-2 text-lg font-extrabold ${style.title}`}>
            {title}
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wider ${style.badge}`}>
              {active ? t('active') : t('perYear', { price })}
            </span>
          </h3>
          <p className={`mt-0.5 text-sm ${style.sub}`}>{sub}</p>
        </div>
        {!active && tier !== 'free' && (
          <Link
            href={tier === 'base' ? { pathname: '/billing' } : '/pro'}
            className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-extrabold text-[var(--ink)] shadow-sm hover:brightness-105"
          >
            {tier === 'base' ? t('ctaBase', { price }) : t('ctaPro', { price })}
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        {shown.map((tool) => (
          <ToolCard
            key={tool.toolName}
            tool={tool}
            tier={tier}
            locked={lockedToolNames.includes(tool.toolName)}
            passPrice={passPrices[tool.toolName]}
            isFavorite={favoriteToolNames.includes(tool.toolName)}
            categoryLabel={categoryLabels[tool.category]}
            returnKey={returnKey}
          />
        ))}
      </div>

      {items.length > PREVIEW && (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className={`mx-auto mb-4 flex items-center gap-1 text-sm font-bold ${style.more}`}
        >
          {expanded ? t('showLess') : t('showAll', { count: items.length })}
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      )}
    </section>
  )
}

function ToolCard({
  tool,
  tier,
  locked,
  passPrice,
  isFavorite,
  categoryLabel,
  returnKey,
}: {
  tool: MarketplaceTool
  tier: Tier
  locked: boolean
  passPrice?: string
  isFavorite: boolean
  categoryLabel: string
  returnKey: string
}) {
  const t = useTranslations('toolTiers')
  const Icon = marketplaceIconMap[tool.iconName] || Smartphone
  const href = !locked
    ? `${tool.href}?from=dashboard`
    : passPrice
      ? `/pass/${tool.toolName}`
      : tier === 'pro'
        ? `/pro?tool=${tool.toolName}`
        : { pathname: '/billing' }

  return (
    <Link
      href={href}
      onClick={() => saveDashboardReturn(returnKey)}
      className="group relative flex min-h-[150px] flex-col rounded-xl border border-[var(--gold)]/30 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]/70 hover:shadow-md"
    >
      <FavoriteStarButton toolName={tool.toolName} initialIsFavorite={isFavorite} variant="light" />
      <div className="relative mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--ink)] text-[var(--gold-bright)]">
        <Icon className="h-4.5 w-4.5" strokeWidth={1.7} />
        {locked && (
          <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[var(--gold)] text-white">
            <Lock className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        )}
      </div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">{categoryLabel}</p>
      <p className="pr-7 text-sm font-bold text-[var(--ink)] group-hover:text-[var(--gold)]">{tool.title}</p>
      <p className="mt-0.5 line-clamp-2 flex-1 text-xs leading-5 text-[var(--muted)]">{tool.description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {!locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            {t('open')} <ArrowRight className="h-3 w-3" />
          </span>
        ) : (
          <>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                tier === 'pro' ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-[var(--gold-pale)] text-[var(--ink)]'
              }`}
            >
              {tier === 'pro' ? t('includedPro') : t('includedBase')}
            </span>
            {passPrice && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--gold)] bg-white px-2 py-0.5 text-[11px] font-bold text-[var(--ink)]">
                <Ticket className="h-3 w-3 text-[var(--gold)]" /> {t('passChip', { price: passPrice })}
              </span>
            )}
          </>
        )}
      </div>
    </Link>
  )
}
