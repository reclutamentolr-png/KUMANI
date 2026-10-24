
export const OBJECTIVES = [
  'call',
  'whatsapp',
  'quote',
  'booking',
  'sale',
  'store_visit',
  'other',
] as const
export type Objective = (typeof OBJECTIVES)[number]

export const TONES = [
  'professional',
  'friendly',
  'premium',
  'direct',
  'elegant',
  'energetic',
] as const
export type Tone = (typeof TONES)[number]

export interface OfferFormAnswers {
  whatOffer: string
  targetAudience: string
  priceInfo: string
  locationInfo: string
  strengthPoint: string
  objective: Objective
  tone: Tone
  contactWhatsapp: string
}

export interface GeneratedCampaignDraft {
  campaignTitle: string
  headline: string
  offerSummary: string
  description: string
  ctaLabel: string
  whatsappMessageSoft: string
  whatsappMessageDirect: string
  whatsappMessageFollowup: string
}

export { generateShortCode as generateCampaignCode } from '@/lib/shortLink'
