import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// Video della homepage (Admin → Aspetto homepage): un video di YouTube, di
// solito il tormentone «Dammi una mano». Si salva solo il suo codice in
// system_settings.home_video; vuoto = riquadro nascosto. Il video resta su
// YouTube: la pagina carica il lettore solo quando si preme play.
export const HOME_VIDEO_CACHE_TAG = 'home-video'
export const DEFAULT_HOME_VIDEO = 'JFcbxosWPLM'

// Codice di 11 caratteri da un link di YouTube (youtu.be, watch?v=, shorts,
// embed) o dal codice stesso; null se non è un video di YouTube
export function youtubeId(input: string): string | null {
  const s = input.trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  try {
    const url = new URL(s)
    const host = url.hostname.replace(/^(www|m)\./, '')
    if (host === 'youtu.be') return youtubeId(url.pathname.slice(1).split('/')[0])
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = url.searchParams.get('v')
      if (v) return youtubeId(v)
      const m = url.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/)
      return m ? m[1] : null
    }
  } catch {
    // non è un indirizzo
  }
  return null
}

export const getHomeVideo = unstable_cache(
  async (): Promise<string | null> => {
    try {
      const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await service.from('system_settings').select('value').eq('key', 'home_video').maybeSingle()
      if (!data) return DEFAULT_HOME_VIDEO
      let value: unknown = data.value
      try {
        value = typeof value === 'string' ? JSON.parse(value) : value
      } catch {
        // testo semplice
      }
      return typeof value === 'string' && value ? youtubeId(value) : null
    } catch {
      return DEFAULT_HOME_VIDEO
    }
  },
  ['home-video'],
  { tags: [HOME_VIDEO_CACHE_TAG], revalidate: 3600 }
)
