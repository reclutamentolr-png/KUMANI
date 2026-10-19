'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type ActionResult = { success: true } | { success: false; message: string }

export async function addFavorite(toolName: string): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }

  const { error } = await supabase.from('marketplace_favorites').insert({ user_id: user.id, tool_name: toolName })
  // A duplicate insert (already favorited, e.g. a double click) hits the
  // unique constraint — treat it as a no-op success, not an error.
  if (error && error.code !== '23505') {
    console.error('[favorites] addFavorite failed:', error)
    return { success: false, message: 'saveError' }
  }

  // La Home (I tuoi servizi, icone) si aggiorna
  revalidatePath('/dashboard')
  return { success: true }
}

export async function removeFavorite(toolName: string): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'notLoggedIn' }

  const { error } = await supabase.from('marketplace_favorites').delete().eq('user_id', user.id).eq('tool_name', toolName)
  if (error) {
    console.error('[favorites] removeFavorite failed:', error)
    return { success: false, message: 'saveError' }
  }

  // La Home (I tuoi servizi, icone) si aggiorna
  revalidatePath('/dashboard')
  return { success: true }
}
