import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { youtubeId } from '@/lib/homeVideoShared'

// Video ufficiale di presentazione di ogni servizio (Admin → Video dei
// servizi): un video di YouTube per servizio, così su Supabase non si carica
// nulla. Si salva in system_settings.service_videos come { servizio: codice }.
// Lo usano «Invia il video» dentro il servizio e la pagina del link corto
// kumani.io/v/CODICE.
export const SERVICE_VIDEOS_CACHE_TAG = 'service-videos'

export type ServiceVideos = Record<string, string>

export function parseServiceVideos(value: unknown): ServiceVideos {
  let raw: unknown = value
  try {
    raw = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return {}
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: ServiceVideos = {}
  for (const [tool, link] of Object.entries(raw as Record<string, unknown>)) {
    const id = typeof link === 'string' ? youtubeId(link) : null
    if (id && /^[a-z0-9-]{1,40}$/.test(tool)) out[tool] = id
  }
  return out
}

export const getServiceVideos = unstable_cache(
  async (): Promise<ServiceVideos> => {
    try {
      const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await service.from('system_settings').select('value').eq('key', 'service_videos').maybeSingle()
      return parseServiceVideos(data?.value ?? null)
    } catch {
      return {}
    }
  },
  ['service-videos'],
  { tags: [SERVICE_VIDEOS_CACHE_TAG], revalidate: 3600 }
)
