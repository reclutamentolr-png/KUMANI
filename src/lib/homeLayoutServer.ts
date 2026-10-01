import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { DEFAULT_HOME_LAYOUT, isHomeLayout, type HomeLayoutKey } from '@/lib/homeLayouts'

export const HOME_LAYOUT_CACHE_TAG = 'home-layout'

// Layout della homepage scelto dall'Admin (system_settings.home_layout),
// tenuto in memoria e aggiornato subito quando l'Admin lo cambia.
export const getHomeLayout = unstable_cache(
  async (): Promise<HomeLayoutKey> => {
    try {
      const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await service.from('system_settings').select('value').eq('key', 'home_layout').maybeSingle()
      let value: unknown = data?.value
      try {
        value = typeof value === 'string' ? JSON.parse(value) : value
      } catch {
        // valore salvato come testo semplice
      }
      return isHomeLayout(value) ? value : DEFAULT_HOME_LAYOUT
    } catch {
      return DEFAULT_HOME_LAYOUT
    }
  },
  ['home-layout'],
  { tags: [HOME_LAYOUT_CACHE_TAG], revalidate: 3600 }
)
