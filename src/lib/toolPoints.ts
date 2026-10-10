import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * KU Karma del giorno (una volta per servizio al giorno) a chi ha appena usato
 * un servizio. Va chiamata dal server dopo che l'azione è riuscita: la
 * funzione del database non è più chiamabile dal browser
 * (award_tool_point_for, solo chiave di servizio). Il limite di una volta al
 * giorno lo fa il database, quindi ripetere la chiamata non dà punti in più.
 * Non lancia mai errori: il punto non deve far fallire l'azione già riuscita.
 */
export async function awardToolPoint(toolName: string): Promise<{ awarded: boolean; new_balance: number } | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await service
      .rpc('award_tool_point_for', { p_user: user.id, p_tool_name: toolName })
      .maybeSingle<{ awarded: boolean; new_balance: number }>()
    return data ?? null
  } catch {
    return null
  }
}
