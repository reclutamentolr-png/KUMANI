'use server'

import { updateTag } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { youtubeId } from '@/lib/homeVideoShared'
import { parseServiceVideos, SERVICE_VIDEOS_CACHE_TAG, type ServiceVideos } from '@/lib/serviceVideos'

// Admin → Video dei servizi: il video di YouTube di ogni servizio e quanto
// vengono aperti i link corti (kumani.io/v/CODICE) che i Kumani mandano
const db = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

export type ShareStats = {
  byTool: Record<string, { links: number; opens: number }>
  top: { name: string; email: string | null; links: number; opens: number }[]
}

export async function adminGetServiceVideos(): Promise<{ videos: ServiceVideos; stats: ShareStats } | { error: string }> {
  if (!(await verifyAdmin('settings.read'))) return { error: 'Non autorizzato' }
  const service = db()
  const [{ data: setting }, { data: rows }] = await Promise.all([
    service.from('system_settings').select('value').eq('key', 'service_videos').maybeSingle(),
    service.from('share_links').select('user_id, tool, opens').limit(50000),
  ])
  const byTool: ShareStats['byTool'] = {}
  const byUser = new Map<string, { links: number; opens: number }>()
  for (const row of rows ?? []) {
    const tool = (byTool[row.tool] ??= { links: 0, opens: 0 })
    tool.links++
    tool.opens += row.opens
    const user = byUser.get(row.user_id) ?? { links: 0, opens: 0 }
    user.links++
    user.opens += row.opens
    byUser.set(row.user_id, user)
  }
  const best = [...byUser.entries()].sort((a, b) => b[1].opens - a[1].opens).slice(0, 10)
  const { data: profiles } = best.length
    ? await service.from('profiles').select('id, first_name, last_name, email').in('id', best.map(([id]) => id))
    : { data: [] as { id: string; first_name: string | null; last_name: string | null; email: string | null }[] }
  const top = best.map(([id, counts]) => {
    const p = profiles?.find((profile) => profile.id === id)
    return { name: p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || '—' : 'Account cancellato', email: p?.email ?? null, ...counts }
  })
  return { videos: parseServiceVideos(setting?.value ?? null), stats: { byTool, top } }
}

export async function adminSaveServiceVideos(links: Record<string, string>): Promise<{ success: true; videos: ServiceVideos } | { success: false; error: string }> {
  if (!(await verifyAdmin('settings.write'))) return { success: false, error: 'Non autorizzato' }
  const clean: ServiceVideos = {}
  for (const [tool, link] of Object.entries(links)) {
    if (!link.trim()) continue
    const id = youtubeId(link)
    if (!id) return { success: false, error: `Non è un link di YouTube (${tool}): ${link}` }
    clean[tool] = id
  }
  const { error } = await db().from('system_settings').upsert({ key: 'service_videos', value: JSON.stringify(clean) }, { onConflict: 'key' })
  if (error) return { success: false, error: error.message }
  updateTag(SERVICE_VIDEOS_CACHE_TAG)
  return { success: true, videos: parseServiceVideos(clean) }
}
