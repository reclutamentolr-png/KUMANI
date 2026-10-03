import { loadPublicLanding } from '@/lib/landing-public'
import { ogCard, OG_SIZE } from '@/components/seo/ogCard'

export const alt = 'KUMANI'
export const size = OG_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const page = await loadPublicLanding(slug)
  if (!page) return ogCard({ title: 'KUMANI' })
  const { hero, contacts } = page.content
  return ogCard({
    eyebrow: contacts.city || undefined,
    title: hero.name || hero.title || 'KUMANI',
    subtitle: hero.name && hero.title ? hero.title : hero.subtitle || undefined,
    footer: `kumani.io/p/${page.slug}`,
  })
}
