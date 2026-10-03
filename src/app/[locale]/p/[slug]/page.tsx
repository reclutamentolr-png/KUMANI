import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LandingView from '@/components/landing/LandingView'
import ReportLandingButton from '@/components/landing/ReportLandingButton'
import JsonLd from '@/components/seo/JsonLd'
import { CANONICAL_ORIGIN } from '@/lib/seo'
import { landingPhotoUrl } from '@/lib/landing'
import { getLandingLabels } from '@/lib/landing-server'
import { loadPublicLanding } from '@/lib/landing-public'

type Props = { params: Promise<{ slug: string }> }

const OG_LOCALE: Record<string, string> = { it: 'it_IT', en: 'en_GB', fr: 'fr_FR', es: 'es_ES', pt: 'pt_PT', de: 'de_DE', ru: 'ru_RU' }

// Landing Page pubblica di un utente Pro: kumani.io/p/<indirizzo>.
// Una sola lingua (quella scelta dal titolare) e indirizzo canonico senza
// prefisso di lingua.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const page = await loadPublicLanding(slug)
  if (!page) return { title: 'KUMANI', robots: { index: false, follow: false } }
  const { hero, seo } = page.content
  const title = [hero.name, hero.title].filter(Boolean).join(' · ') || 'KUMANI'
  const description = seo.description || hero.subtitle || hero.text.slice(0, 160)
  const url = `${CANONICAL_ORIGIN}/p/${page.slug}`
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: { type: 'website', url, title, description, locale: OG_LOCALE[page.content_locale], siteName: hero.name || 'KUMANI' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

export default async function PublicLandingPage({ params }: Props) {
  const { slug } = await params
  const page = await loadPublicLanding(slug)
  if (!page) notFound()
  const c = page.content
  const labels = await getLandingLabels(page.content_locale)
  const url = `${CANONICAL_ORIGIN}/p/${page.slug}`

  // Dati per Google: attività locale con contatti e social (niente stelle:
  // le testimonianze le scrive il titolare)
  const sameAs = Object.values(c.social).filter(Boolean)
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: c.footer.businessName || c.hero.name,
    ...(c.seo.description || c.hero.subtitle ? { description: c.seo.description || c.hero.subtitle } : {}),
    url,
    ...(c.hero.photo || c.hero.logo ? { image: landingPhotoUrl(c.hero.photo || c.hero.logo) } : {}),
    ...(c.hero.logo ? { logo: landingPhotoUrl(c.hero.logo) } : {}),
    ...(c.contacts.phone || c.contacts.whatsapp ? { telephone: c.contacts.phone || c.contacts.whatsapp } : {}),
    ...(c.contacts.email ? { email: c.contacts.email } : {}),
    ...(c.contacts.address || c.contacts.city
      ? {
          address: {
            '@type': 'PostalAddress',
            ...(c.contacts.address ? { streetAddress: c.contacts.address } : {}),
            ...(c.contacts.city ? { addressLocality: c.contacts.city } : {}),
          },
        }
      : {}),
    ...(c.footer.vat ? { vatID: c.footer.vat } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  }

  return (
    <>
      <JsonLd data={ld} />
      <LandingView
        content={c}
        template={page.template}
        accent={page.accent}
        labels={labels}
        lang={page.content_locale}
        menuUrl={page.menu_token ? `/m/${page.menu_token}` : null}
        createHref={page.referral_code ? `/register?sponsor=${encodeURIComponent(page.referral_code)}` : '/register'}
        reportSlot={<ReportLandingButton slug={page.slug} locale={page.content_locale} />}
      />
    </>
  )
}
