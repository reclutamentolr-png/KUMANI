// Profilo completo dell'utente collegato, come lo restituisce
// get_my_profile(): la riga intera, quindi ogni campo c'è sempre (al più
// vuoto). Sono descritti i campi usati dal sito; gli altri arrivano
// comunque (Record) e si leggono come valori sconosciuti.
export type MyProfile = Record<string, unknown> & {
  id: string
  created_at: string
  first_name: string | null
  last_name: string | null
  username: string | null
  country_code: string | null
  referral_code: string | null
  sponsor_id: string | null
  daily_points: number | null
  network_points: number | null
  ku_earned_total: number | null
  subscription_status: string | null
  subscription_plan: string | null
  subscription_expires_at: string | null
  pro_trial_ends_at: string | null
  profile_completed_at: string | null
  is_admin: boolean | null
  qualifications_seen: string[] | null
  rank_bonuses_claimed: string[] | null
}
