'use server'

import { createClient } from '@/lib/supabase/server'
import { LOCKABLE_PROFILE_FIELDS } from '@/lib/profileFields'

// Richieste di cambio dei dati anagrafici bloccati (profilo completato):
// l'utente invia motivazione + nuovi valori, lo Staff approva o rifiuta.

export type ProfileChangeRequest = {
  id: string
  reason: string
  requested: Record<string, string>
  previous: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  staff_note: string | null
  created_at: string
  reviewed_at: string | null
  user_seen_at: string | null
}

export type ProfileChangeError = 'reason' | 'pending' | 'invalid' | 'no_changes' | 'not_allowed' | 'generic'

// Richiesta in verifica e ultimo esito (approvato/rifiutato) non ancora visto.
export async function getMyChangeRequest(): Promise<{ pending: ProfileChangeRequest | null; outcome: ProfileChangeRequest | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { pending: null, outcome: null }
  const { data } = await supabase
    .from('profile_change_requests')
    .select('id, reason, requested, previous, status, staff_note, created_at, reviewed_at, user_seen_at')
    .eq('user_id', user.id)
    .neq('status', 'cancelled')
    .order('created_at', { ascending: false })
    .limit(5)
  const rows = (data ?? []) as ProfileChangeRequest[]
  const pending = rows.find((row) => row.status === 'pending') ?? null
  const latestReviewed = rows.find((row) => row.status === 'approved' || row.status === 'rejected')
  const outcome = latestReviewed && !latestReviewed.user_seen_at ? latestReviewed : null
  return { pending, outcome }
}

export async function requestProfileChange(
  reason: string,
  changes: Record<string, string>
): Promise<{ success: true } | { success: false; error: ProfileChangeError }> {
  const cleanReason = (reason ?? '').trim()
  if (cleanReason.length < 10) return { success: false, error: 'reason' }
  // Solo i campi bloccabili, già ripuliti.
  const clean: Record<string, string> = {}
  for (const field of LOCKABLE_PROFILE_FIELDS) {
    const value = changes?.[field]
    if (typeof value === 'string' && value.trim()) clean[field] = value.trim().slice(0, 200)
  }
  if (Object.keys(clean).length === 0) return { success: false, error: 'no_changes' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('profile_request_change', { p_reason: cleanReason.slice(0, 1000), p_changes: clean })
  if (error) return { success: false, error: 'generic' }
  if (data === 'ok') return { success: true }
  const known: ProfileChangeError[] = ['reason', 'pending', 'invalid', 'no_changes', 'not_allowed']
  return { success: false, error: known.includes(data as ProfileChangeError) ? (data as ProfileChangeError) : 'generic' }
}

export async function cancelProfileChange(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('profile_cancel_change_request')
  return { success: !error }
}

export async function markProfileChangeSeen(id: string): Promise<{ success: boolean }> {
  if (!id) return { success: false }
  const supabase = await createClient()
  const { error } = await supabase.rpc('profile_change_request_seen', { p_id: id })
  return { success: !error }
}

// Promemoria "completa il profilo" chiuso senza completare: da ora è obbligatorio.
export async function dismissProfileReminder(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { error } = await supabase.rpc('profile_reminder_dismissed')
  return { success: !error }
}
