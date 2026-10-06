// «Scheda attività»: i dati dell'attività scritti una volta sola e ripresi
// dai servizi (Preventivi, Landing page, Menu, Kumi Card Fidelity, Firma
// email, QR Pro, Offermaker…) con «Usa i dati della Scheda attività».
// Stanno nella tabella quote_issuer_profiles (una riga per utente).

export const BUSINESS_SOCIALS = ['instagram', 'facebook', 'linkedin', 'tiktok', 'youtube'] as const
export type BusinessSocial = (typeof BUSINESS_SOCIALS)[number]

export type OpeningHoursRow = { day: string; hours: string }

export interface BusinessProfile {
  companyName: string
  vatNumber: string
  address: string
  city: string
  postalCode: string
  province: string
  pec: string
  email: string
  phone: string
  whatsapp: string
  website: string
  socials: Partial<Record<BusinessSocial, string>>
  accent: string
  tagline: string
  openingHours: OpeningHoursRow[]
  paymentInfo: string
  reviewUrl: string
  // Logo già caricato (URL pubblico), null se non c'è
  logoUrl: string | null
}

export const EMPTY_BUSINESS_PROFILE: BusinessProfile = {
  companyName: '',
  vatNumber: '',
  address: '',
  city: '',
  postalCode: '',
  province: '',
  pec: '',
  email: '',
  phone: '',
  whatsapp: '',
  website: '',
  socials: {},
  accent: '',
  tagline: '',
  openingHours: [],
  paymentInfo: '',
  reviewUrl: '',
  logoUrl: null,
}

// La Scheda ha qualcosa da riprendere?
export function hasBusinessProfile(p: BusinessProfile | null | undefined): p is BusinessProfile {
  return !!p && !!(p.companyName || p.phone || p.email || p.website || p.address || p.logoUrl)
}

// "Via Roma 5, 20100 Milano (MI)"
export function businessFullAddress(p: Pick<BusinessProfile, 'address' | 'postalCode' | 'city' | 'province'>): string {
  const town = [p.postalCode, p.city].filter(Boolean).join(' ')
  const withProvince = p.province ? `${town} (${p.province})`.trim() : town
  return [p.address, withProvince].filter(Boolean).join(', ')
}

// Sito con https:// davanti (i campi dei servizi lo vogliono completo)
export function businessWebsiteUrl(website: string): string {
  const w = website.trim()
  if (!w) return ''
  return /^https?:\/\//i.test(w) ? w : `https://${w}`
}
