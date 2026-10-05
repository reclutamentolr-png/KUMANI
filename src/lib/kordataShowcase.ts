import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { SHOWCASE_CACHE_TAG, type ShowcaseCard } from '@/lib/convivio'

// Kordata in vetrina in homepage: fino a 3 lotti approvati dallo Staff, aperti
// e ancora sotto il minimo. Uguali per tutti: client anonimo dentro la cache
// (10 minuti, svuotata subito quando lo Staff approva o toglie un lotto).
const getAnonClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const fetchShowcase = unstable_cache(
  async (): Promise<ShowcaseCard[]> => {
    const { data, error } = await getAnonClient().rpc('convivio_showcase_list')
    if (error) return []
    return (data ?? []) as ShowcaseCard[]
  },
  ['kordata-showcase'],
  { revalidate: 600, tags: [SHOWCASE_CACHE_TAG] }
)

export function getKordataShowcase(): Promise<ShowcaseCard[]> {
  return fetchShowcase()
}
