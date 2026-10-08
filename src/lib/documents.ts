// Documenti: "Doc KUMANI" (materiale ufficiale caricato dallo Staff) e
// "Doc Personali" (i documenti che l'utente crea con i servizi).

export const DOC_LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'] as const
export type DocLocale = (typeof DOC_LOCALES)[number]
export const DOC_FORMATS = ['pdf', 'pptx'] as const
export type DocFormat = (typeof DOC_FORMATS)[number]
export const DOC_CATEGORIES = ['presentation', 'rules', 'guide', 'other'] as const
export type DocCategory = (typeof DOC_CATEGORIES)[number]

export const DOC_BUCKET = 'kumani-docs'
export const DOC_MAX_BYTES = 50 * 1024 * 1024
export const DOC_MIME: Record<DocFormat, string> = {
  pdf: 'application/pdf',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export type Localized = Partial<Record<DocLocale, string>>

export type KumaniDocFile = { id: string; locale: DocLocale; format: DocFormat; file_name: string; size_bytes: number; uploaded_at: string }

export type KumaniDoc = {
  id: string
  title: Localized
  description: Localized
  category: DocCategory
  sort_order: number
  is_published: boolean
  files: KumaniDocFile[]
}

// Testo nella lingua richiesta, altrimenti italiano, altrimenti la prima disponibile
export function pickLocalized(value: Localized | null | undefined, locale: string): string {
  if (!value) return ''
  return value[locale as DocLocale] || value.it || Object.values(value).find(Boolean) || ''
}

export type PersonalDocKind = 'quote' | 'receipt' | 'receipt_received' | 'cv' | 'coupon' | 'event' | 'voucher' | 'home_doc' | 'vehicle_doc'

export type PersonalDoc = {
  kind: PersonalDocKind
  id: string
  title: string
  subtitle: string | null
  date: string
  href: string
}
