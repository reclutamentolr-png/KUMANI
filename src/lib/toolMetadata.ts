import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'

// Titolo della scheda del browser per le pagine dei servizi: il nome del
// servizio nella lingua della pagina (il layout aggiunge « | KUMANI»).
// Per le pagine fuori dall'elenco dei servizi: [namespace, chiave] o un nome fisso.
const EXTRA: Record<string, [string, string] | string> = {
  chat: ['chat', 'pageTitle'],
  convivio: 'Kordata',
  listings: ['marketplace', 'listings'],
  preferiti: ['marketplace', 'favoritesTitle'],
  spotlight: ['spotlight', 'title'],
  timebank: 'KUMANI Time Bank',
}

export function toolMetadata(dir: string) {
  return async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    const { locale } = await params
    const extra = EXTRA[dir]
    if (typeof extra === 'string') return { title: extra }
    if (extra) {
      const t = await getTranslations({ locale, namespace: extra[0] })
      return { title: t(extra[1]) }
    }
    const t = await getTranslations({ locale, namespace: 'marketplace' })
    const tool = getMarketplaceTools((key) => t(key)).find((x) => x.href === `/marketplace/${dir}` || x.toolName === dir)
    return tool ? { title: tool.title } : {}
  }
}
