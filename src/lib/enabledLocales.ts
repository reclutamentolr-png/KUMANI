import { unstable_cache } from 'next/cache'
import { ALL_SITE_LOCALES, ENABLED_LOCALES_TAG, readEnabledLocales } from '@/lib/enabledLocalesCore'

export { ALL_SITE_LOCALES, ENABLED_LOCALES_KEY, ENABLED_LOCALES_TAG, parseEnabledLocales, readEnabledLocales } from '@/lib/enabledLocalesCore'

const cached = unstable_cache(readEnabledLocales, ['enabled-locales'], { revalidate: 60, tags: [ENABLED_LOCALES_TAG] })

// Per pagine e layout (memoria di 60 secondi, svuotata al salvataggio)
export async function getEnabledLocales(): Promise<string[]> {
  try {
    return await cached()
  } catch {
    return [...ALL_SITE_LOCALES]
  }
}
