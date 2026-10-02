import type { GuideSlug, GuidesContent } from '@/lib/guides/types'

// Un file per lingua, caricato solo quando serve. Una lingua sconosciuta
// ricade sull'italiano (versione di riferimento).
const LOADERS: Record<string, () => Promise<{ default: GuidesContent }>> = {
  it: () => import('./it'),
  en: () => import('./en'),
  fr: () => import('./fr'),
  es: () => import('./es'),
  pt: () => import('./pt'),
  de: () => import('./de'),
  ru: () => import('./ru'),
}

export async function getGuidesContent(locale: string): Promise<GuidesContent> {
  const load = LOADERS[locale] ?? LOADERS.it
  return (await load()).default
}

// Schermate disponibili in italiano e in inglese: le altre lingue mostrano
// quelle in inglese finché non vengono rifatte nella loro lingua.
const SHOT_LOCALES = ['it', 'en']

export function guideShot(locale: string, slug: GuideSlug, step: number) {
  const folder = SHOT_LOCALES.includes(locale) ? locale : 'en'
  return `/guides/${folder}/${slug}-${step}.webp`
}
