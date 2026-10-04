import type { MetadataRoute } from 'next'
import { CANONICAL_ORIGIN, isIndexableHost } from '@/lib/seo'

// Le aree private (dashboard, admin, strumenti) non vanno indicizzate.
// Fuori dal dominio definitivo (anteprime Vercel, localhost) niente di niente.
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!(await isIndexableHost())) return { rules: { userAgent: '*', disallow: '/' } }
  const privateAreas = ['/admin', '/auth', '/dashboard', '/marketplace', '/wallet', '/billing', '/api', '/rewards', '/viaggi', '/events/my', '/events/pass', '/documenti', '/servizi', '/community', '/c/', '/f/', '/m/', '/o/', '/q/']
  const locales = ['en', 'fr', 'es', 'pt', 'de', 'ru']
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...privateAreas, ...locales.flatMap((l) => privateAreas.map((p) => `/${l}${p}`))],
    },
    sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
  }
}
