import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Lightbulb } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import AppHeader from '@/components/nav/AppHeader'
import ProposalFormView from '@/components/proposals/ProposalFormView'
import { getProposal, proposeAccess } from '@/app/actions/proposals'
import { proposalServices } from '@/lib/proposals-server'
import { getSessionUser } from '@/lib/session'
import type { ProposalForm } from '@/lib/proposals'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'proposals' })
  return { title: t('newProposal'), robots: { index: false, follow: false } }
}

// Nuova proposta, oppure ?edit=<id> per correggerne una con modifica chiesta dallo Staff
export default async function NewProposalPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ edit?: string }> }) {
  const { locale } = await params
  const { edit } = await searchParams
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login?next=/community/proposte/nuova`)
  const [t, services] = await Promise.all([getTranslations('proposals'), proposalServices()])

  let initial: ProposalForm = { topic: 'new', toolName: '', title: '', body: '' }
  let editId: string | undefined
  if (edit) {
    const p = await getProposal(edit)
    if (!p || !p.is_mine || p.status !== 'changes') redirect(`/${locale}/community/proposte`)
    initial = { topic: p.topic, toolName: p.tool_name ?? '', title: p.title, body: p.body }
    editId = p.id
  } else {
    const access = await proposeAccess()
    if (!access.canPropose) redirect(`/${locale}/community/proposte`)
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('title')} subtitle={t('subtitle')} icon={<Lightbulb className="h-6 w-6" />} />
      <main className="mx-auto max-w-2xl space-y-5 px-4 py-6 sm:px-6">
        <Link href="/community/proposte" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
          <ArrowLeft className="h-4 w-4" /> {t('backToList')}
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-[var(--ink)]">{editId ? t('editTitle') : t('newProposal')}</h1>
          <p className="mt-2 text-[var(--muted)]">{t('formIntro')}</p>
        </div>
        <ProposalFormView initial={initial} editId={editId} services={services} />
      </main>
    </div>
  )
}
