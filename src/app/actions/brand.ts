'use server'

import { createClient } from '@/lib/supabase/server'
import { BRAND_SERVICES, brandColors, cleanPalette, type BrandFollow, type BrandPalette, type BrandService } from '@/lib/brand'

// «I colori del tuo brand»: si salvano nella Scheda attività
// (quote_issuer_profiles). I servizi che seguono il brand li prende il
// database (brand_sync); il piano (Plus o Pro) lo controllano le sue regole.

export type BrandState = { palette: BrandPalette | null; follow: BrandFollow; logoUrl: string | null }

const cleanFollow = (raw: unknown): BrandFollow => {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return Object.fromEntries(BRAND_SERVICES.map((s) => [s, o[s] === true])) as BrandFollow
}

export async function getBrand(): Promise<BrandState | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('quote_issuer_profiles').select('brand_colors, brand_follow, logo_path').eq('user_id', user.id).maybeSingle()
  return {
    palette: cleanPalette(data?.brand_colors),
    follow: cleanFollow(data?.brand_follow),
    logoUrl: data?.logo_path ? supabase.storage.from('quote-logos-v2').getPublicUrl(data.logo_path).data.publicUrl : null,
  }
}

export async function saveBrand(palette: BrandPalette, follow: BrandFollow): Promise<{ success: true } | { success: false; message: string }> {
  const clean = cleanPalette(palette)
  if (!clean) return { success: false, message: 'invalidColors' }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'saveError' }
  const { error } = await supabase
    .from('quote_issuer_profiles')
    .upsert({ user_id: user.id, brand_colors: brandColors(clean), brand_follow: cleanFollow(follow), updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) {
    console.error('[brand] salvataggio:', error.message)
    return { success: false, message: error.code === '42501' ? 'planRequired' : 'saveError' }
  }
  return { success: true }
}

// Un servizio torna a seguire il brand (o smette): «Usa i colori del brand»
export async function setBrandFollow(service: BrandService, value: boolean): Promise<{ success: boolean }> {
  if (!BRAND_SERVICES.includes(service)) return { success: false }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }
  const { data } = await supabase.from('quote_issuer_profiles').select('brand_follow, brand_colors').eq('user_id', user.id).maybeSingle()
  if (!data?.brand_colors) return { success: false }
  const { error } = await supabase
    .from('quote_issuer_profiles')
    .update({ brand_follow: { ...cleanFollow(data.brand_follow), [service]: value } })
    .eq('user_id', user.id)
  return { success: !error }
}
