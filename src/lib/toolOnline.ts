import { createClient } from '@/lib/supabase/server'

// Interruttore Admin (marketplace_settings.is_enabled) per i servizi fuori da
// /marketplace: Travel ed Events restano in sola lettura, Veritas e Affinity
// si fermano. Senza riga o in caso di errore il servizio resta acceso.
export type SwitchableTool = 'travel' | 'events' | 'veritas' | 'affinity' | 'convivio' | 'listings' | 'chat' | 'spotlight' | 'timebank' | 'nexus'

export async function isToolOnline(tool: SwitchableTool): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('tool_online', { p_tool: tool })
  if (error) return true
  return data !== false
}
