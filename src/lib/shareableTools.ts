import { getMarketplaceTools } from '@/lib/marketplaceTools'

// Servizi che hanno un video ufficiale da mandare con il link corto
// (kumani.io/v/CODICE): tutti i servizi del marketplace più le sezioni della
// Community. publicPage: c'è la pagina pubblica /strumenti/[servizio].
export type ShareableTool = { toolName: string; title: string; description: string; iconName: string; href: string; publicPage: boolean }

const COMMUNITY = [
  { toolName: 'listings', titleKey: 'listings', iconName: 'Tag', href: '/marketplace/listings' },
  { toolName: 'convivio', titleKey: 'convivio', iconName: 'HandPlatter', href: '/marketplace/convivio' },
  { toolName: 'events', titleKey: 'events', iconName: 'PartyPopper', href: '/events' },
  { toolName: 'timebank', titleKey: 'timebank', iconName: 'Hourglass', href: '/marketplace/timebank' },
  { toolName: 'spotlight', titleKey: 'kumanoDelGiorno', iconName: 'Star', href: '/marketplace/spotlight' },
]

// t: testi del namespace «marketplace»
export function getShareableTools(t: (key: string) => string): ShareableTool[] {
  return [
    ...getMarketplaceTools(t).map((tool) => ({ toolName: tool.toolName, title: tool.title, description: tool.description, iconName: tool.iconName, href: tool.href, publicPage: true })),
    ...COMMUNITY.map((c) => ({ toolName: c.toolName, title: t(c.titleKey), description: t(`${c.titleKey}Description`), iconName: c.iconName, href: c.href, publicPage: false })),
  ]
}

export const SHAREABLE_TOOL_NAMES = new Set(getShareableTools((key) => key).map((tool) => tool.toolName))
