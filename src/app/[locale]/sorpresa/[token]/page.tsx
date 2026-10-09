import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { setRequestLocale } from 'next-intl/server'
import SurpriseExperience from '@/components/surprise/SurpriseExperience'
import { loadPublicSurprise } from '@/lib/surpriseServer'

// Pagina di chi riceve la sorpresa: niente account, niente motori di ricerca.
// Le tappe ancora chiuse non arrivano al browser.
export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '🎁 KUMANI', robots: { index: false, follow: false } }

export default async function SurprisePublicPage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params
  setRequestLocale(locale)
  const view = await loadPublicSurprise(token)
  if (!view) notFound()
  return <SurpriseExperience view={view} token={token} />
}
