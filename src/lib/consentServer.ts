import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { CONSENT_OFF, parseConsentConfig, type ConsentConfig } from '@/lib/consent'

export const COOKIE_CONSENT_CACHE_TAG = 'cookie-consent'
export const COOKIE_CONSENT_SETTING = 'cookie_consent_categories'

// Banner cookie impostato dall'Admin (system_settings), tenuto in memoria e
// aggiornato subito quando l'Admin lo cambia. Errore = spento.
export const getConsentConfig = unstable_cache(
  async (): Promise<ConsentConfig> => {
    try {
      const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await service.from('system_settings').select('value').eq('key', COOKIE_CONSENT_SETTING).maybeSingle()
      let value: unknown = data?.value
      try {
        value = typeof value === 'string' ? JSON.parse(value) : value
      } catch {
        return CONSENT_OFF
      }
      return parseConsentConfig(value)
    } catch {
      return CONSENT_OFF
    }
  },
  ['cookie-consent-config'],
  { tags: [COOKIE_CONSENT_CACHE_TAG], revalidate: 3600 }
)
