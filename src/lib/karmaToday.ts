import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// KU Karma presi oggi (giorno di Roma), per la riga di stato della Home:
// l'accesso del giorno (profiles.last_daily_login) e i servizi usati
// (daily_tool_points, uno al giorno per servizio). Il valore di ogni attività
// viene da ku_activity_points (1 se manca), come in ku_points_for().
// Gli altri Karma (proposte accolte, segnalazioni confermate…) non hanno una
// data e qui non compaiono.
export type KarmaToday = { total: number; items: { key: string; points: number }[] }

export const romeToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date())

export async function getKarmaToday(supabase: SupabaseClient, userId: string): Promise<KarmaToday> {
  const today = romeToday()
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [{ data: tools }, { data: profile }, { data: values }] = await Promise.all([
    supabase.from('daily_tool_points').select('tool_name').eq('user_id', userId).eq('awarded_on', today),
    service.from('profiles').select('last_daily_login').eq('id', userId).maybeSingle(),
    service.from('ku_activity_points').select('key, points'),
  ])
  const pointsOf = new Map((values ?? []).map((v) => [v.key as string, Number(v.points) || 0]))
  const value = (key: string) => pointsOf.get(key) ?? 1
  const items = [
    ...(profile?.last_daily_login === today ? [{ key: 'daily_login', points: value('daily_login') }] : []),
    ...(tools ?? []).map((t) => ({ key: t.tool_name as string, points: value(t.tool_name as string) })),
  ].filter((i) => i.points > 0)
  return { total: items.reduce((sum, i) => sum + i.points, 0), items }
}
