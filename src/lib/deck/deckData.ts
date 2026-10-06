import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { SERVICE_GROUPS, serviceGroupOf } from '@/lib/serviceGroups'
import type { DeckCatalogGroup, DeckCatalogItem, DeckPlan } from '@/lib/deck/types'

// Servizi della presentazione: le schede del Marketplace più i servizi della
// Community, contati solo se accesi dall'Admin (marketplace_settings). La
// Chat è la messaggistica privata della Bacheca: conta come servizio, i suoi
// testi stanno in deckTexts.full.
const COMMUNITY_SERVICES = [
  { tool: 'listings', icon: 'Tag', name: 'listings', description: 'listingsDescription' },
  { tool: 'spotlight', icon: 'Star', name: 'kumanoDelGiorno', description: 'kumanoDelGiornoDescription' },
  { tool: 'convivio', icon: 'HandPlatter', name: 'convivio', description: 'convivioDescription' },
  { tool: 'events', icon: 'PartyPopper', name: 'events', description: 'eventsDescription' },
  { tool: 'timebank', icon: 'Hourglass', name: 'timebank', description: 'timebankDescription' },
  { tool: 'chat', icon: 'MessageCircle', name: null, description: null },
] as const
const PLAN_ORDER: Record<DeckPlan, number> = { free: 0, base: 1, pro: 2 }

type DeckService = DeckCatalogItem & { group: string }

// Descrizione breve per la scheda: intera se corta, altrimenti le frasi che
// stanno nel limite, altrimenti tagliata a fine parola
export function shortDescription(text: string, max = 150): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  let cut = ''
  for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
    const next = cut ? `${cut} ${sentence}` : sentence
    if (next.length > max) break
    cut = next
  }
  if (cut.length >= 60) return cut
  const head = clean.slice(0, max - 1)
  return head.slice(0, head.lastIndexOf(' ')).replace(/[\s,;:–—-]+$/, '') + '…'
}

// Servizi accesi (tool_name → piano richiesto) con nomi e descrizioni nella
// lingua, e quanti sono per piano
export function deckServices(enabled: Map<string, DeckPlan>, tm: (key: string) => string, chat: { name: string; description: string }) {
  const services: DeckService[] = [
    ...getMarketplaceTools(tm)
      .filter((tool) => enabled.has(tool.toolName))
      .map((tool) => ({ group: serviceGroupOf(tool.toolName) as string, name: tool.title, description: tool.description, plan: enabled.get(tool.toolName)!, iconName: tool.iconName })),
    ...COMMUNITY_SERVICES.filter((c) => enabled.has(c.tool)).map((c) => ({
      group: 'community',
      name: c.name ? tm(c.name) : chat.name,
      description: c.description ? tm(c.description) : chat.description,
      plan: enabled.get(c.tool)!,
      iconName: c.icon,
    })),
  ]
  const count = (plan: DeckPlan) => services.filter((s) => s.plan === plan).length
  return { services, counts: { total: services.length, free: count('free'), base: count('base'), pro: count('pro') } }
}

// Servizi per gruppo (ordine della pagina Servizi, poi la Community), dal
// Gratis al Pro, con i testi del gruppo già nella lingua
export function deckCatalog(
  services: DeckService[],
  text: { label: (group: string) => string; count: (n: number) => string; sub: (n: number) => string; notes: (label: string, n: number, names: string) => string }
): DeckCatalogGroup[] {
  return [...SERVICE_GROUPS, 'community']
    .map((group) => {
      const items = services
        .filter((s) => s.group === group)
        .sort((a, b) => PLAN_ORDER[a.plan] - PLAN_ORDER[b.plan])
        .map(({ name, description, plan, iconName }) => ({ name, description: shortDescription(description), plan, iconName }))
      const label = text.label(group)
      return { key: group, label, count: text.count(items.length), sub: text.sub(items.length), notes: text.notes(label, items.length, items.map((i) => i.name).join(', ')), items }
    })
    .filter((g) => g.items.length > 0)
}
