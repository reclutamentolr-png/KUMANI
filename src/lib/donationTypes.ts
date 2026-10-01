// Dati delle Donazioni KUMANI (donation_public_summary / my_donations)

export type DonationAssociationPublic = {
  id: string
  name: string
  tax_code: string | null
  description: string | null
  mission: string | null
  website: string | null
  logo_url: string | null
  accrued_cents: number
  paid_cents: number
}

export type DonationSummary = {
  base_cents: number
  pro_cents: number
  point_value_cents: number
  accrued_cents: number
  subscription_cents: number
  points_cents: number
  paid_cents: number
  donors: number
  active: DonationAssociationPublic | null
  associations: { name: string; website: string | null; is_active: boolean; accrued_cents: number; paid_cents: number }[]
  payouts: { amount_cents: number; paid_on: string; reference: string | null; receipt_url: string | null; association: string }[]
}

export type MyDonations = {
  total_points: number
  total_cents: number
  subscription_cents: number
  items: { points: number; amount_cents: number; created_at: string; association: string }[]
}

export const euroFormat = (locale: string, cents: number) =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 === 0 ? 0 : 2 }).format(cents / 100)
