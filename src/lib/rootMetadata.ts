import type { Metadata, Viewport } from 'next'
import { getTranslations } from 'next-intl/server'
import { SITE_URL } from '@/lib/siteUrl'

// Metadati comuni a tutte le pagine (layout della lingua e pagina /billing).
// Titolo, descrizione e anteprima social nella lingua della pagina.
//
// Indicizzazione: decisa senza leggere la richiesta (così le pagine pubbliche
// possono essere preparate in anticipo e tenute in memoria). Solo la
// produzione su Vercel dice "indicizza"; anteprime e locale mai. Le copie
// della produzione fuori dal dominio definitivo (es. *.vercel.app) ricevono
// comunque "X-Robots-Tag: noindex" da next.config.ts, che vale per ogni
// richiesta, anche delle pagine in memoria.
const INDEXABLE = process.env.VERCEL_ENV === 'production'

const OG_LOCALES: Record<string, string> = { it: 'it_IT', en: 'en_GB', fr: 'fr_FR', es: 'es_ES', pt: 'pt_PT', de: 'de_DE', ru: 'ru_RU' }

export async function rootMetadata(locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo' })
  const title = t('siteTitle')
  const description = t('siteDescription')
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: '%s | KUMANI' },
    description,
    authors: [{ name: 'KUMANI' }],
    creator: 'KUMANI',
    publisher: 'KUMANI',
    formatDetection: { email: false, address: false, telephone: false },
    openGraph: {
      type: 'website',
      locale: OG_LOCALES[locale] ?? 'it_IT',
      url: SITE_URL,
      siteName: 'KUMANI',
      title,
      description,
      images: [{ url: '/og-kumani.jpg', width: 1200, height: 630, alt: 'KUMANI' }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-kumani.jpg'] },
    robots: INDEXABLE
      ? { index: true, follow: true, googleBot: { index: true, follow: true, 'max-video-preview': -1, 'max-image-preview': 'large', 'max-snippet': -1 } }
      : { index: false, follow: false },
    icons: {
      icon: [
        { url: '/icon.png', type: 'image/png' },
        { url: '/icon-192.png', type: 'image/png', sizes: '192x192' },
        { url: '/icon-512.png', type: 'image/png', sizes: '512x512' },
      ],
      apple: '/apple-icon.png',
    },
    manifest: '/manifest.webmanifest',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'KUMANI' },
    other: { 'mobile-web-app-capable': 'yes' },
  }
}

export const ROOT_VIEWPORT: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // iPhone: la pagina usa tutto lo schermo e i margini sicuri (env(safe-area-*))
  // tengono il menu in basso sopra la barretta di sistema
  viewportFit: 'cover',
  // Zoom libero: chi vede poco può ingrandire (accessibilità)
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#171717' },
    { media: '(prefers-color-scheme: dark)', color: '#171717' },
  ],
}
