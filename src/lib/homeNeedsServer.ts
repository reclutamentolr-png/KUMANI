import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { HOME_NEEDS, type HomeNeed, type HomeNeedItem } from '@/lib/homeNeeds'
import { collapseByHub, HUB_HOME, HUB_ICON_NAME, HUB_PUBLIC_HREF, HUB_REPRESENTATIVE } from '@/lib/serviceHubs'

// «In cosa possiamo darti una mano?» con i testi della lingua: per ogni
// risposta i servizi giusti. hrefFor sceglie dove porta un servizio (Home
// pubblica: la sua pagina /strumenti; dashboard: lo strumento).
const COMMUNITY: Record<string, { titleKey: string; href: string; iconName: string }> = {
  listings: { titleKey: 'listings', href: '/marketplace/listings', iconName: 'Tag' },
  convivio: { titleKey: 'convivio', href: '/marketplace/convivio', iconName: 'HandPlatter' },
  timebank: { titleKey: 'timebank', href: '/marketplace/timebank', iconName: 'Hourglass' },
  spotlight: { titleKey: 'kumanoDelGiorno', href: '/marketplace/spotlight', iconName: 'Star' },
}

export async function buildHomeNeeds(hrefFor: (toolName: string) => string = (name) => `/strumenti/${name}`): Promise<HomeNeed[]> {
  const [tNeeds, tMarket, tSurprise, tHubs] = await Promise.all([getTranslations('homeNeeds'), getTranslations('marketplace'), getTranslations('surprise'), getTranslations('serviceHubs')])
  const toolsByName = new Map(getMarketplaceTools(tMarket).map((tool) => [tool.toolName, tool]))
  return HOME_NEEDS.map((need) => ({
    key: need.key,
    icon: need.icon,
    label: tNeeds(`need_${need.key}`),
    short: tNeeds(`short_${need.key}`),
    intro: tNeeds(`intro_${need.key}`),
    // La sicurezza come tre servizi (Home pubblica: le loro pagine aperte a tutti)
    items: collapseByHub(
      (need.items as readonly string[]).flatMap((name): HomeNeedItem[] => {
      if (name === 'events') return [{ name, title: tMarket('events'), description: tMarket('eventsDescription'), href: '/events', iconName: 'Users' }]
      // Sezioni della Community (non sono servizi del Marketplace)
      const community = COMMUNITY[name]
      if (community) return [{ name, title: tMarket(community.titleKey), description: tMarket(`${community.titleKey}Description`), href: community.href, iconName: community.iconName }]
      if (name === 'sorprese') return [{ name, title: `KUMANI ${tSurprise('title')}`, description: tSurprise('intro'), href: '/sorprese', iconName: 'Gift' }]
      const tool = toolsByName.get(name)
      return tool ? [{ name, title: tool.title.split(/\s[-–—]\s/)[0], description: tool.description, href: hrefFor(name), iconName: tool.iconName }] : []
      }).map((item) => ({ ...item, toolName: item.name })),
      (hub) => ({
        name: `hub-${hub}`,
        toolName: `hub-${hub}`,
        title: tHubs(`${hub}.title`),
        description: tHubs(`${hub}.tagline`),
        href: hrefFor(HUB_REPRESENTATIVE[hub]).startsWith('/strumenti') ? HUB_PUBLIC_HREF[hub] : HUB_HOME[hub],
        iconName: HUB_ICON_NAME[hub],
      })
    ).map((i): HomeNeedItem => ({ name: i.name, title: i.title, description: i.description, href: i.href, iconName: i.iconName })),
  }))
}
