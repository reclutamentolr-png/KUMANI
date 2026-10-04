'use server'

import { createClient } from '@/lib/supabase/server'
import { getMarketplaceAccessState } from '@/lib/marketplaceAccess'
import { SERVICE_GROUPS, STARTER_SERVICES, type ServiceGroup } from '@/lib/serviceGroups'

const MAX_STARTERS = 8

// Primo accesso, "Cosa ti interessa?": mette tra i preferiti i servizi
// consigliati per gli interessi scelti (solo quelli accesi e che l'utente
// può già usare) e segna la domanda come vista. Senza scelte la segna e basta.
export async function saveInterests(groups: string[]): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const picked = SERVICE_GROUPS.filter((group): group is ServiceGroup => groups.includes(group))
  if (picked.length > 0) {
    const access = await getMarketplaceAccessState(supabase, user.id)
    // Un po' da ogni interesse, a turno, così nessuno resta fuori
    const lists = picked.map((group) => STARTER_SERVICES[group].filter((name) => access.isSettingEnabled(name) && access.isToolEnabled(name)))
    const chosen: string[] = []
    for (let i = 0; chosen.length < MAX_STARTERS && lists.some((list) => i < list.length); i++) {
      for (const list of lists) if (list[i] && chosen.length < MAX_STARTERS && !chosen.includes(list[i])) chosen.push(list[i])
    }
    if (chosen.length > 0) {
      const { error } = await supabase
        .from('marketplace_favorites')
        .upsert(chosen.map((tool_name) => ({ user_id: user.id, tool_name })), { onConflict: 'user_id,tool_name', ignoreDuplicates: true })
      if (error) console.error('[interests] favorites failed:', error)
    }
  }

  const { error } = await supabase.auth.updateUser({ data: { interests_seen: true, interests: picked } })
  if (error) console.error('[interests] metadata failed:', error)
  return { success: true }
}
