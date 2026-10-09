import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import SurpriseExperience from '@/components/surprise/SurpriseExperience'
import { loadPublicSurprise, surpriseShareInfo } from '@/lib/surpriseServer'

// Pagina di chi riceve la sorpresa: niente account, niente motori di ricerca.
// Le tappe ancora chiuse non arrivano al browser.
export const dynamic = 'force-dynamic'

// Titolo e descrizione dell'anteprima del link (l'immagine è in
// opengraph-image.tsx): per chi è e da parte di chi, nient'altro
export async function generateMetadata({ params }: { params: Promise<{ locale: string; token: string }> }): Promise<Metadata> {
  const { locale, token } = await params
  const [info, t] = await Promise.all([surpriseShareInfo(token), getTranslations({ locale, namespace: 'surprise' })])
  const title = info ? `🎁 ${t(`occasionTitle_${info.occasion ?? 'generic'}`)} ${info.recipient_name || ''}`.trim() : '🎁 KUMANI'
  const description = info?.sender_name ? t('ogDescription', { name: info.sender_name }) : t('ogDescriptionNoSender')
  return {
    title: { absolute: title },
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, type: 'website', siteName: 'KUMANI' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function SurprisePublicPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const view = await loadPublicSurprise(token)
  if (!view) notFound()
  return <SurpriseExperience view={view} token={token} />
}
