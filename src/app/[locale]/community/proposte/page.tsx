import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Lightbulb } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import AppHeader from '@/components/nav/AppHeader'
import ProposalsBoard from '@/components/proposals/ProposalsBoard'
import { listProposals, proposeAccess } from '@/app/actions/proposals'
import { proposalServices } from '@/lib/proposals-server'
import { getSessionUser } from '@/lib/session'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'proposals' })
  return { title: t('title'), robots: { index: false, follow: false } }
}

// Proposte della community (fase 1: idee per KUMANI)
export default async function ProposalsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login?next=/community/proposte`)
  const [t, th, initial, access, services] = await Promise.all([
    getTranslations('proposals'),
    getTranslations('hub'),
    listProposals('top'),
    proposeAccess(),
    proposalServices(),
  ])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('title')} subtitle={t('subtitle')} icon={<Lightbulb className="h-6 w-6" />} />
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <Link href="/community" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
          <ArrowLeft className="h-4 w-4" /> {th('communityTitle')}
        </Link>
        <section className="relative overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('eyebrow')}</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="mt-3 text-base text-white/75 sm:text-lg">{t('heroText')}</p>
          </div>
        </section>
        <ProposalsBoard initial={initial} access={access} services={Object.fromEntries(services.map((s) => [s.value, s.label]))} />
      </main>
    </div>
  )
}
