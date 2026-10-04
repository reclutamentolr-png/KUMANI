'use server'

import { updateTag } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { localizedPath, notifyUser } from '@/lib/push'
import { REJECT_REASONS, REVIEW_BODY_MAX, REVIEW_BODY_MIN, REVIEWS_CACHE_TAG, type MyReviewOption, type RejectReason, type ReviewStatus } from '@/lib/reviews'

type ActionResult<T> = { success: true; data: T } | { success: false; message: string }

const LOCALES = ['it', 'en', 'fr', 'es', 'pt', 'de', 'ru']

const service = () =>
  createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

// Cosa può recensire l'utente collegato e le sue recensioni
export async function getMyReviewOptions(): Promise<MyReviewOption[]> {
  const supabase = await createClient()
  const { data } = await supabase.rpc('my_review_options')
  return ((data ?? []) as { subject: string; purchase_label: MyReviewOption['purchaseLabel']; review: MyReviewOption['review'] }[]).map((row) => ({
    subject: row.subject,
    purchaseLabel: row.purchase_label,
    review: row.review,
  }))
}

export async function submitReview(input: { subject: string; rating: number; title: string; body: string; locale: string; consent: boolean }): Promise<ActionResult<null>> {
  if (!input.consent) return { success: false, message: 'consentRequired' }
  const rating = Math.round(input.rating)
  if (!(rating >= 1 && rating <= 5)) return { success: false, message: 'ratingRequired' }
  const body = input.body.trim()
  if (body.length < REVIEW_BODY_MIN || body.length > REVIEW_BODY_MAX) return { success: false, message: 'bodyLength' }
  const locale = LOCALES.includes(input.locale) ? input.locale : 'it'

  const supabase = await createClient()
  const { error } = await supabase.rpc('submit_review', {
    p_subject: input.subject,
    p_rating: rating,
    p_title: input.title.trim().slice(0, 80),
    p_body: body,
    p_locale: locale,
  })
  if (error) {
    if (error.message.includes('not_eligible')) return { success: false, message: 'notEligible' }
    if (error.message.includes('not_logged_in')) return { success: false, message: 'notLoggedIn' }
    console.error('[reviews] submit failed:', error)
    return { success: false, message: 'saveError' }
  }
  // Se era pubblicata, torna in attesa: via dalla Home finché non è riapprovata
  updateTag(REVIEWS_CACHE_TAG)
  return { success: true, data: null }
}

export async function deleteMyReview(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) return { success: false, message: 'saveError' }
  updateTag(REVIEWS_CACHE_TAG)
  return { success: true, data: null }
}

// ---- Staff ----

export type AdminReview = {
  id: string
  subject: string
  rating: number
  title: string | null
  body: string
  locale: string
  display_name: string
  purchase_label: string
  status: ReviewStatus
  reject_reason: RejectReason | null
  created_at: string
  updated_at: string
  reviewed_at: string | null
  author: { first_name: string | null; last_name: string | null; email: string | null } | null
}

export async function listReviewsAdmin(status: ReviewStatus): Promise<{ reviews: AdminReview[]; counts: Record<ReviewStatus, number> } | null> {
  if (!(await verifyAdmin('listings.read'))) return null
  const db = service()
  const [{ data }, ...counts] = await Promise.all([
    db
      .from('reviews')
      .select('id, subject, rating, title, body, locale, display_name, purchase_label, status, reject_reason, created_at, updated_at, reviewed_at, user_id')
      .eq('status', status)
      .order(status === 'pending' ? 'updated_at' : 'reviewed_at', { ascending: status === 'pending' })
      .limit(200),
    ...(['pending', 'approved', 'rejected'] as const).map((s) => db.from('reviews').select('id', { count: 'exact', head: true }).eq('status', s)),
  ])
  const rows = (data ?? []) as (Omit<AdminReview, 'author'> & { user_id: string })[]
  const ids = [...new Set(rows.map((row) => row.user_id))]
  const { data: people } = ids.length ? await db.from('profiles').select('id, first_name, last_name, email').in('id', ids) : { data: [] }
  const byId = new Map((people ?? []).map((p) => [p.id as string, p]))
  return {
    reviews: rows.map(({ user_id, ...row }) => ({ ...row, author: (byId.get(user_id) as AdminReview['author']) ?? null })),
    counts: { pending: counts[0].count ?? 0, approved: counts[1].count ?? 0, rejected: counts[2].count ?? 0 },
  }
}

// Approva, oppure rifiuta/ritira con un motivo oggettivo; avvisa l'autore
export async function moderateReview(id: string, approve: boolean, reason?: RejectReason): Promise<{ success: boolean; error: string | null }> {
  const admin = await verifyAdmin('listings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!approve && (!reason || !REJECT_REASONS.includes(reason))) return { success: false, error: 'Scegli il motivo' }
  const db = service()
  const { data, error } = await db
    .from('reviews')
    .update({
      status: approve ? 'approved' : 'rejected',
      reject_reason: approve ? null : reason,
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.id,
    })
    .eq('id', id)
    .select('user_id, subject')
    .maybeSingle()
  if (error || !data) return { success: false, error: error?.message ?? 'Recensione non trovata' }
  updateTag(REVIEWS_CACHE_TAG)
  await notifyUser(
    data.user_id as string,
    'staff',
    (t, locale) =>
      approve
        ? { title: t('reviewApprovedTitle'), body: t('reviewApprovedBody'), url: localizedPath(locale, '/recensioni'), tag: `review-${id}` }
        : { title: t('reviewRejectedTitle'), body: t('reviewRejectedBody', { reason: t(`reviewReason_${reason}`) }), url: localizedPath(locale, '/recensioni/scrivi'), tag: `review-${id}` },
    { kind: approve ? 'review_approved' : 'review_rejected', ref: `${id}:${new Date().toISOString().slice(0, 16)}` }
  )
  return { success: true, error: null }
}
