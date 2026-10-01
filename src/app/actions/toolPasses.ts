'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Attiva un codice pass per l'utente collegato
export async function redeemToolPassCode(code: string) {
  const supabase = await createClient()
  const clean = code.trim().toUpperCase()
  if (!clean) return { success: false, reason: 'not_found', tool: null, expiresAt: null }
  const { data, error } = await supabase
    .rpc('redeem_tool_pass_code', { p_code: clean })
    .maybeSingle<{ success: boolean; reason: string | null; tool: string | null; expires_at: string | null }>()
  if (error || !data) return { success: false, reason: 'error', tool: null, expiresAt: null }
  if (data.success) {
    revalidatePath('/dashboard')
    revalidatePath('/wallet')
  }
  return { success: data.success, reason: data.reason, tool: data.tool, expiresAt: data.expires_at }
}
