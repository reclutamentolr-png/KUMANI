import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { HOME_NEEDS, type HomeNeed, type HomeNeedItem } from '@/lib/homeNeeds'

// «In cosa possiamo darti una mano?» con i testi della lingua: per ogni
// risposta i servizi giusti. hrefFor sceglie dove porta un servizio (Home
// pubblica: la sua pagina /strumenti; dashboard: lo strumento).
export async function buildHomeNeeds(hrefFor: (toolName: string) => string = (name) => `/strumenti/${name}`): Promise<HomeNeed[]> {
  const [tNeeds, tMarket, tSurprise] = await Promise.all([getTranslations('homeNeeds'), getTranslations('marketplace'), getTranslations('surprise')])
  const toolsByName = new Map(getMarketplaceTools(tMarket).map((tool) => [tool.toolName, tool]))
  return HOME_NEEDS.map((need) => ({
    key: need.key,
    icon: need.icon,
    label: tNeeds(`need_${need.key}`),
    short: tNeeds(`short_${need.key}`),
    intro: tNeeds(`intro_${need.key}`),
    items: (need.items as readonly string[]).flatMap((name): HomeNeedItem[] => {
      if (name === 'events') return [{ name, title: tMarket('events'), description: tMarket('eventsDescription'), href: '/events', iconName: 'Users' }]
      if (name === 'sorprese') return [{ name, title: `KUMANI ${tSurprise('title')}`, description: tSurprise('intro'), href: '/sorprese', iconName: 'Gift' }]
      const tool = toolsByName.get(name)
      return tool ? [{ name, title: tool.title.split(/\s[-–—]\s/)[0], description: tool.description, href: hrefFor(name), iconName: tool.iconName }] : []
    }),
  }))
}
