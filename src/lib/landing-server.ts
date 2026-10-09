import { getTranslations } from 'next-intl/server'
import type { LandingLabels } from '@/components/landing/LandingView'
import type { LandingFormLabels } from '@/components/landing/LandingContactForm'
import type { LandingLocale } from '@/lib/landing'

// Titoli automatici della pagina pubblica, nella lingua scelta per la pagina
export async function getLandingLabels(locale: LandingLocale): Promise<LandingLabels> {
  const t = await getTranslations({ locale, namespace: 'landingPublic' })
  const keys = [
    'services', 'about', 'method', 'testimonials', 'testimonialsNote', 'googleReviews', 'gallery', 'hours', 'contacts',
    'call', 'whatsapp', 'email', 'openMap', 'seeMenu', 'seeShop', 'vat', 'madeWith', 'createYours',
  ] as const
  return Object.fromEntries(keys.map((k) => [k, t(k)])) as LandingLabels
}

// Testi del modulo "Scrivimi", nella lingua della pagina
export async function getLandingFormLabels(locale: LandingLocale): Promise<LandingFormLabels> {
  const t = await getTranslations({ locale, namespace: 'landingPublic' })
  const keys = [
    'formTitle', 'formName', 'formContact', 'formContactHint', 'formMessage', 'formConsent', 'formPrivacy', 'formSend', 'formSent', 'formError', 'formTooMany',
  ] as const
  // formConsent contiene {name}: lo sostituisce il modulo
  return Object.fromEntries(keys.map((k) => [k, k === 'formConsent' ? String(t.raw(k)) : t(k)])) as LandingFormLabels
}
