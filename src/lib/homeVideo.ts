import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { DEFAULT_HOME_VIDEO, parseActiveVideo, parseHomeVideos, type HomeVideoEntry } from '@/lib/homeVideoShared'

export * from '@/lib/homeVideoShared'

// Video della homepage (Admin → Aspetto homepage): un video di YouTube, di
// solito il tormentone «Dammi una mano». Il video in vetrina è il suo codice
// in system_settings.home_video (vuoto = riquadro nascosto); gli altri video
// pronti da rimettere sono in system_settings.home_videos (titolo, parte in
// oro e frase scritti dall'Admin). Il video resta su YouTube: la pagina
// carica il lettore solo quando si preme play.
export const HOME_VIDEO_CACHE_TAG = 'home-video'

// Il video in vetrina con i suoi testi (null = riquadro nascosto)
export const getHomeVideo = unstable_cache(
  async (): Promise<HomeVideoEntry | null> => {
    const fallback = { id: DEFAULT_HOME_VIDEO, title: '', accent: '', text: '' }
    try {
      const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      const { data } = await service.from('system_settings').select('key, value').in('key', ['home_video', 'home_videos'])
      const active = data?.find((row) => row.key === 'home_video')
      const id = active ? parseActiveVideo(active.value) : DEFAULT_HOME_VIDEO
      if (!id) return null
      const library = parseHomeVideos(data?.find((row) => row.key === 'home_videos')?.value)
      return library.find((video) => video.id === id) ?? { ...fallback, id }
    } catch {
      return fallback
    }
  },
  ['home-video-v2'],
  { tags: [HOME_VIDEO_CACHE_TAG], revalidate: 3600 }
)
