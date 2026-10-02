import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/siteUrl'
import { getEnabledLocales } from '@/lib/enabledLocales'

// Pagine pubbliche nelle lingue attive (italiano senza prefisso): le lingue
// spente dall'Admin non compaiono per Google.
const PAGES = ['', '/chi-siamo', '/pro', '/events', '/spotlight', '/register', '/login', '/terms', '/privacy', '/contact', '/donazioni', '/guida', '/guida/registrazione', '/guida/accesso', '/guida/dashboard', '/guida/invito', '/guida/voucher', '/guida/wallet', '/guida/qr-generator', '/guida/whatsapp-messages', '/guida/link-in-bio', '/guida/spotlight', '/guida/events']

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const LOCALES = await getEnabledLocales()
  const url = (locale: string, page: string) => `${SITE_URL}${locale === 'it' ? '' : `/${locale}`}${page}` || SITE_URL
  return PAGES.map((page) => ({
    url: url('it', page),
    changeFrequency: page === '' ? 'weekly' : 'monthly',
    priority: page === '' ? 1 : 0.6,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, url(l, page)])) },
  }))
}
