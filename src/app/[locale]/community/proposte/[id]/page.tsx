import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Lightbulb } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import AppHeader from '@/components/nav/AppHeader'
import ProposalDetail from '@/components/proposals/ProposalDetail'
import { getProposal } from '@/app/actions/proposals'
import { proposalServices } from '@/lib/proposals-server'
import { getSessionUser } from '@/lib/session'
import { SITE_URL } from '@/lib/siteUrl'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'proposals' })
  return { title: t('title'), robots: { index: false, follow: false } }
}

export default async function ProposalPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login?next=/community/proposte/${id}`)
  const [t, proposal, services] = await Promise.all([getTranslations('proposals'), getProposal(id), proposalServices()])
  if (!proposal) notFound()
  const serviceName = proposal.tool_name ? (services.find((s) => s.value === proposal.tool_name)?.label ?? null) : null
  const prefix = locale === 'it' ? '' : `/${locale}`

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('title')} subtitle={t('subtitle')} icon={<Lightbulb className="h-6 w-6" />} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <Link href="/community/proposte" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
          <ArrowLeft className="h-4 w-4" /> {t('backToList')}
        </Link>
        <ProposalDetail proposal={proposal} serviceName={serviceName} shareUrl={`${SITE_URL}${prefix}/community/proposte/${proposal.id}`} />
      </main>
    </div>
  )
}
