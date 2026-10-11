import type { SupabaseClient } from '@supabase/supabase-js'
import { BRAND_SERVICES, cleanPalette, type BrandColors, type BrandFollow } from '@/lib/brand'

// Colori del brand e servizi che lo seguono (per gli editor dei servizi)
export async function getBrandFor(supabase: SupabaseClient, userId: string): Promise<{ colors: BrandColors | null; follow: BrandFollow }> {
  const { data } = await supabase.from('quote_issuer_profiles').select('brand_colors, brand_follow').eq('user_id', userId).maybeSingle()
  const raw = (data?.brand_follow ?? {}) as Record<string, unknown>
  const follow = Object.fromEntries(BRAND_SERVICES.map((s) => [s, raw[s] === true])) as BrandFollow
  return { colors: cleanPalette(data?.brand_colors) ? (data!.brand_colors as BrandColors) : null, follow }
}
