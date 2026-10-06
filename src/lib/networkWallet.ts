import type { SupabaseClient } from '@supabase/supabase-js'
import { buildRanks, type RankDefinition } from '@/lib/ranks'

export type NetworkWallet = {
  networkPoints: number
  earnedTotal: number
  // KU Points in conferma (meno di N giorni dal pagamento) e confermati:
  // solo questi contano per le qualifiche e si possono spendere
  pendingPoints: number
  confirmedPoints: number
  confirmDays: number
  // Attivazioni Base/Pro pagate e confermate delle persone invitate (contano
  // per le qualifiche) e quelle ancora in conferma
  activations: number
  pendingActivations: number
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
    pending_points: number
    confirmed_points: number
    activations: number
    pending_activations: number
    confirm_days: number
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
    pendingPoints: data?.pending_points ?? 0,
    confirmedPoints: data?.confirmed_points ?? 0,
    confirmDays: data?.confirm_days ?? 15,
    activations: data?.activations ?? 0,
    pendingActivations: data?.pending_activations ?? 0,
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
