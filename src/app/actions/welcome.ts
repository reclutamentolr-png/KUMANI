'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { HOME_NEEDS, homeNeedToolName } from '@/lib/homeNeeds'
import { setHomeView } from '@/app/actions/homeView'

// Home di benvenuto (dashboard): «Per cosa sei qui?» e «Mostra la Home completa».

// «Per cosa sei qui?»: ogni voce si apre con i suoi servizi (Gratis, Plus e
// Pro) e la persona aggiunge a «I tuoi servizi» quelli che vuole, uno per uno.
// La voce finisce tra le risposte (needs) al primo servizio aggiunto.
export async function toggleWelcomeService(needKey: string, toolName: string, add: boolean): Promise<boolean> {
  const need = HOME_NEEDS.find((n) => n.key === needKey)
  if (!need || !(need.items as readonly string[]).map(homeNeedToolName).includes(toolName)) return false
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false

  const { error } = add
    ? await supabase.from('marketplace_favorites').upsert({ user_id: user.id, tool_name: toolName }, { onConflict: 'user_id,tool_name', ignoreDuplicates: true })
    : await supabase.from('marketplace_favorites').delete().eq('user_id', user.id).eq('tool_name', toolName)
  if (error) {
    console.error('[benvenuto] preferiti:', error.message)
    return false
  }
  const current = Array.isArray(user.user_metadata?.needs) ? (user.user_metadata.needs as string[]) : []
  if (add && !current.includes(needKey)) {
    const { error: metaError } = await supabase.auth.updateUser({ data: { needs: [...current, needKey], interests_seen: true } })
    if (metaError) console.error('[benvenuto] scelta:', metaError.message)
  }
  revalidatePath('/dashboard')
  return true
}

// «Mostra la Home completa»: passa alla vista Completa (anche su altri dispositivi)
export async function showFullHome(): Promise<boolean> {
  return setHomeView('full')
}

// Passo 3 della Home di benvenuto: ha guardato il video o condiviso KUMANI
export async function markWelcomeDiscovered(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return false
  if (user.user_metadata?.welcome_third === true) return true
  const { error } = await supabase.auth.updateUser({ data: { welcome_third: true } })
  if (error) {
    console.error('[benvenuto] passo 3:', error.message)
    return false
  }
  // Niente ricarica della pagina: il video che sta guardando resta aperto
  return true
}

// «Vai alla mia Home» dopo i primi 3 passi: la Home di benvenuto si chiude
export async function closeWelcome(): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ data: { welcome_closed: true } })
  if (error) {
    console.error('[benvenuto] chiusura:', error.message)
    return false
  }
  revalidatePath('/dashboard')
  return true
}
