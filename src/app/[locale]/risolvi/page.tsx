import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, LifeBuoy } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ToolBackLink from '@/components/ToolBackLink'
import { solveIcon } from '@/components/solve/solveIcons'
import { createClient } from '@/lib/supabase/server'
import { progressOf } from '@/lib/solve/engine'
import { SOLVE_GUIDES_IT } from '@/lib/solve/guides.it'
import { canSeeSolve, getSolveEnabled } from '@/lib/solve/server'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('solve')
  return { title: t('title'), robots: { index: false } }
}

// KUMANI Risolvi: l'elenco delle guide, con l'avanzamento di chi è collegato
export default async function SolveCatalogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const [t, tc] = await Promise.all([getTranslations('solve'), getTranslations('common')])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!(await canSeeSolve())) notFound()
  const preview = !(await getSolveEnabled())

  const { data: runs } = await supabase.from('solve_runs').select('guide_id, version, answers, done, completed_at').eq('user_id', user.id)
  const runOf = new Map((runs ?? []).map((r) => [r.guide_id as string, r]))

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            label={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToServices')}
              </>
            }
          />
          <h1 className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <LifeBuoy className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        {preview && <p className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">{t('previewNote')}</p>}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="text-base text-white/75 sm:text-lg">{t('heroText')}</p>
            {locale !== 'it' && <p className="mt-3 text-sm text-[var(--gold-bright)]">{t('onlyItalian')}</p>}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SOLVE_GUIDES_IT.map((guide) => {
            const Icon = solveIcon(guide.icon)
            const run = runOf.get(guide.id)
            const same = run && run.version === guide.version
            const p = same ? progressOf(guide, (run.answers ?? {}) as Record<string, string>, (run.done ?? []) as string[]) : null
            const completed = same && !!run.completed_at
            return (
              <Link
                key={guide.id}
                href={`/risolvi/${guide.id}`}
                className="group flex items-start gap-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm transition-colors hover:border-[var(--gold)]"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
                  <Icon className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold leading-snug text-[var(--ink)]">{guide.title}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">{guide.subtitle}</p>
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold">
                    <span className="inline-flex items-center gap-1 text-[var(--muted)]">
                      <Clock className="h-3.5 w-3.5" /> {t('minutes', { m: guide.minutes })}
                    </span>
                    {completed ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t('completed')}
                      </span>
                    ) : p && p.done > 0 ? (
                      <span className="text-[var(--gold)]">{t('progress', { done: p.done, total: p.total })}</span>
                    ) : null}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-[var(--gold)] transition-transform group-hover:translate-x-0.5" />
              </Link>
            )
          })}
        </div>
        <p className="mt-6 text-center text-xs text-[var(--muted)]">{t('disclaimer')}</p>
      </main>
    </div>
  )
}
