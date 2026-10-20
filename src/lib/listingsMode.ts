import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'

// «Bacheca libera» (Admin → Bacheca): acceso, pubblicare un annuncio è
// gratis (niente KU Karma). Il controllo dello Staff c'è sempre.
export const LISTINGS_MODE_CACHE_TAG = 'listings-mode'

export const getListingsFreeMode = unstable_cache(
  async (): Promise<boolean> => {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await db.from('system_settings').select('value').eq('key', 'listings_free_mode').maybeSingle()
    return String(data?.value ?? '').replace(/"/g, '') === 'true'
  },
  ['listings-free-mode'],
  { tags: [LISTINGS_MODE_CACHE_TAG], revalidate: 600 }
)
