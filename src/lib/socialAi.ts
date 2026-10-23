import { createClient as createServiceClient } from '@supabase/supabase-js'
import { logAiLimit } from '@/lib/appLimits'

// Strumenti social con l'AI (LUMEN, didascalie, calendario, sottotitoli): un
// contatore giornaliero per tipo e per utente (tabella social_ai_usage), con
// il limite in system_settings «<tipo>_ai_daily_runs» (10 se manca).
export type SocialAiKind = 'lumen' | 'captions' | 'calendar' | 'subtitles'

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

async function dailyLimit(kind: SocialAiKind): Promise<number> {
  const { data: row } = await service().from('system_settings').select('value').eq('key', `${kind}_ai_daily_runs`).maybeSingle()
  return Number(String(row?.value ?? '10').replace(/"/g, '')) || 10
}

// Quanti utilizzi restano oggi (stesso giorno UTC di ai_quota_take)
export async function socialAiLeft(kind: SocialAiKind, userId: string): Promise<{ left: number; limit: number }> {
  const limit = await dailyLimit(kind)
  const today = new Date().toISOString().slice(0, 10)
  const { data } = await service().from('social_ai_usage').select('runs').eq('kind', kind).eq('owner_id', userId).eq('used_on', today).maybeSingle()
  return { left: Math.max(0, limit - Number(data?.runs ?? 0)), limit }
}

// Prende un utilizzo dalla quota di oggi; false se il limite è raggiunto
export async function takeSocialAiQuota(kind: SocialAiKind, userId: string): Promise<boolean> {
  const db = service()
  const limit = await dailyLimit(kind)
  const { data: taken } = await db.rpc('ai_quota_take', { p_kind: kind, p_user: userId, p_limit: limit })
  if (taken === null || taken === undefined) {
    await logAiLimit(userId, kind)
    return false
  }
  return true
}
