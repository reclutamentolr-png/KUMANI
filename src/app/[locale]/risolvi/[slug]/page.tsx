import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, LifeBuoy } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import SolvePlayer from '@/components/solve/SolvePlayer'
import { createClient } from '@/lib/supabase/server'
import { getServicesCatalog } from '@/lib/servicesCatalog'
import { cleanRun } from '@/lib/solve/engine'
import { solveGuideBySlug } from '@/lib/solve/guides.it'
import { canSeeSolve } from '@/lib/solve/server'
import type { SolveOutcome } from '@/lib/solve/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const guide = solveGuideBySlug((await params).slug)
  return { title: guide?.title ?? 'KUMANI', robots: { index: false } }
}

// Una guida di KUMANI Risolvi: domande, avvisi urgenti, passi e servizi.
// Il percorso salvato vale solo per la stessa versione della guida: se i
// passi sono cambiati si riparte (le risposte restano).
export default async function SolveGuidePage({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale, slug } = await params
  const guide = solveGuideBySlug(slug)
  if (!guide) notFound()
  const t = await getTranslations('solve')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!(await canSeeSolve())) notFound()

  const [{ data: run }, catalog] = await Promise.all([
    supabase.from('solve_runs').select('version, answers, done, outcome').eq('user_id', user.id).eq('guide_id', guide.id).maybeSingle(),
    getServicesCatalog(supabase, user.id, locale).catch(() => null),
  ])
  const saved = cleanRun(guide, run?.answers, run?.version === guide.version ? run?.done : [])
  // Servizi KUMANI collegati: aperti o con il piano che li sblocca
  const access: Record<string, { open: boolean; plan: 'free' | 'base' | 'pro' }> = {}
  for (const item of catalog?.items ?? []) access[item.toolName] = { open: item.open, plan: item.plan }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/risolvi" className="flex shrink-0 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('allGuides')}
          </Link>
          <p className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <LifeBuoy className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            {t('title')}
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <SolvePlayer
          guide={guide}
          initialAnswers={saved.answers}
          initialDone={saved.done}
          initialOutcome={run?.version === guide.version ? ((run?.outcome as SolveOutcome | null) ?? null) : null}
          access={access}
          locale={locale}
        />
      </main>
    </div>
  )
}
