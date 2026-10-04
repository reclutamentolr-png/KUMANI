// Recensioni verificate: tipi e costanti condivisi (senza accesso al database)

export const REJECT_REASONS = ['offensive', 'personal_data', 'advertising', 'off_topic', 'not_genuine', 'other'] as const
export type RejectReason = (typeof REJECT_REASONS)[number]

export type PurchaseLabel = 'base' | 'pro' | 'pass'
export type ReviewStatus = 'pending' | 'approved' | 'rejected'

export type PublicReview = {
  id: string
  subject: string
  rating: number
  title: string | null
  body: string
  locale: string
  display_name: string
  purchase_label: PurchaseLabel
  created_at: string
}

export type ReviewStats = { reviews: number; average: number }

export type MyReviewOption = {
  subject: string
  purchaseLabel: PurchaseLabel | null
  review: {
    id: string
    rating: number
    title: string | null
    body: string
    status: ReviewStatus
    reject_reason: RejectReason | null
    purchase_label: PurchaseLabel
    updated_at: string
  } | null
}

export const REVIEWS_CACHE_TAG = 'public-reviews'
export const REVIEW_BODY_MIN = 20
export const REVIEW_BODY_MAX = 600
