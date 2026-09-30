import type { SupabaseClient } from '@supabase/supabase-js'

// Interruttore del Catalogo Premi (system_settings.rewards_catalog_enabled,
// Admin → Punti e premi). Spento: niente pagina Premi né collegamenti, e il
// riscatto è bloccato anche nel database (redeem_reward). Il catalogo resta
// salvato per poterlo riattivare.
export const REWARDS_CATALOG_KEY = 'rewards_catalog_enabled'

export async function isRewardsCatalogEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase.from('system_settings').select('value').eq('key', REWARDS_CATALOG_KEY).maybeSingle()
  return data?.value === 'true' || data?.value === true
}
