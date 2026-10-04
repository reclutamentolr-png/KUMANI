import { BadgeCheck, Star } from 'lucide-react'
import type { PublicReview } from '@/lib/reviews'

export function ReviewStars({ rating, size = 'h-4 w-4', label }: { rating: number; size?: string; label?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label ?? `${rating}/5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= Math.round(rating) ? 'fill-[var(--gold)] text-[var(--gold)]' : 'fill-transparent text-gray-300'}`} strokeWidth={1.5} />
      ))}
    </span>
  )
}

// Una recensione: stelle, titolo, testo, nome e "Acquisto verificato".
// I testi già tradotti arrivano dal chiamante (va bene sia lato server sia client).
export default function ReviewCard({
  review,
  verifiedText,
  subjectText,
  dateText,
  dark = false,
  clamp = false,
}: {
  review: PublicReview
  verifiedText: string
  subjectText?: string
  dateText: string
  dark?: boolean
  clamp?: boolean
}) {
  return (
    <article
      lang={review.locale}
      className={`flex h-full flex-col rounded-2xl border p-5 ${dark ? 'border-[var(--gold)]/20 bg-white/[0.04] text-white' : 'border-[var(--gold)]/25 bg-white text-[var(--ink)] shadow-[0_8px_24px_rgba(23,23,23,0.06)]'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <ReviewStars rating={review.rating} />
        {subjectText && (
          <span className={`truncate rounded-full px-2.5 py-0.5 text-[11px] font-bold ${dark ? 'bg-white/10 text-white/80' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>{subjectText}</span>
        )}
      </div>
      {review.title && <h3 className="mt-3 font-bold leading-snug">{review.title}</h3>}
      <p className={`mt-2 whitespace-pre-line text-sm leading-6 ${dark ? 'text-white/80' : 'text-[var(--ink)]/80'} ${clamp ? 'line-clamp-6' : ''}`}>{review.body}</p>
      <div className={`mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-4 text-xs ${dark ? 'text-white/60' : 'text-[var(--muted)]'}`}>
        <span>
          <span className={`font-bold ${dark ? 'text-white' : 'text-[var(--ink)]'}`}>{review.display_name}</span> · {dateText}
        </span>
        <span className={`inline-flex items-center gap-1 font-semibold ${dark ? 'text-[var(--gold-bright)]' : 'text-emerald-700'}`}>
          <BadgeCheck className="h-3.5 w-3.5" /> {verifiedText}
        </span>
      </div>
    </article>
  )
}
