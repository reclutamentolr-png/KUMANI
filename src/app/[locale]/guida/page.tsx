import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { getGuidesContent, PUBLIC_GUIDES } from '@/lib/guides/content'
import type { GuideCategory } from '@/lib/guides/types'
import GuidesIndex from '@/components/guides/GuidesIndex'

type Props = { params: Promise<{ locale: string }> }

// Centro guide: uguale per tutti, preparato in anticipo per ogni lingua e
// rifatto in background (al massimo ogni ora; prima se cambiano lingue o
// traduzioni). Chi ha fatto l'accesso vede anche le guide per gli iscritti:
// lo decide il browser (components/guides/GuidesIndex).
export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  setRequestLocale((await params).locale)
  const t = await getTranslations('guides')
  return pageMetadata('/guida', { title: t('metaTitle'), description: t('metaDescription') })
}

export default async function GuidesPage({ params }: Props) {
  const { locale } = await params
  setRequestLocale(locale)
  const [docsT, content] = await Promise.all([getTranslations('documents'), getGuidesContent(locale)])
  const guides = content.guides.map((guide) => ({
    slug: guide.slug,
    category: guide.category,
    title: guide.title,
    summary: guide.summary,
    minutes: guide.minutes,
    steps: guide.steps.length,
    isPublic: PUBLIC_GUIDES.includes(guide.slug),
  }))

  return (
    <GuidesIndex
      guides={guides}
      categories={content.categories}
      order={Object.keys(content.categories) as GuideCategory[]}
      docsLink={{ title: docsT('guideLinkTitle'), text: docsT('guideLinkText') }}
    />
  )
}
