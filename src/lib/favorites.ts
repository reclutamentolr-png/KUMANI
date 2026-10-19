import type { SupabaseClient } from '@supabase/supabase-js'

/** Tool names the user has starred, most recently favorited first (stable order). */
export async function getFavoriteToolNames(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('marketplace_favorites')
    .select('tool_name')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    // Aggiunti nello stesso istante: ordine sempre uguale
    .order('tool_name', { ascending: false })

  return (data || []).map((row) => row.tool_name)
}
