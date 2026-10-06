'use server'

import { createClient } from '@/lib/supabase/server'
import { BUSINESS_SOCIALS, type BusinessProfile } from '@/lib/businessProfile'

// Salva la «Scheda attività» (Base o Pro: lo controllano le regole del
// database su quote_issuer_profiles)
export async function saveBusinessProfile(
  form: Omit<BusinessProfile, 'logoUrl'>,
  logoPath: string | null
): Promise<{ success: true } | { success: false; message: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, message: 'saveError' }
  if (!form.companyName.trim()) return { success: false, message: 'companyRequired' }

  const clean = (v: string, max: number) => v.trim().slice(0, max) || null
  const accent = /^#[0-9a-fA-F]{6}$/.test(form.accent) ? form.accent : null
  const socials: Record<string, string> = {}
  for (const key of BUSINESS_SOCIALS) {
    const v = (form.socials[key] ?? '').trim().slice(0, 300)
    if (v) socials[key] = v
  }
  const hours = form.openingHours
    .map((r) => ({ day: r.day.trim().slice(0, 40), hours: r.hours.trim().slice(0, 80) }))
    .filter((r) => r.day || r.hours)
    .slice(0, 14)

  const payload: Record<string, unknown> = {
    user_id: user.id,
    company_name: clean(form.companyName, 120),
    vat_number: clean(form.vatNumber, 30),
    address: clean(form.address, 200),
    city: clean(form.city, 80),
    postal_code: clean(form.postalCode, 12),
    province: clean(form.province, 40),
    pec: clean(form.pec, 120),
    email: clean(form.email, 120),
    phone: clean(form.phone, 40),
    whatsapp: clean(form.whatsapp, 40),
    website: clean(form.website, 300),
    socials,
    accent,
    tagline: clean(form.tagline, 160),
    opening_hours: hours,
    payment_info: clean(form.paymentInfo, 500),
    review_url: clean(form.reviewUrl, 300),
    updated_at: new Date().toISOString(),
  }
  // Il logo si aggiorna solo se ne è stato caricato uno nuovo, e solo dalla
  // cartella dell'utente
  if (logoPath && logoPath.startsWith(`${user.id}/`) && !logoPath.includes('..')) payload.logo_path = logoPath

  const { error } = await supabase.from('quote_issuer_profiles').upsert(payload, { onConflict: 'user_id' })
  if (error) {
    console.error('[scheda attività] salvataggio:', error.message)
    return { success: false, message: error.code === '42501' ? 'planRequired' : 'saveError' }
  }
  return { success: true }
}
