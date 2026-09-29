import {
  SIGNATURE_TEMPLATES,
  SOCIAL_KEYS,
  emptySignature,
  safeColor,
  type SignatureData,
  type SignatureTemplate,
} from '@/lib/emailSignature'

// Bozza della firma salvata solo nel browser (localStorage), mai sul server.
export const DRAFT_KEY = 'kumani:firma-email:draft:v1'

export interface Draft {
  data: SignatureData
  template: SignatureTemplate
}

const str = (value: unknown) => (typeof value === 'string' ? value.slice(0, 500) : '')

/** Legge una bozza salvata, scartando tutto ciò che non ha la forma giusta. */
export function parseDraft(raw: string | null, base: SignatureData): Draft | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const { data, template } = parsed as { data?: Record<string, unknown>; template?: unknown }
    if (!data || typeof data !== 'object') return null
    const socialIn = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>
    const social = { ...emptySignature().social }
    for (const key of SOCIAL_KEYS) social[key] = str(socialIn[key])
    return {
      template: SIGNATURE_TEMPLATES.includes(template as SignatureTemplate) ? (template as SignatureTemplate) : 'classic',
      data: {
        fullName: typeof data.fullName === 'string' ? str(data.fullName) : base.fullName,
        role: typeof data.role === 'string' ? str(data.role) : base.role,
        company: str(data.company),
        phone: typeof data.phone === 'string' ? str(data.phone) : base.phone,
        mobile: str(data.mobile),
        email: typeof data.email === 'string' ? str(data.email) : base.email,
        website: str(data.website),
        address: str(data.address),
        logoUrl: str(data.logoUrl),
        photoUrl: str(data.photoUrl),
        color: safeColor(str(data.color)),
        social,
        includeCardLink: typeof data.includeCardLink === 'boolean' ? data.includeCardLink : true,
      },
    }
  } catch {
    return null
  }
}

export function saveDraft(draft: Draft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // Spazio pieno o navigazione privata: la bozza semplicemente non resta.
  }
}

export function clearDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    // niente da fare
  }
}
