import { getTranslations } from 'next-intl/server'
import { defaultLocale } from '../../i18n'

// Testi per Google delle pagine pubbliche dei servizi (/strumenti/...).
// Si mostrano solo nelle lingue che li hanno davvero: i messaggi delle altre
// lingue ricevono l'italiano come riserva, che qui non va bene (una pagina
// inglese con testi italiani confonde Google e chi legge).

export type ToolSeo = {
  title: string
  description: string
  heading: string
  intro: string
  points: string[]
  faq: { q: string; a: string }[]
}

export async function getToolSeo(locale: string, toolName: string): Promise<ToolSeo | null> {
  const key = toolName.replace(/-/g, '_')
  if (locale !== defaultLocale) {
    const own = (await import(`../../messages/${locale}.json`)).default as { toolSeo?: Record<string, unknown> }
    if (!own.toolSeo?.[key]) return null
  }
  const t = await getTranslations({ locale, namespace: 'toolSeo' })
  return t.has(key) ? (t.raw(key) as ToolSeo) : null
}
