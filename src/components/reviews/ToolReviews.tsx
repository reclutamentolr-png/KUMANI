import { getLocale } from 'next-intl/server'
import { ArrowRight } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getPublicReviews } from '@/lib/reviews-public'
import { getReviewTexts } from '@/lib/reviews-labels'
import ReviewCard, { ReviewStars } from './ReviewCard'

// Pagina pubblica di un servizio: le recensioni verificate di quel servizio
// (le ultime 4). Senza recensioni non compare.
export default async function ToolReviews({ subject }: { subject: string }) {
  const locale = await getLocale()
  const { reviews, stats } = await getPublicReviews({ subject, locale, limit: 4 })
  if (stats.reviews === 0) return null
  const { t, verified, date } = await getReviewTexts(locale)
  const average = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(stats.average)

  return (
    <section className="mt-10">
      <h2 className="text-lg font-bold text-[var(--gold-bright)]">{t('toolTitle')}</h2>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-300">
        <span className="text-lg font-extrabold text-white">{average}</span>
        <ReviewStars rating={stats.average} label={t('averageLabel', { average })} />
        <span>{t('basedOn', { count: stats.reviews })}</span>
      </p>
      <div className="mt-4 space-y-3">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} dark verifiedText={verified(review)} dateText={date(review.created_at)} />
        ))}
      </div>
      <Link href={`/recensioni?s=${subject}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold-bright)] hover:text-white">
        {t('seeAllTool')} <ArrowRight className="h-4 w-4" />
      </Link>
    </section>
  )
}
