import type { SupabaseClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { getMarketplaceAccessState, type MarketplaceAccessState } from '@/lib/marketplaceAccess'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getFavoriteToolNames } from '@/lib/favorites'
import { serviceGroupOf, type ServiceGroup } from '@/lib/serviceGroups'
import { hubTabKey, TOOL_HUB } from '@/lib/serviceHubs'
import { toolGuideFor } from '@/lib/guides/toolGuides'
import type { CommunityItem } from '@/components/dashboard/CommunityBlock'

// Tutti i servizi accesi dall'Admin, pronti per la pagina Servizi e la Home:
// gruppo per bisogno, se l'utente può aprirli e, se no, come sbloccarli.
export type ServiceItem = {
  toolName: string
  title: string
  // Nome proprio del servizio (es. «Findo»): per i servizi uniti il titolo è
  // «Casa e auto · Dove l'ho messo», ma la ricerca deve trovarlo anche così
  name?: string
  description: string
  iconName: string
  href: string
  group: ServiceGroup
  open: boolean
  plan: 'free' | 'base' | 'pro'
  // Bloccato: dove si sblocca (Pass del singolo servizio, Pro o Plus)
  unlock: 'pass' | 'pro' | 'base' | null
  passPrice: string | null
  guide: string | null
  // Sezioni della Community mostrate come servizi (icone, Home): colore
  // proprio (azzurro) e niente Pass né pagina pubblica (lib/communityItems)
  tone?: string
  community?: boolean
}

export async function getServicesCatalog(
  supabase: SupabaseClient,
  userId: string,
  locale: string,
  // Già letti dalla pagina (es. la Home): non si rileggono
  loaded?: { access: MarketplaceAccessState; favorites: string[] }
) {
  const [tm, th, access, favorites] = await Promise.all([
    getTranslations('marketplace'),
    getTranslations('serviceHubs'),
    loaded?.access ?? getMarketplaceAccessState(supabase, userId),
    loaded?.favorites ?? getFavoriteToolNames(supabase, userId),
  ])
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(cents / 100)

  const items: ServiceItem[] = getMarketplaceTools(tm)
    .filter((tool) => access.isSettingEnabled(tool.toolName))
    .map((tool) => {
      const open = access.isToolEnabled(tool.toolName)
      const plan = access.requiredPlan(tool.toolName)
      const passCents = open ? null : access.passPriceCents(tool.toolName)
      return {
        toolName: tool.toolName,
        // Sicurezza: il servizio e la scheda («Speculum · Email»)
        title: TOOL_HUB[tool.toolName] ? `${th(`${TOOL_HUB[tool.toolName]}.title`)} · ${th(`${TOOL_HUB[tool.toolName]}.tab_${hubTabKey(tool.toolName)}`)}` : tool.title,
        name: tool.title,
        description: tool.description,
        iconName: tool.iconName,
        href: tool.href,
        group: serviceGroupOf(tool.toolName),
        open,
        plan,
        unlock: open ? null : passCents !== null ? 'pass' : plan === 'pro' ? 'pro' : 'base',
        passPrice: passCents !== null ? money(passCents) : null,
        guide: toolGuideFor(tool.href),
      }
    })

  return { items, favorites, userPlan: access.userPlan }
}

// Sezioni della Community (Bacheca, Kumano del Giorno, Kordata, Eventi,
// Banca del Tempo): accese/spente dall'Admin e bloccate dal piano. Gli
// Eventi si consultano sempre (il piano serve solo per organizzarli).
// access: già letto dalla pagina (es. la Home), così non si rilegge
export async function getCommunityItems(supabase: SupabaseClient, userId: string, loadedAccess?: MarketplaceAccessState): Promise<CommunityItem[]> {
  const [tm, access] = await Promise.all([getTranslations('marketplace'), loadedAccess ?? getMarketplaceAccessState(supabase, userId)])
  return [
    { toolName: 'community-listings', setting: 'listings', href: '/app/listings', iconName: 'Tag', title: tm('listings'), description: tm('listingsDescription') },
    { toolName: 'community-spotlight', setting: 'spotlight', href: '/app/spotlight', iconName: 'Star', title: tm('kumanoDelGiorno'), description: tm('kumanoDelGiornoDescription') },
    { toolName: 'community-convivio', setting: 'convivio', href: '/app/convivio', iconName: 'HandPlatter', title: tm('convivio'), description: tm('convivioDescription') },
    { toolName: 'community-events', setting: 'events', href: '/events', iconName: 'PartyPopper', title: tm('events'), description: tm('eventsDescription') },
    { toolName: 'community-timebank', setting: 'timebank', href: '/app/timebank', iconName: 'Hourglass', title: tm('timebank'), description: tm('timebankDescription') },
    { toolName: 'community-proposals', setting: 'proposte', href: '/community/proposte', iconName: 'Lightbulb', title: tm('proposte'), description: tm('proposteDescription') },
  ]
    .filter((item) => access.isSettingEnabled(item.setting))
    // Eventi: consultarli è sempre gratis
    .map(({ setting, ...item }) => ({ ...item, locked: setting !== 'events' && !access.isToolEnabled(setting), plan: setting === 'events' ? 'free' : access.requiredPlan(setting) }))
    // In ordine di piano: prima Gratis, poi Plus, poi Pro
    .sort((a, b) => PLAN_ORDER[a.plan] - PLAN_ORDER[b.plan])
}

const PLAN_ORDER = { free: 0, base: 1, pro: 2 } as const
