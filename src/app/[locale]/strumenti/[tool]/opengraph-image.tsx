import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { ogCard, OG_SIZE } from '@/components/seo/ogCard'

export const alt = 'KUMANI'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ locale: string; tool: string }> }) {
  const { locale, tool: toolName } = await params
  const tm = await getTranslations({ locale, namespace: 'marketplace' })
  const tool = getMarketplaceTools(tm).find((item) => item.toolName === toolName)
  return ogCard({ title: tool?.title ?? 'KUMANI', subtitle: tool?.description })
}
