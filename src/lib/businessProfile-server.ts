import type { SupabaseClient } from '@supabase/supabase-js'
import { BUSINESS_SOCIALS, EMPTY_BUSINESS_PROFILE, type BusinessProfile, type OpeningHoursRow } from '@/lib/businessProfile'

type Row = Record<string, unknown> & { logo_path?: string | null }

const str = (v: unknown) => (typeof v === 'string' ? v : '')

// Scheda attività dell'utente (con il client dell'utente: RLS mostra solo la
// sua). Senza riga restituisce la scheda vuota; i campi vuoti si possono
// completare con i dati personali (email, telefono) dove serve.
export async function getMyBusinessProfile(supabase: SupabaseClient, userId: string): Promise<BusinessProfile> {
  const { data } = await supabase.from('quote_issuer_profiles').select('*').eq('user_id', userId).maybeSingle<Row>()
  if (!data) return { ...EMPTY_BUSINESS_PROFILE }
  const socialsRaw = (data.socials ?? {}) as Record<string, unknown>
  const socials: BusinessProfile['socials'] = {}
  for (const key of BUSINESS_SOCIALS) if (str(socialsRaw[key])) socials[key] = str(socialsRaw[key])
  const hours = Array.isArray(data.opening_hours)
    ? (data.opening_hours as OpeningHoursRow[]).filter((r) => r && typeof r.day === 'string' && typeof r.hours === 'string')
    : []
  return {
    companyName: str(data.company_name),
    vatNumber: str(data.vat_number),
    address: str(data.address),
    city: str(data.city),
    postalCode: str(data.postal_code),
    province: str(data.province),
    pec: str(data.pec),
    email: str(data.email),
    phone: str(data.phone),
    whatsapp: str(data.whatsapp),
    website: str(data.website),
    socials,
    accent: str(data.accent),
    tagline: str(data.tagline),
    openingHours: hours,
    paymentInfo: str(data.payment_info),
    reviewUrl: str(data.review_url),
    logoUrl: data.logo_path ? supabase.storage.from('quote-logos-v2').getPublicUrl(data.logo_path).data.publicUrl : null,
  }
}
