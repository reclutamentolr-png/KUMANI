import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { christmasState, DEFAULT_CHRISTMAS, parseChristmas, romeDate, type ChristmasSettings, type ChristmasState } from '@/lib/christmasShared'

export * from '@/lib/christmasShared'

export const CHRISTMAS_CACHE_TAG = 'christmas'

const getChristmasSettings = unstable_cache(
  async (): Promise<ChristmasSettings> => {
    try {
      const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await service.from('system_settings').select('value').eq('key', 'christmas').maybeSingle()
      return data ? parseChristmas(data.value) : DEFAULT_CHRISTMAS
    } catch {
      return DEFAULT_CHRISTMAS
    }
  },
  ['christmas-settings'],
  { tags: [CHRISTMAS_CACHE_TAG], revalidate: 3600 }
)

// Decorazioni e offerta di oggi (la data si calcola a ogni chiamata)
export async function getChristmas(): Promise<ChristmasState> {
  return christmasState(await getChristmasSettings(), romeDate(new Date()))
}
