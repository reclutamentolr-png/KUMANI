'use server'

import { revalidatePath } from 'next/cache'
import { getLocale } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getMarketplaceAccessState } from '@/lib/marketplaceAccess'
import { getServicesCatalog } from '@/lib/servicesCatalog'
import { HOME_NEEDS } from '@/lib/homeNeeds'
import { setHomeView } from '@/app/actions/homeView'

// Home di benvenuto (dashboard): «Per cosa sei qui?» e «Mostra la Home completa».
const PER_NEED = 3

// Una risposta scelta: i primi servizi giusti (aperti all'utente) finiscono
// tra i preferiti, così «I tuoi servizi» non è vuoto. Toccata di nuovo, la
// risposta si toglie (i preferiti restano: si tolgono dalla stella).
export async function pickWelcomeNeed(key: string): Promise<{ success: boolean; needs: string[] }> {
  const need = HOME_NEEDS.find((n) => n.key === key)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || !need) return { success: false, needs: [] }

  const current = Array.isArray(user.user_metadata?.needs) ? (user.user_metadata.needs as string[]) : []
  const removing = current.includes(key)
  const needs = removing ? current.filter((n) => n !== key) : [...current, key]

  if (!removing) {
    const access = await getMarketplaceAccessState(supabase, user.id)
    const { items } = await getServicesCatalog(supabase, user.id, await getLocale(), { access, favorites: [] })
    const usable = new Set(items.filter((item) => item.open).map((item) => item.toolName))
    const chosen = (need.items as readonly string[]).filter((name) => usable.has(name)).slice(0, PER_NEED)
    if (chosen.length > 0) {
      const { error } = await supabase
        .from('marketplace_favorites')
        .upsert(chosen.map((tool_name) => ({ user_id: user.id, tool_name })), { onConflict: 'user_id,tool_name', ignoreDuplicates: true })
      if (error) console.error('[benvenuto] preferiti:', error.message)
    }
  }

  const { error } = await supabase.auth.updateUser({ data: { needs, interests_seen: true } })
  if (error) {
    console.error('[benvenuto] scelta:', error.message)
    return { success: false, needs: current }
  }
  revalidatePath('/dashboard')
  return { success: true, needs }
}

// «Mostra la Home completa»: passa alla vista Completa (anche su altri dispositivi)
export async function showFullHome(): Promise<boolean> {
  return setHomeView('full')
}
