import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/siteUrl'

// Pagine pubbliche in tutte le lingue (italiano senza prefisso).
const LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']
const PAGES = ['', '/chi-siamo', '/pro', '/events', '/spotlight', '/register', '/login', '/terms', '/privacy', '/contact']

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (locale: string, page: string) => `${SITE_URL}${locale === 'it' ? '' : `/${locale}`}${page}` || SITE_URL
  return PAGES.map((page) => ({
    url: url('it', page),
    changeFrequency: page === '' ? 'weekly' : 'monthly',
    priority: page === '' ? 1 : 0.6,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, url(l, page)])) },
  }))
}
