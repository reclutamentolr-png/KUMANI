import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { SPOTLIGHT_HOME_CACHE_TAG, SPOTLIGHT_HOME_MIN_POOL } from '@/lib/spotlight'

export interface HomeKumano {
  display_name: string
  city: string | null
  country: string | null
  profession: string | null
  story: string
  story_locale: string | null
}

// Client anonimo senza cookie: dentro unstable_cache non si possono usare
// cookies(), e la card home deve essere identica per tutti i visitatori
// (loggati o no), quindi niente sessione.
const getAnonClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// `day` fa parte della chiave di cache: allo scoccare del nuovo giorno
// (UTC, come current_date lato DB) la chiave cambia e la storia ruota da
// sola, senza cron. Il tag permette la revoca immediata (updateTag nelle
// server action di spotlight/admin).
const fetchHomeKumano = unstable_cache(
  async (day: string): Promise<HomeKumano | null> => {
    void day
    const { data, error } = await getAnonClient().rpc('get_home_kumano', { p_min_pool: SPOTLIGHT_HOME_MIN_POOL })
    if (error) return null
    const rows = (data ?? []) as HomeKumano[]
    return rows[0] ?? null
  },
  ['home-kumano'],
  { tags: [SPOTLIGHT_HOME_CACHE_TAG], revalidate: 3600 }
)

// Spotlight spento dallo Staff (Admin): niente fascia in Home.
export async function isSpotlightOnline(): Promise<boolean> {
  const { data, error } = await getAnonClient().rpc('tool_online', { p_tool: 'spotlight' })
  return error ? true : data !== false
}

export function getHomeKumano(): Promise<HomeKumano | null> {
  return fetchHomeKumano(new Date().toISOString().slice(0, 10))
}
