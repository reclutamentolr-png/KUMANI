import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { isConsentCategory, type ConsentCategory } from '@/lib/consent'

export const COOKIE_CONSENT_CACHE_TAG = 'cookie-consent'
export const COOKIE_CONSENT_SETTING = 'cookie_consent_categories'

// Categorie di cookie facoltativi accese dall'Admin (system_settings), tenute
// in memoria e aggiornate subito quando l'Admin le cambia. Errore = nessuna.
export const getActiveConsentCategories = unstable_cache(
  async (): Promise<ConsentCategory[]> => {
    try {
      const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await service.from('system_settings').select('value').eq('key', COOKIE_CONSENT_SETTING).maybeSingle()
      let value: unknown = data?.value
      try {
        value = typeof value === 'string' ? JSON.parse(value) : value
      } catch {
        return []
      }
      return Array.isArray(value) ? [...new Set(value.filter(isConsentCategory))] : []
    } catch {
      return []
    }
  },
  ['cookie-consent-categories'],
  { tags: [COOKIE_CONSENT_CACHE_TAG], revalidate: 3600 }
)
