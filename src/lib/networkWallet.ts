import type { SupabaseClient } from '@supabase/supabase-js'
import { buildRanks, thresholdsFromPacks, type RankDefinition } from '@/lib/ranks'

export type VoucherPack = { points: number; credit_eur: number }

export type NetworkWallet = {
  networkPoints: number
  earnedTotal: number
  voucherCreditCents: number
  packs: VoucherPack[]
  voucherValueBaseEur: number
  voucherValueProEur: number
  ranks: RankDefinition[]
}

// Punti Community, credito voucher e pacchetti dell'utente (my_network_wallet)
export async function getMyNetworkWallet(supabase: SupabaseClient): Promise<NetworkWallet> {
  const { data } = await supabase.rpc('my_network_wallet').maybeSingle<{
    network_points: number
    earned_total: number
    voucher_credit_cents: number
    packs: VoucherPack[]
    voucher_value_base_eur: number
    voucher_value_pro_eur: number
  }>()
  const packs = Array.isArray(data?.packs) ? data.packs : []
  return {
    networkPoints: data?.network_points ?? 0,
    earnedTotal: data?.earned_total ?? 0,
    voucherCreditCents: data?.voucher_credit_cents ?? 0,
    packs,
    voucherValueBaseEur: data?.voucher_value_base_eur ?? 49,
    voucherValueProEur: data?.voucher_value_pro_eur ?? 149,
    ranks: buildRanks(thresholdsFromPacks(packs)),
  }
}
