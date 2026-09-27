import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import ToolBackLink from '@/components/ToolBackLink'
import NeurobalancePlayer from '@/components/NeurobalancePlayer'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, ArrowRight, Brain, Flower2, Headphones, ShieldCheck, Sparkles, Waves } from 'lucide-react'

export default async function NeurobalancePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('neurobalance')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]" dashboardLabel={<><ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}</>}><ArrowLeft className="h-5 w-5" /> {t('backToMarketplace')}</ToolBackLink>
          <div className="flex items-center gap-2"><Waves className="h-5 w-5 text-[var(--gold-bright)]" /><span className="font-semibold tracking-wide">Neurobalance</span></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]"><Sparkles className="h-4 w-4" /> {t('eyebrow')}</div>
            <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">Neurobalance</h1>
            <p className="text-base text-white/70 sm:text-lg">{t('subtitle')}</p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/30 px-3 py-1 text-sm text-white/80"><Headphones className="h-4 w-4 text-[var(--gold-bright)]" /> {t('headphones')}</div>
          </div>
        </div>
        <NeurobalancePlayer />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-5 shadow-sm"><Brain className="mb-3 h-7 w-7 text-[var(--gold)]" /><h2 className="font-bold text-[var(--ink)]">{t('featureRitmiTitle')}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('featureRitmiDescription')}</p></div>
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-5 shadow-sm"><Waves className="mb-3 h-7 w-7 text-[var(--gold)]" /><h2 className="font-bold text-[var(--ink)]">{t('featureAudioTitle')}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('featureAudioDescription')}</p></div>
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-5 shadow-sm"><ShieldCheck className="mb-3 h-7 w-7 text-[var(--gold)]" /><h2 className="font-bold text-[var(--ink)]">{t('featureSafetyTitle')}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('featureSafetyDescription')}</p></div>
        </div>
        <Link
          href="/marketplace/mandala"
          className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--gold)]/25 bg-[var(--ink)] p-5 text-white shadow-md transition-colors hover:border-[var(--gold)]/60 sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <Flower2 className="h-7 w-7 shrink-0 text-[var(--gold-bright)]" />
            <div>
              <h2 className="font-bold">{t('crossLinkMandalaTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-white/70">{t('crossLinkMandalaBody')}</p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2 text-sm font-bold text-[var(--ink)]">
            {t('crossLinkMandalaButton')} <ArrowRight className="h-4 w-4" />
          </span>
        </Link>
        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-[var(--muted)]">{t('disclaimer')}</p>
      </main>
    </div>
  )
}