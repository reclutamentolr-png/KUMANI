import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, BadgeCheck, MessageSquareQuote, PenLine, ShieldCheck } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import AppHeader from '@/components/nav/AppHeader'
import { pageMetadata } from '@/lib/seo'
import { getPublicReviews } from '@/lib/reviews-public'
import { getReviewTexts } from '@/lib/reviews-labels'
import ReviewCard, { ReviewStars } from '@/components/reviews/ReviewCard'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('reviews')
  return pageMetadata('/recensioni', { title: t('pageTitle'), description: t('pageIntro') })
}

// Tutte le recensioni approvate (filtro per argomento con ?s=) e come le
// verifichiamo: chi può scriverle, cosa rifiuta lo Staff, nessun premio.
export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams
  const locale = await getLocale()
  const { t, subjectName, verified, date, knownSubject } = await getReviewTexts(locale)
  const all = await getPublicReviews({ locale, limit: 1 })
  const subject = s && knownSubject(s) && all.bySubject[s] ? s : null
  const { reviews, stats } = subject ? await getPublicReviews({ subject, locale, limit: 200 }) : await getPublicReviews({ locale, limit: 200 })
  const fmt = (value: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
  const subjects = Object.entries(all.bySubject)
    .filter(([key]) => knownSubject(key))
    .sort((a, b) => (a[0] === 'kumani' ? -1 : b[0] === 'kumani' ? 1 : b[1].reviews - a[1].reviews))
  const appHeader = await AppHeader({ title: t('pageTitle'), icon: <MessageSquareQuote className="h-5 w-5" /> })

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {appHeader ?? (
        <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)]">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] hover:text-white">
              <ArrowLeft className="h-4 w-4" /> KUMANI
            </Link>
            <span className="flex items-center gap-2 font-semibold text-white">
              <MessageSquareQuote className="h-5 w-5 text-[var(--gold-bright)]" /> {t('pageTitle')}
            </span>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">{t('pageTitle')}</h1>
          <p className="mx-auto mt-3 max-w-2xl text-[var(--muted)]">{t('pageIntro')}</p>
        </div>

        <section className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm sm:flex-row">
          {stats.reviews > 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-4xl font-extrabold text-[var(--ink)]">{fmt(stats.average)}</span>
              <div>
                <ReviewStars rating={stats.average} size="h-5 w-5" label={t('averageLabel', { average: fmt(stats.average) })} />
                <p className="text-sm text-[var(--muted)]">{t('basedOn', { count: stats.reviews })}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">{t('noReviewsYet')}</p>
          )}
          <Link
            href="/recensioni/scrivi"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 text-sm font-bold text-[var(--ink)] shadow-sm hover:brightness-105"
          >
            <PenLine className="h-4 w-4" /> {t('writeCta')}
          </Link>
        </section>

        {subjects.length > 1 && (
          <nav aria-label={t('filterLabel')} className="flex gap-2 overflow-x-auto pb-1">
            <Link
              href="/recensioni"
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${!subject ? 'bg-[var(--ink)] text-white' : 'border border-[var(--gold)]/35 bg-white text-[var(--ink)]'}`}
            >
              {t('filterAll')} <span className="opacity-60">{all.stats.reviews}</span>
            </Link>
            {subjects.map(([key, value]) => (
              <Link
                key={key}
                href={`/recensioni?s=${key}`}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${subject === key ? 'bg-[var(--ink)] text-white' : 'border border-[var(--gold)]/35 bg-white text-[var(--ink)]'}`}
              >
                {subjectName(key)} <span className="opacity-60">{value.reviews}</span>
              </Link>
            ))}
          </nav>
        )}

        {reviews.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => (
              <ReviewCard
                key={review.id}
                review={review}
                verifiedText={verified(review)}
                subjectText={subjectName(review.subject)}
                dateText={date(review.created_at)}
              />
            ))}
          </div>
        )}

        <section id="come-verifichiamo" className="scroll-mt-24 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--ink)]">
            <ShieldCheck className="h-5 w-5 text-emerald-700" /> {t('howWeVerifyTitle')}
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--ink)]/85">
            {(['how1', 'how2', 'how3', 'how4', 'how5'] as const).map((key) => (
              <li key={key} className="flex gap-2">
                <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                <span>{t(key)}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  )
}
