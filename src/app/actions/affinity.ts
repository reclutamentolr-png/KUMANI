'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { AFFINITY_AXES, isAffinityArchetype, isAffinityMap, type AffinityArchetype, type AffinityMap } from '@/lib/affinity'

// Salva (o aggiorna) la Mappa di Affinità dell'utente collegato: solo i 5
// valori e l'archetipo, mai le singole risposte.
export async function saveAffinityMap(map: AffinityMap, archetype: AffinityArchetype): Promise<{ success: boolean; duoCode?: string }> {
  if (!isAffinityMap(map) || !isAffinityArchetype(archetype)) return { success: false }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }

  const cleanMap = Object.fromEntries(AFFINITY_AXES.map((axis) => [axis, Math.round(map[axis] * 100) / 100]))

  const { data: existing } = await supabase.from('affinity_profiles').select('duo_code').eq('user_id', user.id).maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from('affinity_profiles')
      .update({ map: cleanMap, archetype, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)
    if (error) return { success: false }
    revalidatePath('/app/affinity')
    return { success: true, duoCode: existing.duo_code }
  }

  const { data: created, error } = await supabase
    .from('affinity_profiles')
    .insert({ user_id: user.id, map: cleanMap, archetype })
    .select('duo_code')
    .single()
  if (error || !created) return { success: false }
  revalidatePath('/app/affinity')
  return { success: true, duoCode: created.duo_code }
}

// Cancella la mappa (e con lei il link Duo) in un clic.
export async function deleteAffinityMap(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }
  const { error } = await supabase.from('affinity_profiles').delete().eq('user_id', user.id)
  revalidatePath('/app/affinity')
  return { success: !error }
}
