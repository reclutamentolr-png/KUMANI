import type { GuideContent } from '@/lib/antitruffa/types'

// Un file per lingua, caricato solo quando serve. Una lingua sconosciuta
// ricade sull'italiano (versione di riferimento).
const LOADERS: Record<string, () => Promise<{ default: GuideContent }>> = {
  it: () => import('./it'),
  en: () => import('./en'),
  fr: () => import('./fr'),
  es: () => import('./es'),
  pt: () => import('./pt'),
  de: () => import('./de'),
  ru: () => import('./ru'),
}

export async function getGuideContent(locale: string): Promise<GuideContent> {
  const load = LOADERS[locale] ?? LOADERS.it
  return (await load()).default
}
