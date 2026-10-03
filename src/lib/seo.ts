import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getLocale, getTranslations } from 'next-intl/server'
import { getEnabledLocales } from '@/lib/enabledLocales'
import { defaultLocale } from '../../i18n'

// SEO delle pagine pubbliche: indirizzo canonico, versioni nelle altre lingue
// (hreflang con x-default), anteprima social nella lingua giusta e niente
// indicizzazione fuori dal dominio definitivo (anteprime Vercel, localhost).

const OG_LOCALE: Record<string, string> = {
  it: 'it_IT',
  en: 'en_GB',
  fr: 'fr_FR',
  es: 'es_ES',
  pt: 'pt_PT',
  de: 'de_DE',
  ru: 'ru_RU',
}

// Dominio definitivo: solo qui Google può indicizzare, e gli indirizzi
// canonici puntano sempre qui (anche se la pagina è aperta da un'anteprima)
export const CANONICAL_ORIGIN = 'https://kumani.io'
const PUBLIC_HOSTS = ['kumani.io', 'www.kumani.io']

export async function isIndexableHost() {
  const host = ((await headers()).get('x-forwarded-host') ?? (await headers()).get('host') ?? '').split(':')[0].toLowerCase()
  return PUBLIC_HOSTS.includes(host)
}

export const localizedUrl = (locale: string, path: string) => {
  const clean = path === '/' ? '' : path
  return `${CANONICAL_ORIGIN}${locale === defaultLocale ? '' : `/${locale}`}${clean}` || CANONICAL_ORIGIN
}

/**
 * Metadati di una pagina pubblica. `path` senza lingua (es. '/chi-siamo',
 * '' per la homepage). Titolo e descrizione restano quelli della pagina.
 */
export async function pageMetadata(path: string, meta: Metadata = {}): Promise<Metadata> {
  const [locale, enabled, t] = await Promise.all([getLocale(), getEnabledLocales(), getTranslations('seo')])
  const canonical = localizedUrl(locale, path)
  const languages: Record<string, string> = Object.fromEntries(enabled.map((l) => [l, localizedUrl(l, path)]))
  languages['x-default'] = localizedUrl(defaultLocale, path)
  const rawTitle = meta.title as string | { absolute?: string } | undefined
  const title = typeof rawTitle === 'string' ? rawTitle : rawTitle?.absolute ?? t('siteTitle')
  const description = meta.description ?? t('siteDescription')
  return {
    ...meta,
    alternates: { canonical, languages, ...(meta.alternates ?? {}) },
    openGraph: {
      type: 'website',
      siteName: 'KUMANI',
      locale: OG_LOCALE[locale] ?? 'it_IT',
      alternateLocale: enabled.filter((l) => l !== locale).map((l) => OG_LOCALE[l]).filter(Boolean),
      url: canonical,
      title,
      description,
      images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'KUMANI' }],
      ...(meta.openGraph ?? {}),
    },
    twitter: { card: 'summary_large_image', title, description, images: ['/og-image.jpg'], ...(meta.twitter ?? {}) },
  }
}
