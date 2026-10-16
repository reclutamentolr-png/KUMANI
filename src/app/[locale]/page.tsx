import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo'
import { getAppCounts } from '@/lib/appCounts'
import { getHomeLayout } from '@/lib/homeLayoutServer'
import HomeLanding from '@/components/home/HomeLanding'

type Props = { params: Promise<{ locale: string }> }

// Home pubblica: uguale per tutti, quindi preparata in anticipo per ogni
// lingua e rifatta in background al massimo ogni ora (meno scritture in
// cache su Vercel, piano gratuito). Eventi, lingue attive,
// recensioni, donazioni, Kumano del giorno e aspetto scelto dall'Admin sono
// già in memoria da un'ora a un giorno (unstable_cache): la pagina non li rende più
// vecchi di prima, e un salvataggio dall'Admin (revalidateTag) la rifà subito.
// L'anteprima degli aspetti (Admin) è in admin/anteprima-home/[layout].
export const revalidate = 3600

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  setRequestLocale((await params).locale)
  const [t, counts] = await Promise.all([getTranslations('seo'), getAppCounts()])
  return pageMetadata('', { title: { absolute: t('homeTitle') }, description: t('homeDescription', counts) })
}

export default async function LandingPage({ params }: Props) {
  setRequestLocale((await params).locale)
  return <HomeLanding layoutKey={await getHomeLayout()} />
}
