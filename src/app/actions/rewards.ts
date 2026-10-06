'use server'

import { createClient } from '@/lib/supabase/server'
import { getSessionClient, getSessionUser } from '@/lib/session'

/**
 * Redeems a catalog reward with network_points: the cost check, deduction
 * and redemption record all happen inside one SECURITY DEFINER transaction
 * (redeem_reward, see
 * supabase/migrations/20260922150000_fix_voucher_points_and_reward_tiers.sql)
 * so this can't be raced, and a hidden/discontinued reward can't be
 * redeemed even if the client's catalog view is stale.
 */
export async function redeemReward(rewardId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false as const, message: 'notLoggedIn' as const }

  const { data, error } = await supabase
    .rpc('redeem_reward', { p_reward_id: rewardId })
    .single<{ success: boolean; reason: string | null; new_network_points: number }>()

  if (error || !data) return { success: false as const, message: 'error' as const }
  if (!data.success) {
    return {
      success: false as const,
      message: (data.reason || 'error') as 'not_found' | 'not_available' | 'insufficient_points',
      balance: data.new_network_points,
    }
  }
  return { success: true as const, balance: data.new_network_points }
}

/** The caller's own redemption history, for the "I miei premi" list. */
export async function listMyRedemptions() {
  // Utente verificato (getUser), letto una volta sola per richiesta
  const [supabase, user] = await Promise.all([getSessionClient(), getSessionUser()])
  if (!user) return []

  const { data } = await supabase
    .from('reward_redemptions')
    .select('id, reward_id, points_spent, redeemed_at, fulfilled_at, reward_catalog(title, image_url)')
    .eq('user_id', user.id)
    .order('redeemed_at', { ascending: false })
    .limit(100)

  return data || []
}
