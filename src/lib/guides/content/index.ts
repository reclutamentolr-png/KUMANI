import { getTranslations } from 'next-intl/server'
import type { GuideCategory, GuideSlug, GuidesContent, GuideStep } from '@/lib/guides/types'
import { GUIDE_CATEGORIES, GUIDE_STRUCTURE } from '@/lib/guides/structure'

// Guide aperte a tutti (homepage, accesso, registrazione, Google): le altre
// mostrano l'app dall'interno e sono per chi ha già fatto l'accesso.
export const PUBLIC_GUIDES: GuideSlug[] = ['registrazione', 'accesso']

// Testi delle guide dai file delle lingue (namespace "guideTexts"), con le
// correzioni dei traduttori già applicate. Letti "raw": niente segnaposto.
export async function getGuidesContent(locale: string): Promise<GuidesContent> {
  const t = await getTranslations({ locale, namespace: 'guideTexts' })
  const text = (key: string) => String(t.raw(key) ?? '')

  const categories = Object.fromEntries(
    GUIDE_CATEGORIES.map((c) => [c, { title: text(`categories.${c}.title`), text: text(`categories.${c}.text`) }]),
  ) as Record<GuideCategory, { title: string; text: string }>

  const guides = GUIDE_STRUCTURE.map((g) => {
    const k = g.slug.replace(/-/g, '_')
    const steps: GuideStep[] = Array.from({ length: g.steps }, (_, i) => {
      const n = i + 1
      const step: GuideStep = { title: text(`${k}.step${n}Title`), text: text(`${k}.step${n}Text`) }
      if (t.has(`${k}.step${n}Tip`)) step.tip = text(`${k}.step${n}Tip`)
      return step
    })
    return { slug: g.slug, category: g.category, minutes: g.minutes, title: text(`${k}.title`), summary: text(`${k}.summary`), steps, cta: { label: text(`${k}.cta`), href: g.href } }
  })
  return { categories, guides }
}

// Schermate disponibili in italiano e in inglese: le altre lingue mostrano
// quelle in inglese finché non vengono rifatte nella loro lingua.
const SHOT_LOCALES = ['it', 'en']

export function guideShot(locale: string, slug: GuideSlug, step: number) {
  const folder = SHOT_LOCALES.includes(locale) ? locale : 'en'
  return `/guides/${folder}/${slug}-${step}.webp`
}
