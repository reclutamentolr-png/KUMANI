import { getTranslations } from 'next-intl/server'
import type { LandingLabels } from '@/components/landing/LandingView'
import type { LandingLocale } from '@/lib/landing'

// Titoli automatici della pagina pubblica, nella lingua scelta per la pagina
export async function getLandingLabels(locale: LandingLocale): Promise<LandingLabels> {
  const t = await getTranslations({ locale, namespace: 'landingPublic' })
  const keys = [
    'services', 'about', 'method', 'testimonials', 'testimonialsNote', 'googleReviews', 'gallery', 'hours', 'contacts',
    'call', 'whatsapp', 'email', 'openMap', 'seeMenu', 'vat', 'madeWith', 'createYours',
  ] as const
  return Object.fromEntries(keys.map((k) => [k, t(k)])) as LandingLabels
}
