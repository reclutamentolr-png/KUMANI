import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import type { PublicReview } from '@/lib/reviews'

// Testi già pronti per le schede delle recensioni (server): di cosa parla,
// "Acquisto verificato · Pro / Pass …" e la data.
export async function getReviewTexts(locale: string) {
  const t = await getTranslations('reviews')
  const tm = await getTranslations('marketplace')
  const names = new Map(getMarketplaceTools(tm).map((tool) => [tool.toolName, tool.title]))
  const subjectName = (subject: string) => (subject === 'kumani' ? 'KUMANI' : (names.get(subject) ?? subject))
  const verified = (review: Pick<PublicReview, 'purchase_label' | 'subject'>) =>
    review.purchase_label === 'pass'
      ? t('verifiedPass', { service: subjectName(review.subject) })
      : t('verifiedPlan', { plan: review.purchase_label === 'pro' ? 'Pro' : 'Base' })
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  return { t, subjectName, verified, date, knownSubject: (subject: string) => subject === 'kumani' || names.has(subject) }
}
