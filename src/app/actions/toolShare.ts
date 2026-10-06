'use server'

import { createClient } from '@/lib/supabase/server'
import { getToolPassOffer } from '@/lib/toolPasses'

// Parte personale della pagina pubblica di un servizio (/strumenti/[tool]):
// la pagina è uguale per tutti e tenuta in memoria, quindi chi ha condiviso
// (?ref=CODICE) e i pulsanti per chi è già iscritto arrivano da qui, chiesti
// dal browser dopo l'apertura (components/strumenti/ToolShareActions).

export type ToolShareViewer = {
  // Chi ha condiviso: solo nome e codice, tramite la funzione pubblica
  inviter: { firstName: string; referralCode: string } | null
  // Utente collegato: può già aprire il servizio? Pass del solo servizio?
  member: { allowed: boolean; passEnabled: boolean; passPriceCents: number } | null
}

export async function getToolShareViewer(toolName: string, ref: string | null): Promise<ToolShareViewer> {
  const tool = typeof toolName === 'string' && /^[a-z0-9-]{1,40}$/.test(toolName) ? toolName : null
  const code = typeof ref === 'string' ? ref.trim().toUpperCase() : ''
  const supabase = await createClient()

  const [inviter, member] = await Promise.all([
    /^[A-Z0-9-]{3,32}$/.test(code)
      ? supabase.rpc('get_public_profile_by_referral', { p_referral_code: code }).then(({ data }) => {
          const row = ((data as { first_name: string; referral_code: string }[] | null) ?? [])[0]
          return row ? { firstName: row.first_name.trim(), referralCode: row.referral_code } : null
        })
      : Promise.resolve(null),
    tool
      ? supabase.auth.getUser().then(async ({ data: { user } }) => {
          if (!user) return null
          const [{ data: access }, offer] = await Promise.all([
            supabase.rpc('can_use_tool', { p_tool: tool }).maybeSingle<{ allowed: boolean }>(),
            getToolPassOffer(supabase, tool),
          ])
          return { allowed: access?.allowed === true, passEnabled: offer.enabled, passPriceCents: offer.priceCents }
        })
      : Promise.resolve(null),
  ])

  return { inviter, member }
}
