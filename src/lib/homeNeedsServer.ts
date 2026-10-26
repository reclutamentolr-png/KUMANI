import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { HOME_NEEDS, type HomeNeed, type HomeNeedItem } from '@/lib/homeNeeds'
import { getDisabledTools, getToolPlanOf } from '@/lib/freeTools'
import type { RequiredPlan } from '@/lib/plans'
import { collapseByHub, HUB_HOME, HUB_ICON_NAME, HUB_PUBLIC_HREF, HUB_REPRESENTATIVE, HUB_TABS } from '@/lib/serviceHubs'

// «In cosa possiamo darti una mano?» con i testi della lingua: per ogni
// risposta i servizi giusti. hrefFor sceglie dove porta un servizio (Home
// pubblica: la sua pagina /strumenti; dashboard: lo strumento).
const COMMUNITY: Record<string, { titleKey: string; href: string; iconName: string }> = {
  listings: { titleKey: 'listings', href: '/app/listings', iconName: 'Tag' },
  convivio: { titleKey: 'convivio', href: '/app/convivio', iconName: 'HandPlatter' },
  timebank: { titleKey: 'timebank', href: '/app/timebank', iconName: 'Hourglass' },
  spotlight: { titleKey: 'kumanoDelGiorno', href: '/app/spotlight', iconName: 'Star' },
  proposte: { titleKey: 'proposte', href: '/community/proposte', iconName: 'Lightbulb' },
}

export async function buildHomeNeeds(hrefFor: (toolName: string) => string = (name) => `/strumenti/${name}`): Promise<HomeNeed[]> {
  const [tNeeds, tMarket, tSurprise, tHubs, disabled] = await Promise.all([getTranslations('homeNeeds'), getTranslations('marketplace'), getTranslations('surprise'), getTranslations('serviceHubs'), getDisabledTools()])
  const marketTools = getMarketplaceTools(tMarket)
  const toolsByName = new Map(marketTools.map((tool) => [tool.toolName, tool]))
  // Community: il piano della sezione; Eventi e Sorprese si guardano gratis
  const planOf = { ...(await getToolPlanOf([...marketTools.map((tool) => tool.toolName), ...Object.keys(COMMUNITY)])), events: 'free', sorprese: 'free' } as Record<string, RequiredPlan>
  // «Bambini e famiglia» compare quando l'Angolo Bambini è acceso
  return HOME_NEEDS.filter((need) => need.key !== 'family' || !disabled.includes('angolo-bambini')).map((need) => ({
    key: need.key,
    icon: need.icon,
    label: tNeeds(`need_${need.key}`),
    short: tNeeds(`short_${need.key}`),
    intro: tNeeds(`intro_${need.key}`),
    // La sicurezza come tre servizi (Home pubblica: le loro pagine aperte a tutti)
    items: collapseByHub(
      (need.items as readonly string[]).filter((name) => !disabled.includes(name)).flatMap((name): HomeNeedItem[] => {
      if (name === 'events') return [{ name, title: tMarket('events'), description: tMarket('eventsDescription'), href: '/events', iconName: 'Users', plan: planOf.events }]
      // Sezioni della Community (non sono servizi del Marketplace)
      const community = COMMUNITY[name]
      if (community) return [{ name, title: tMarket(community.titleKey), description: tMarket(`${community.titleKey}Description`), href: community.href, iconName: community.iconName, plan: planOf[name] }]
      if (name === 'sorprese') return [{ name, title: `KUMANI ${tSurprise('title')}`, description: tSurprise('intro'), href: '/sorprese', iconName: 'Gift', plan: planOf.sorprese }]
      const tool = toolsByName.get(name)
      return tool ? [{ name, title: tool.title.split(/\s[-–—]\s/)[0], description: tool.description, href: hrefFor(name), iconName: tool.iconName, plan: planOf[name] }] : []
      }).map((item) => ({ ...item, toolName: item.name })),
      (hub, members) => {
        // Home pubblica: le pagine /strumenti di ogni scheda; Dashboard: gli strumenti
        const isPublic = hrefFor(HUB_REPRESENTATIVE[hub]).startsWith('/strumenti')
        const inNeed = new Set(members.map((m) => m.name))
        const tabs = HUB_TABS[hub].filter((tab) => !tab.tool || !disabled.includes(tab.tool)).sort((a, b) => Number(!!b.tool && inNeed.has(b.tool)) - Number(!!a.tool && inNeed.has(a.tool)))
        return {
          name: `hub-${hub}`,
          toolName: `hub-${hub}`,
          title: tHubs(`${hub}.title`),
          description: tHubs(`${hub}.description`),
          href: isPublic ? HUB_PUBLIC_HREF[hub] : HUB_HOME[hub],
          iconName: HUB_ICON_NAME[hub],
          links: tabs.map((tab) => ({ title: tHubs(`${hub}.tab_${tab.key}`), href: tab.tool && isPublic ? hrefFor(tab.tool) : tab.href, plan: tab.tool ? planOf[tab.tool] : undefined })),
        }
      }
    ).map((i): HomeNeedItem => ({ name: i.name, title: i.title, description: i.description, href: i.href, iconName: i.iconName, ...('plan' in i && i.plan ? { plan: i.plan } : {}), ...(i.links ? { links: i.links } : {}) })),
  }))
}
