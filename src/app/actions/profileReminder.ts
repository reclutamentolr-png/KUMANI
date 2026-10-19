'use server'

import { createClient } from '@/lib/supabase/server'
import { FORM_PROFILE_FIELDS, missingProfileFields, type LockableProfileField } from '@/lib/profileFields'

// Dati per il promemoria "completa il profilo": solo se l'utente è
// collegato e il profilo non è ancora completo (profile_completed_at vuoto,
// impostato dal database quando tutti i dati obbligatori sono presenti).
// "dismissed": il promemoria è già stato chiuso una volta senza completare,
// da ora la richiesta è obbligatoria.
// Quando chiederlo:
// - piano Base o Pro attivo (pagato, con un codice o in prova Pro) oppure
//   un Pass di un servizio attivo (comprato, con un codice o regalato; non le
//   prove gratuite): subito, e la richiesta è obbligatoria («paid»), servono
//   i dati reali;
// - piano Gratis: dopo 7 giorni dall'iscrizione («dueAt»), prima niente.
const FREE_GRACE_MS = 7 * 24 * 60 * 60 * 1000

export async function getIncompleteProfile(): Promise<
  | { status: 'anonymous' }
  | { status: 'complete' }
  | { status: 'incomplete'; profile: Record<string, unknown>; missing: LockableProfileField[]; dismissed: boolean; paid: boolean; dueAt: number }
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
  const now = Date.now()
  const time = (value: unknown) => (typeof value === 'string' ? Date.parse(value) : NaN)
  const expires = time(profile.subscription_expires_at)
  const subscribed = (profile.subscription_status === 'active' && !(expires <= now)) || time(profile.pro_trial_ends_at) > now
  // Pass attivo (letto solo se serve)
  const withPass =
    !subscribed &&
    ((
      await supabase
        .from('tool_passes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('source', 'trial')
        .is('revoked_at', null)
        .gt('expires_at', new Date(now).toISOString())
    ).count ?? 0) > 0
  const paid = subscribed || withPass
  const created = time(profile.created_at)
  return {
    status: 'incomplete',
    profile: picked,
    missing: missingProfileFields(profile),
    dismissed: Boolean(profile.profile_reminder_dismissed_at),
    paid,
    dueAt: paid ? 0 : (Number.isFinite(created) ? created : now) + FREE_GRACE_MS,
  }
}
