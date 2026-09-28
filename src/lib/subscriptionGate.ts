import type { SupabaseClient } from '@supabase/supabase-js'

export interface SubscriptionProfile {
  subscription_status: string | null
  subscription_expires_at?: string | null
}

/**
 * Single source of truth for "is this subscription active" — status must be
 * 'active' and, if an expiry is set, it must not have passed yet. Used
 * anywhere a profile's paying status matters: tool gating, the leaderboard,
 * and rank/qualification thresholds.
 */
export function isActiveSubscription(profile: SubscriptionProfile | null | undefined): boolean {
  if (!profile || profile.subscription_status !== 'active') return false
  if (!profile.subscription_expires_at) return true
  return new Date(profile.subscription_expires_at).getTime() > Date.now()
}

/**
 * Gate used by premium marketplace tools that must re-check access server-side
 * (not just hide the marketplace card). The real rule lives in the database:
 * can_use_tool() checks the admin on/off toggle and whether the user's plan
 * (Base/Pro, trial included) covers the plan the admin requires for the tool.
 * Must be called with the user's session client (it uses auth.uid()).
 */
export async function hasActiveToolAccess(
  supabase: SupabaseClient,
  userId: string,
  toolName: string
): Promise<boolean> {
  const { data, error } = await supabase
    .rpc('can_use_tool', { p_tool: toolName })
    .maybeSingle<{ allowed: boolean; required_plan: string; known: boolean }>()
  if (!error && data) return data.allowed

  // Controllo non riuscito (errore momentaneo del database): meglio negare
  // e far riprovare che aprire uno strumento Pro a chi ha il Base.
  console.error(`[subscriptionGate] can_use_tool(${toolName}) failed for ${userId}:`, error?.message ?? 'no data')
  return false
}
