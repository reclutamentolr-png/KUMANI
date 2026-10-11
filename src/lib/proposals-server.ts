import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'

// Nomi dei servizi (per «Riguarda un servizio che c'è già»)
export async function proposalServices(): Promise<{ value: string; label: string }[]> {
  const tm = await getTranslations('marketplace')
  const tools = getMarketplaceTools((key) => tm(key)).map((tool) => ({ value: tool.toolName, label: tool.title }))
  const community = ['listings', 'convivio', 'timebank', 'events'].map((key) => ({ value: key, label: tm(key) }))
  const seen = new Set<string>()
  return [...tools, ...community]
    .filter((s) => (seen.has(s.value) ? false : (seen.add(s.value), true)))
    .sort((a, b) => a.label.localeCompare(b.label))
}
