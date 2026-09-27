'use server'

import { createClient } from '@/lib/supabase/server'
import { FORM_PROFILE_FIELDS, missingProfileFields, type LockableProfileField } from '@/lib/profileFields'

// Dati per il promemoria "completa il profilo": solo se l'utente è
// collegato e il profilo non è ancora completo (profile_completed_at vuoto,
// impostato dal database quando tutti i dati obbligatori sono presenti).
// "dismissed": il promemoria è già stato chiuso una volta senza completare,
// da ora la richiesta è obbligatoria.
export async function getIncompleteProfile(): Promise<
  | { status: 'anonymous' }
  | { status: 'complete' }
  | { status: 'incomplete'; profile: Record<string, unknown>; missing: LockableProfileField[]; dismissed: boolean }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { status: 'anonymous' }
  const { data: profile } = await supabase.rpc('get_my_profile').maybeSingle<Record<string, unknown>>()
  if (!profile || profile.profile_completed_at) return { status: 'complete' }
  const picked: Record<string, unknown> = { id: profile.id }
  for (const field of FORM_PROFILE_FIELDS) picked[field] = profile[field] ?? null
  return {
    status: 'incomplete',
    profile: picked,
    missing: missingProfileFields(profile),
    dismissed: Boolean(profile.profile_reminder_dismissed_at),
  }
}
