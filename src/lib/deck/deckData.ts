import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { SERVICE_GROUPS, serviceGroupOf } from '@/lib/serviceGroups'
import { collapseByHub, HUB_ICON_NAME, HUB_REPRESENTATIVE, HUB_TABS, SERVICE_HUBS, type ServiceHub } from '@/lib/serviceHubs'
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

type DeckService = DeckCatalogItem & { group: string; toolName: string }

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

// Schede accese di un servizio unito, nella lingua («Sito e P.IVA, Email…»).
// Le schede senza strumento proprio (Spese condivise) ci sono sempre; «Tutto
// in uno» di Speculum è solo la porta d'ingresso
export function hubTabNames(hub: ServiceHub, enabled: Map<string, DeckPlan>, tsh: (key: string) => string): string[] {
  return HUB_TABS[hub].filter((tab) => (tab.tool ? enabled.has(tab.tool) : tab.key !== 'all')).map((tab) => tsh(`${hub}.tab_${tab.key}`))
}

// Servizi accesi (tool_name → piano richiesto) con nomi e descrizioni nella
// lingua, e quanti sono per piano. I servizi uniti (lib/serviceHubs) sono un
// servizio solo, con le sue schede e il piano del suo strumento principale
// (Spendly: Conti, anche se il Check-up è gratis); tools conta
// ogni strumento («50 strumenti in 22 servizi»).
export function deckServices(
  enabled: Map<string, DeckPlan>,
  tm: (key: string) => string,
  chat: { name: string; description: string },
  tsh: (key: string) => string,
  // false: ogni strumento è un servizio a sé (presentazione aggiornata)
  collapse = true
) {
  const tools: DeckService[] = getMarketplaceTools(tm)
    .filter((tool) => enabled.has(tool.toolName))
    .map((tool) => ({ toolName: tool.toolName, group: serviceGroupOf(tool.toolName) as string, name: tool.title, description: tool.description, plan: enabled.get(tool.toolName)!, iconName: tool.iconName }))
  const community: DeckService[] = COMMUNITY_SERVICES.filter((c) => enabled.has(c.tool)).map((c) => ({
    toolName: c.tool,
    group: 'community',
    name: c.name ? tm(c.name) : chat.name,
    description: c.description ? tm(c.description) : chat.description,
    plan: enabled.get(c.tool)!,
    iconName: c.icon,
  }))
  const services: DeckService[] = !collapse ? [...tools, ...community] : [
    ...collapseByHub(tools, (hub, members) => ({
      toolName: `hub-${hub}`,
      group: members[0].group,
      name: tsh(`${hub}.title`),
      description: `${hubTabNames(hub, enabled, tsh).join(', ')} · ${tsh(`${hub}.description`)}`,
      plan: (members.find((m) => m.toolName === HUB_REPRESENTATIVE[hub]) ?? members[0]).plan,
      iconName: HUB_ICON_NAME[hub],
    })),
    ...community,
  ]
  const count = (plan: DeckPlan) => services.filter((s) => s.plan === plan).length
  return { services, counts: { total: services.length, tools: tools.length + community.length, free: count('free'), base: count('base'), pro: count('pro') } }
}

// Nomi dei servizi uniti nei testi della presentazione, sempre come nella
// barra dell'app: {name_spendly} «Spendly», {hub_spendly} «Spendly (Conti,
// Check-up, Spese condivise)», {tab_controlla_iban} «Speculum · IBAN»,
// {tabname_gestione_warehouse} «Magazzino»
export function fillHubNames(text: string, enabled: Map<string, DeckPlan>, tsh: (key: string) => string): string {
  return text.replace(/\{(name|hub|tab|tabname)_([a-z]+)(?:_([a-z]+))?\}/g, (token, kind: string, hub: string, tab?: string) => {
    if (!(SERVICE_HUBS as readonly string[]).includes(hub)) return token
    const h = hub as ServiceHub
    const title = tsh(`${h}.title`)
    if (kind === 'name') return title
    if (kind === 'hub') {
      const tabs = hubTabNames(h, enabled, tsh)
      return tabs.length ? `${title} (${tabs.join(', ')})` : title
    }
    if (!tab || !HUB_TABS[h].some((t) => t.key === tab)) return token
    const name = tsh(`${h}.tab_${tab}`)
    return kind === 'tab' ? `${title} · ${name}` : name
  })
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
        // Servizi uniti: prima le schede, poi a cosa serve (un po' più lunghi)
        .map(({ toolName, name, description, plan, iconName }) => ({ name, description: shortDescription(description, toolName.startsWith('hub-') ? 190 : 150), plan, iconName }))
      const label = text.label(group)
      return { key: group, label, count: text.count(items.length), sub: text.sub(items.length), notes: text.notes(label, items.length, items.map((i) => i.name).join(', ')), items }
    })
    .filter((g) => g.items.length > 0)
}
