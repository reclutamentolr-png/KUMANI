import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { REVIEWS_CACHE_TAG, type PublicReview, type ReviewStats } from '@/lib/reviews'

// Recensioni approvate, uguali per tutti: client anonimo dentro la cache
// (10 minuti, svuotata subito quando lo Staff approva o ritira).
const getAnonClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

type StatsRow = { subject: string; reviews: number; average: number | string }

const fetchReviews = unstable_cache(
  async (subject: string | null, locale: string, limit: number) => {
    const supabase = getAnonClient()
    const [{ data: list }, { data: stats }] = await Promise.all([
      supabase.rpc('list_public_reviews', { p_subject: subject, p_locale: locale, p_limit: limit }),
      supabase.rpc('public_review_stats', { p_subject: subject }),
    ])
    const rows = (stats ?? []) as StatsRow[]
    const total = rows.find((row) => row.subject === 'all')
    const bySubject: Record<string, ReviewStats> = {}
    for (const row of rows) if (row.subject !== 'all') bySubject[row.subject] = { reviews: row.reviews, average: Number(row.average) }
    return {
      reviews: (list ?? []) as PublicReview[],
      stats: total ? { reviews: total.reviews, average: Number(total.average) } : { reviews: 0, average: 0 },
      bySubject,
    }
  },
  ['public-reviews'],
  { revalidate: 600, tags: [REVIEWS_CACHE_TAG] }
)

export function getPublicReviews(options: { subject?: string | null; locale: string; limit?: number }) {
  return fetchReviews(options.subject ?? null, options.locale, options.limit ?? 20)
}
