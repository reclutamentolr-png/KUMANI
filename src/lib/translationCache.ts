import { revalidateTag } from 'next/cache'
import { TRANSLATIONS_CACHE_TAG } from '@/lib/translationOverrides'

// Svuota la memoria dei testi corretti dopo ogni modifica (solo dalle azioni
// sul server: separato da translationOverrides.ts, che usa anche i18n.ts)
export function invalidateTranslations() {
  revalidateTag(TRANSLATIONS_CACHE_TAG, { expire: 0 })
}
