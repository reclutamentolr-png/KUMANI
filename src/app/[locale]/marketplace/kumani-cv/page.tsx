import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import ToolBackLink from '@/components/ToolBackLink'
import { ArrowLeft, FileUser, Sparkles, PlusCircle } from 'lucide-react'
import { hasActiveCvAccess } from '@/lib/cv-server'
import CvsDashboard from '@/components/CvsDashboard'

export default async function KumaniCvPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const t = await getTranslations('kumaniCv')
  const commonT = await getTranslations('common')
  const { from } = await searchParams
  const backSuffix = from === 'dashboard' ? '?from=dashboard' : ''

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActiveCvAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/marketplace')
  }

  const { data: cvs } = await supabase
    .from('cvs')
    .select('id, title, full_name, role_title, template, updated_at')
    .eq('user_id', user.id)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <FileUser className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 bg-[var(--gold)]/15 text-[var(--gold-bright)] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                {t('badge')}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t('heroTitle')}</h2>
              <p className="text-white/70 text-base sm:text-lg">{t('heroDescription')}</p>
            </div>
            <Link
              href={`/marketplace/kumani-cv/new${backSuffix}`}
              className="flex shrink-0 items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all"
            >
              <PlusCircle className="w-5 h-5" />
              {t('newCv')}
            </Link>
          </div>
        </div>

        <CvsDashboard cvs={cvs || []} />
      </main>
    </div>
  )
}
