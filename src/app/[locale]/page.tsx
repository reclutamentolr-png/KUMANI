import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { pageMetadata } from '@/lib/seo'
import { getHomeLayout } from '@/lib/homeLayoutServer'
import HomeLanding from '@/components/home/HomeLanding'

type Props = { params: Promise<{ locale: string }> }

// Home pubblica: uguale per tutti, quindi preparata in anticipo per ogni
// lingua e rifatta in background al massimo ogni 5 minuti (prima, e più
// spesso se lo chiedono i dati: lingue attive ogni 60 secondi). Eventi,
// recensioni, donazioni, Kumano del giorno e aspetto scelto dall'Admin sono
// già in memoria per 5-60 minuti (unstable_cache): la pagina non li rende più
// vecchi di prima, e un salvataggio dall'Admin (revalidateTag) la rifà subito.
// L'anteprima degli aspetti (Admin) è in admin/anteprima-home/[layout].
export const revalidate = 300

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  setRequestLocale((await params).locale)
  const t = await getTranslations('seo')
  return pageMetadata('', { title: { absolute: t('homeTitle') }, description: t('homeDescription') })
}

export default async function LandingPage({ params }: Props) {
  setRequestLocale((await params).locale)
  return <HomeLanding layoutKey={await getHomeLayout()} />
}
