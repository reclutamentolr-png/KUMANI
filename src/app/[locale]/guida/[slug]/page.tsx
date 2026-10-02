import type { Metadata } from 'next'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, ArrowRight, BookOpen, Clock, Lightbulb } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getGuidesContent, guideShot } from '@/lib/guides/content'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const locale = await getLocale()
  const t = await getTranslations('guides')
  const guide = (await getGuidesContent(locale)).guides.find((g) => g.slug === slug)
  if (!guide) return { title: t('metaTitle') }
  return { title: `${guide.title} · ${t('linkLabel')} KUMANI`, description: guide.summary }
}

// Una guida: passi numerati, ognuno con la sua schermata del telefono
// (l'elemento spiegato è evidenziato in oro), poi il pulsante per provare.
export default async function GuidePage({ params }: Props) {
  const { slug } = await params
  const locale = await getLocale()
  const t = await getTranslations('guides')
  const { guides } = await getGuidesContent(locale)
  const index = guides.findIndex((g) => g.slug === slug)
  if (index < 0) notFound()
  const guide = guides[index]
  const prev = guides[index - 1]
  const next = guides[index + 1]
  const total = guide.steps.length

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/guida" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('backToGuides')}
          </Link>
          <span className="flex items-center gap-2 font-semibold tracking-wide">
            <BookOpen className="h-5 w-5 text-[var(--gold-bright)]" /> {t('linkLabel')}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">{guide.title}</h1>
          <p className="mt-2 max-w-2xl text-[var(--muted)]">{guide.summary}</p>
          <p className="mt-3 flex items-center gap-3 text-sm font-semibold text-[var(--gold)]">
            <span>{t('steps', { count: total })}</span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> {t('minutes', { count: guide.minutes })}
            </span>
          </p>
        </div>

        <ol className="space-y-6">
          {guide.steps.map((step, i) => (
            <li
              key={i}
              className="grid grid-cols-1 items-start gap-5 rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:grid-cols-[1fr_250px] sm:p-6"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] font-bold text-[var(--ink)]">
                    {i + 1}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--muted)]">
                    {t('stepOf', { n: i + 1, total })}
                  </span>
                </div>
                <h2 className="mt-3 text-xl font-bold text-[var(--ink)]">{step.title}</h2>
                <p className="mt-2 leading-7 text-[var(--ink)]/80">{step.text}</p>
                {step.tip && (
                  <p className="mt-4 flex gap-2 rounded-2xl bg-[var(--gold-pale)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" />
                    <span>
                      <strong>{t('tip')}:</strong> {step.tip}
                    </span>
                  </p>
                )}
              </div>
              {/* Schermata in una cornice da telefono */}
              <div className="mx-auto w-full max-w-[250px] rounded-[2rem] border-[6px] border-[var(--ink)] bg-[var(--ink)] shadow-[0_14px_34px_rgba(23,23,23,0.22)]">
                <Image
                  src={guideShot(locale, guide.slug, i + 1)}
                  alt={t('shotAlt', { title: step.title })}
                  width={600}
                  height={1298}
                  sizes="250px"
                  className="h-auto w-full rounded-[1.6rem]"
                />
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 text-center">
          <Link
            href={guide.cta.href}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-md transition hover:brightness-105"
          >
            {guide.cta.label} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <nav className="mt-10 grid grid-cols-1 gap-3 border-t border-[var(--gold)]/25 pt-6 sm:grid-cols-2">
          {prev ? (
            <Link href={`/guida/${prev.slug}`} className="rounded-2xl border border-[var(--gold)]/30 bg-white px-4 py-3 transition hover:border-[var(--gold)]">
              <span className="flex items-center gap-1 text-xs font-semibold text-[var(--muted)]">
                <ArrowLeft className="h-3.5 w-3.5" /> {t('prev')}
              </span>
              <span className="mt-0.5 block font-bold text-[var(--ink)]">{prev.title}</span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next && (
            <Link href={`/guida/${next.slug}`} className="rounded-2xl border border-[var(--gold)]/30 bg-white px-4 py-3 text-right transition hover:border-[var(--gold)]">
              <span className="flex items-center justify-end gap-1 text-xs font-semibold text-[var(--muted)]">
                {t('next')} <ArrowRight className="h-3.5 w-3.5" />
              </span>
              <span className="mt-0.5 block font-bold text-[var(--ink)]">{next.title}</span>
            </Link>
          )}
        </nav>
      </main>
    </div>
  )
}
