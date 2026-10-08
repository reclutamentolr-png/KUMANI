'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Check, Clock, LoaderCircle, PenLine, Star, Trash2, XCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { deleteMyReview, submitReview } from '@/app/actions/reviews'
import { REVIEW_BODY_MAX, REVIEW_BODY_MIN, type MyReviewOption } from '@/lib/reviews'
import { askConfirm } from '@/lib/confirm'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'

const STATUS_STYLE = {
  pending: 'bg-amber-50 text-amber-800',
  approved: 'bg-emerald-50 text-emerald-700',
  rejected: 'bg-red-50 text-red-700',
}

export default function ReviewWriter({
  options,
  subjectNames,
  initialSubject,
  locale,
}: {
  options: MyReviewOption[]
  subjectNames: Record<string, string>
  initialSubject: string | null
  locale: string
}) {
  const t = useTranslations('reviews')
  const [open, setOpen] = useState<string | null>(
    initialSubject && options.some((o) => o.subject === initialSubject) ? initialSubject : options.find((o) => !o.review && o.purchaseLabel)?.subject ?? null
  )

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--gold)]/30 bg-white p-6 text-center">
        <p className="font-bold text-[var(--ink)]">{t('notEligibleTitle')}</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">{t('notEligibleText')}</p>
        <Link href="/recensioni#come-verifichiamo" className="mt-4 inline-block text-sm font-bold text-[var(--gold)] hover:text-[var(--ink)]">
          {t('howWeVerifyLink')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {options.map((option) => (
        <div key={option.subject} className="rounded-2xl border border-[var(--gold)]/30 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setOpen(open === option.subject ? null : option.subject)}
            className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            aria-expanded={open === option.subject}
          >
            <span className="min-w-0">
              <span className="block font-bold text-[var(--ink)]">{subjectNames[option.subject]}</span>
              <span className="text-xs text-[var(--muted)]">
                {option.purchaseLabel
                  ? option.purchaseLabel === 'pass'
                    ? t('verifiedPass', { service: subjectNames[option.subject] })
                    : t('verifiedPlan', { plan: option.purchaseLabel === 'pro' ? 'Pro' : 'Base' })
                  : t('noLongerEligible')}
              </span>
            </span>
            {option.review ? (
              <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[option.review.status]}`}>
                {option.review.status === 'approved' ? <Check className="h-3.5 w-3.5" /> : option.review.status === 'pending' ? <Clock className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                {t(`status_${option.review.status}`)}
              </span>
            ) : (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-[var(--gold-pale)] px-2.5 py-1 text-xs font-bold text-[var(--ink)]">
                <PenLine className="h-3.5 w-3.5" /> {t('writeShort')}
              </span>
            )}
          </button>
          {open === option.subject && <ReviewForm option={option} locale={locale} />}
        </div>
      ))}
    </div>
  )
}

function ReviewForm({ option, locale }: { option: MyReviewOption; locale: string }) {
  const t = useTranslations('reviews')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rating, setRating] = useState(option.review?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState(option.review?.title ?? '')
  const [body, setBody] = useState(option.review?.body ?? '')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const canWrite = option.purchaseLabel !== null

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    startTransition(async () => {
      const result = await submitReview({ subject: option.subject, rating, title, body, locale, consent })
      if (!result.success) {
        setError(t(`error_${result.message}`))
        return
      }
      setSaved(true)
      router.refresh()
    })
  }

  const remove = async () => {
    if (!option.review || !(await askConfirm(t('deleteConfirm')))) return
    startTransition(async () => {
      const result = await deleteMyReview(option.review!.id)
      if (!result.success) setError(t('error_saveError'))
      else router.refresh()
    })
  }

  return (
    <div className="border-t border-gray-100 px-5 pb-5 pt-4">
      {option.review?.status === 'rejected' && option.review.reject_reason && (
        <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{t('rejectedBecause', { reason: t(`reason_${option.review.reject_reason}`) })}</p>
      )}
      {option.review?.status === 'pending' && !saved && <p className="mb-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('pendingNote')}</p>}
      {saved && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{t('savedNote')}</p>}

      {canWrite ? (
        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="mb-1.5 text-sm font-semibold text-[var(--ink)]">{t('yourRating')}</p>
            <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHover(n)}
                  aria-label={t('starsLabel', { count: n })}
                  aria-pressed={rating === n}
                  className="rounded-lg p-1 transition-transform hover:scale-110"
                >
                  <Star className={`h-8 w-8 ${n <= (hover || rating) ? 'fill-[var(--gold)] text-[var(--gold)]' : 'text-gray-300'}`} strokeWidth={1.5} />
                </button>
              ))}
            </div>
          </div>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {t('titleLabel')}
            <input
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('titlePlaceholder')}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-normal outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20"
            />
          </label>
          <label className="block text-sm font-semibold text-[var(--ink)]">
            {t('bodyLabel')}
            <textarea
              value={body}
              required
              minLength={REVIEW_BODY_MIN}
              maxLength={REVIEW_BODY_MAX}
              rows={5}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t('bodyPlaceholder')}
              className="mt-1 w-full rounded-xl border border-gray-200 px-3.5 py-2.5 font-normal outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20"
            />
            <span className="mt-1 block text-right text-xs font-normal text-[var(--muted)]">
              {body.trim().length}/{REVIEW_BODY_MAX}
            </span>
          </label>
          <p className="text-xs text-[var(--muted)]">{t('rulesNote')}</p>
          <label className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
            {t('consentLabel')}
          </label>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <CancelButton className={cancelButtonLgClass} fallbackHref="/dashboard" />
            <button
              type="submit"
              disabled={isPending || rating === 0 || !consent}
              className="flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-bold text-white hover:bg-[var(--ink-soft)] disabled:opacity-50"
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {option.review ? t('updateReview') : t('sendReview')}
            </button>
            {option.review && (
              <button type="button" onClick={remove} disabled={isPending} className="flex items-center gap-1.5 rounded-xl px-3 py-3 text-sm font-semibold text-red-600 hover:bg-red-50">
                <Trash2 className="h-4 w-4" /> {t('deleteReview')}
              </button>
            )}
          </div>
        </form>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--muted)]">{t('noLongerEligibleText')}</p>
          {option.review && (
            <button type="button" onClick={remove} disabled={isPending} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
              <Trash2 className="h-4 w-4" /> {t('deleteReview')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
