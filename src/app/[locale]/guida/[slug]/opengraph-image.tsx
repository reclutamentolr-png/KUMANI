import { getGuidesContent } from '@/lib/guides/content'
import { ogCard, OG_SIZE } from '@/components/seo/ogCard'

export const alt = 'KUMANI'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const content = await getGuidesContent(locale)
  const guide = content.guides.find((g) => g.slug === slug)
  return ogCard({ eyebrow: guide ? content.categories[guide.category].title : undefined, title: guide?.title ?? 'KUMANI', subtitle: guide?.summary })
}
