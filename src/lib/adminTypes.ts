// Tipi dei dati del pannello admin (AdminDashboard e src/app/actions/admin.ts).
// Il client Supabase non è tipizzato: questi tipi descrivono le colonne
// selezionate nelle query e usate dal pannello.

import type { SpotlightModerationStatus } from '@/lib/spotlight'

// Profilo ridotto unito alle righe (autore, destinatario, proprietario...)
export type AdminProfileRef = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
}

// adminListUsers
export type AdminUserRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  referral_code: string | null
  subscription_status: string | null
  is_blocked: boolean | null
  created_at: string
}

// adminGetProfile (select '*'): solo i campi usati dal modulo di modifica
export type AdminProfileDetail = {
  id: string
  email: string | null
  first_name: string | null
  last_name: string | null
  username: string | null
  phone: string | null
  country_code: string | null
  date_of_birth: string | null
  occupation: string | null
  referral_code: string | null
  daily_points: number | null
  subscription_status: string | null
  subscription_plan: string | null
  subscription_expires_at: string | null
  is_admin: boolean | null
}

// Modulo "Modifica Profilo": vuoto finché non si apre un utente
export type AdminProfileForm = Partial<{
  first_name: string
  last_name: string
  username: string
  phone: string
  country_code: string
  date_of_birth: string
  occupation: string
  referral_code: string
  daily_points: number
  subscription_status: string
  subscription_plan: string
  subscription_expires_at: string
  is_admin: boolean
}>

// marketplace_settings (select '*'): solo i campi usati
export type MarketplaceToolRow = {
  tool_name: string
  is_enabled: boolean
  required_plan: 'free' | 'base' | 'pro' | null
  description: string | null
  // Pass del singolo servizio (20261210100000_tool_passes.sql)
  pass_enabled?: boolean | null
  pass_price_cents?: number | null
}

export type MarketplaceToolUsage = MarketplaceToolRow & { usage_count: number }

// listCoupons
export type AdminCouponRow = {
  id: string
  code: string
  title: string
  description: string | null
  expires_at: string | null
  redeemed_at: string | null
  created_at: string
  user_id: string
  profiles: { first_name: string | null; last_name: string | null; email: string | null } | null
}

// listVouchers
export type AdminVoucherRow = {
  id: string
  code: string
  status: string
  created_at: string
  redeemed_at: string | null
  created_by: string
  redeemed_by: string | null
  creator: AdminProfileRef | null
  redeemer: AdminProfileRef | null
}

// listVoucherUsers
export type AdminVoucherUser = {
  id: string
  first_name: string | null
  last_name: string | null
  referral_code: string | null
  daily_points: number | null
}

// listVoucherBatches
export type AdminVoucherBatch = {
  id: string
  business_name: string
  quantity: number
  price_eur: number | null
  invoice_ref: string | null
  notes: string | null
  plan: string
  created_at: string
  redeemed: number
}

// listRewards
export type AdminRewardRow = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  points_cost: number
  is_visible: boolean
  created_at: string
}

// listRewardRedemptions
export type AdminRewardRedemption = {
  id: string
  reward_id: string
  user_id: string
  points_spent: number
  redeemed_at: string
  fulfilled_at: string | null
  fulfillment_code: string | null
  reward_catalog: { title: string } | null
  redeemer: AdminProfileRef | null
}

// listListingReports: riga letta da listing_reports con l'annuncio unito
export type ListingReportRow = {
  id: string
  listing_id: string
  reporter_id: string
  reason: string | null
  created_at: string
  listings: {
    id: string
    title: string
    description: string | null
    category: string | null
    price: number | null
    image_url: string | null
    user_id: string
    created_at: string
  } | null
}

export type ListingReport = ListingReportRow & {
  reporter: AdminProfileRef | null
  owner: AdminProfileRef | null
}

// listSpotlightProfilesForModeration
export type AdminSpotlightProfile = {
  id: string
  user_id: string
  display_name: string
  city: string | null
  country: string | null
  profession: string | null
  story: string
  story_locale: string | null
  is_opted_in: boolean
  show_on_home: boolean
  moderation_status: SpotlightModerationStatus
  updated_at: string
  owner: AdminProfileRef | null
}

// getHouseAccount
export type AdminHouseAccount = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  referral_code: string | null
  directMembers: number
}

// Impostazioni di sistema del modulo Impostazioni. Le chiavi elencate hanno
// un valore predefinito nel pannello; le altre righe di system_settings
// arrivano dal database con un valore qualsiasi.
export type AdminSystemSettings = {
  maintenance_mode: boolean
  maintenance_message: string
  matrix_slot_bonus_points: number
  matrix_spillover_bonus_points: number
  activity_thanks_points: number
  pro_invite_extra_points: number
  // Nuovo sistema Punti Community (20261203100000_network_points_v2.sql)
  network_points_activation_base: number
  network_points_activation_pro: number
  network_points_upgrade_pro: number
  voucher_packs: { points: number; credit_eur: number }[]
  voucher_value_base_eur: number
  voucher_value_pro_eur: number
  pro_trial_days: number
  affinity_intros_per_week: number
  listing_feature_cost_7d: number
  listing_feature_cost_15d: number
  menu_ai_daily_runs: number
  veritas_write_seconds: number
  veritas_vote_seconds: number
  veritas_reveal_seconds: number
  verifoto_daily_user: number
  checkmail_daily_user: number
  verifoto_monthly_ops: number
  mosaic_pixels_day: number
  mosaic_bonus_pixels: number
  mosaic_min_login_days: number
  fabula_min_login_days: number
  fabula_hide_after_reports: number
  [key: string]: unknown
}
