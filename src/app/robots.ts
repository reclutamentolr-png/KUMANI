import type { MetadataRoute } from 'next'
import { CANONICAL_ORIGIN, isIndexableHost } from '@/lib/seo'

// Le aree private (dashboard, strumenti) non vanno indicizzate. Admin, accesso
// e API non sono elencati qui (sarebbero una mappa per chi cerca dove
// attaccare): hanno «noindex» nelle intestazioni (next.config.ts).
// Le pagine pubbliche con dati personali (CV, ricevute, tessere, inviti…) non
// sono bloccate qui ma hanno «noindex» (next.config.ts): se Google non potesse
// leggerle, non vedrebbe il divieto e potrebbe elencarne comunque l'indirizzo.
// Fuori dal dominio definitivo (anteprime Vercel, localhost) niente di niente.
export default async function robots(): Promise<MetadataRoute.Robots> {
  if (!(await isIndexableHost())) return { rules: { userAgent: '*', disallow: '/' } }
  const privateAreas = ['/dashboard', '/marketplace', '/wallet', '/billing', '/rewards', '/viaggi', '/events/my', '/events/pass', '/documenti', '/servizi', '/community', '/o/', '/q/']
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
