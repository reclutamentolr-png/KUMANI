'use server'

import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { findStripeSubscriptionForUser } from '@/lib/stripeCustomer'

// Richiesta di cancellazione dell'account (GDPR, art. 17): l'utente la invia
// e può annullarla finché è in attesa; lo Staff la esegue entro 30 giorni.

export type AccountDeletionRequest = {
  id: string
  reason: string | null
  status: 'pending' | 'completed' | 'cancelled'
  requested_at: string
  processed_at: string | null
}

export type AccountDeletionResult = { success: true } | { success: false; error: 'pending' | 'not_allowed' | 'generic' }

export async function getMyDeletionRequest(): Promise<AccountDeletionRequest | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('account_deletion_requests')
    .select('id, reason, status, requested_at, processed_at')
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as AccountDeletionRequest | null) ?? null
}

export async function requestAccountDeletion(reason: string): Promise<AccountDeletionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'not_allowed' }
  const clean = (typeof reason === 'string' ? reason : '').trim().slice(0, 1000)
  const { data, error } = await supabase.rpc('account_request_deletion', { p_reason: clean })
  if (error) return { success: false, error: 'generic' }
  if (data === 'ok') {
    // Niente rinnovo mentre la richiesta aspetta lo Staff: l'abbonamento
    // con carta smette subito di rinnovarsi (errori ignorati: lo Staff lo
    // chiude comunque quando esegue la cancellazione)
    try {
      const found = await findStripeSubscriptionForUser(user.id, user.email)
      if (found?.subscription && !found.subscription.cancel_at_period_end) {
        await getStripe().subscriptions.update(found.subscription.id, { cancel_at_period_end: true })
      }
    } catch (err) {
      console.error('⚠️ Rinnovo non fermato alla richiesta di cancellazione:', err instanceof Error ? err.message : err)
    }
    return { success: true }
  }
  if (data === 'pending') return { success: false, error: 'pending' }
  if (data === 'not_allowed') return { success: false, error: 'not_allowed' }
  return { success: false, error: 'generic' }
}

export async function cancelAccountDeletion(): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false }
  const { error } = await supabase.rpc('account_cancel_deletion')
  return { success: !error }
}
