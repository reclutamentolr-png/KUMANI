import { getLocale } from 'next-intl/server'
import { ArrowRight, MessageSquareQuote } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getPublicReviews } from '@/lib/reviews-public'
import { getReviewTexts } from '@/lib/reviews-labels'
import ReviewCard, { ReviewStars } from './ReviewCard'
import ReviewsScroller from './ReviewsScroller'

// Fascia "Cosa dicono i Kumani" della Home: media e numero delle recensioni
// approvate e le più recenti a scorrimento (prima quelle nella lingua del
// visitatore). Senza recensioni pubblicate non compare.
export default async function HomeReviews() {
  const locale = await getLocale()
  const { reviews, stats } = await getPublicReviews({ locale, limit: 12 })
  if (stats.reviews === 0 || reviews.length === 0) return null
  const { t, subjectName, verified, date } = await getReviewTexts(locale)
  const average = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(stats.average)

  return (
    <section className="py-10 sm:py-14 border-t border-[var(--gold)]/10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
              <MessageSquareQuote className="w-4 h-4" />
              {t('homeEyebrow')}
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white">{t('homeTitle')}</h2>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-sm sm:text-base text-gray-300">
              <span className="text-xl font-extrabold text-white">{average}</span>
              <ReviewStars rating={stats.average} size="h-5 w-5" label={t('averageLabel', { average })} />
              <span>{t('basedOn', { count: stats.reviews })}</span>
            </p>
          </div>
          <Link href="/recensioni" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold-bright)] hover:text-white transition-colors">
            {t('seeAll')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <ReviewsScroller prevLabel={t('previous')} nextLabel={t('next')}>
          {reviews.map((review) => (
            <div key={review.id} data-review-slide className="w-[85%] shrink-0 snap-start sm:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.7rem)]">
              <ReviewCard review={review} dark clamp verifiedText={verified(review)} subjectText={review.subject === 'kumani' ? undefined : subjectName(review.subject)} dateText={date(review.created_at)} />
            </div>
          ))}
        </ReviewsScroller>

        <p className="mt-4 text-center text-xs text-gray-500">
          {t('verifiedNote')}{' '}
          <Link href="/recensioni#come-verifichiamo" className="underline underline-offset-2 hover:text-[var(--gold-bright)]">
            {t('howWeVerifyLink')}
          </Link>
        </p>
      </div>
    </section>
  )
}
