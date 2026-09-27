import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/siteUrl'

// Le aree private (dashboard, admin, strumenti) non vanno indicizzate.
export default function robots(): MetadataRoute.Robots {
  const privateAreas = ['/admin', '/auth', '/dashboard', '/marketplace', '/wallet', '/billing', '/api', '/rewards', '/viaggi', '/events/my', '/events/pass']
  const locales = ['en', 'fr', 'es', 'pt', 'de', 'ru']
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...privateAreas, ...locales.flatMap((l) => privateAreas.map((p) => `/${l}${p}`))],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
