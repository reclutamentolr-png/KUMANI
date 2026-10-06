import type { SupabaseClient } from '@supabase/supabase-js'
import { buildRanks, type RankDefinition } from '@/lib/ranks'

export type NetworkWallet = {
  networkPoints: number
  earnedTotal: number
  // Attivazioni Base/Pro pagate delle persone invitate (contano per le qualifiche)
  activations: number
  // Dopo Kuman Black: 1 voucher ogni N nuove attivazioni
  blackPlusEvery: number
  voucherValueBaseEur: number
  voucherValueProEur: number
  // Punti assegnati: attivazione Base/Pro, passaggio a Pro, parte a chi accoglie
  pointsRules: { base: number; pro: number; upgrade: number; welcomeBase: number; welcomePro: number; welcomeFrom: number }
  ranks: RankDefinition[]
}

// KU Points, attivazioni e regole dell'utente (my_network_wallet)
export async function getMyNetworkWallet(supabase: SupabaseClient): Promise<NetworkWallet> {
  const { data } = await supabase.rpc('my_network_wallet').maybeSingle<{
    network_points: number
    earned_total: number
    activations: number
    qualifications: unknown
    black_plus_every: number
    points_activation_base: number
    points_activation_pro: number
    points_upgrade_pro: number
    welcome_base: number
    welcome_pro: number
    welcome_from_direct: number
    voucher_value_base_eur: number
    voucher_value_pro_eur: number
  }>()
  return {
    networkPoints: data?.network_points ?? 0,
    earnedTotal: data?.earned_total ?? 0,
    activations: data?.activations ?? 0,
    blackPlusEvery: data?.black_plus_every ?? 6,
    voucherValueBaseEur: data?.voucher_value_base_eur ?? 49,
    voucherValueProEur: data?.voucher_value_pro_eur ?? 149,
    pointsRules: {
      base: data?.points_activation_base ?? 10,
      pro: data?.points_activation_pro ?? 120,
      upgrade: data?.points_upgrade_pro ?? 110,
      welcomeBase: data?.welcome_base ?? 1,
      welcomePro: data?.welcome_pro ?? 10,
      welcomeFrom: data?.welcome_from_direct ?? 6,
    },
    ranks: buildRanks(data?.qualifications),
  }
}
