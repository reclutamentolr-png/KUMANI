import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import PublicPageOffline from '@/components/PublicPageOffline'

// Arrivo da un QR code PRO (/q/…) o da un'offerta (/o/…) non più attivi:
// prima si finiva sulla homepage senza capire perché
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'common' })
  return { title: t('publicOfflineQrTitle'), robots: { index: false, follow: false } }
}

export default async function QrNotActivePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  return <PublicPageOffline kind="qr" />
}
