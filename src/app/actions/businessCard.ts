'use server'

import { createClient } from '@/lib/supabase/server'

// Biglietto da visita: modello scelto e contatti da mostrare nella pagina del QR.

export type BusinessCardSettings = { design: 'A' | 'B' | 'C'; show_phone: boolean; show_whatsapp: boolean; show_email: boolean }

export async function saveBusinessCard(settings: BusinessCardSettings): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }
  const design = ['A', 'B', 'C'].includes(settings.design) ? settings.design : 'A'
  const { error } = await supabase.from('business_cards').upsert(
    {
      user_id: user.id,
      design,
      show_phone: Boolean(settings.show_phone),
      show_whatsapp: Boolean(settings.show_whatsapp),
      show_email: Boolean(settings.show_email),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (error) console.error('[biglietto da visita]', error.message)
  return { success: !error }
}
