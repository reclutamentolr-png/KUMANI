// Dati delle Donazioni KUMANI (donation_public_summary / my_donations)

export type DonationAssociationPublic = {
  id: string
  name: string
  tax_code: string | null
  description: string | null
  mission: string | null
  website: string | null
  logo_url: string | null
  paid_cents: number
}

// Dati pubblici: niente totale maturato né importi per piano (da cui si
// risalirebbe al numero di abbonati), solo il versato e i KU Points donati
export type DonationSummary = {
  // Percentuale di ogni abbonamento donata, in centesimi di punto (500 = 5%)
  percent_bp: number
  point_value_cents: number
  points_cents: number
  paid_cents: number
  donors: number
  active: DonationAssociationPublic | null
  associations: { name: string; website: string | null; is_active: boolean; paid_cents: number }[]
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

// "5%" / "5,5%" nella lingua della pagina
export const percentFormat = (locale: string, bp: number | null | undefined) =>
  typeof bp === 'number' && Number.isFinite(bp) ? new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(bp / 10000) : '—'
