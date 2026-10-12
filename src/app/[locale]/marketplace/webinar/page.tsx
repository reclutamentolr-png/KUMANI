import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import { ArrowLeft, Radio } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import WebinarList, { type WebinarListItem } from '@/components/webinar/WebinarList'
import { createClient } from '@/lib/supabase/server'
import { serviceClient } from '@/lib/translationOverrides'
import { canHostWebinars } from '@/app/actions/webinar'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'webinar' })
  return { title: t('name'), robots: { index: false, follow: false } }
}

// KUMANI Webinar (in prova): solo Staff e tester. Non è ancora negli elenchi
// dei servizi; al lancio diventa uno strumento del piano Pro.
export default async function WebinarPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const prefix = locale === 'it' ? '' : `/${locale}`
  if (!user) redirect(`${prefix}/login?next=/marketplace/webinar`)
  if (!(await canHostWebinars(user.id))) redirect(`${prefix}/dashboard`)

  const t = await getTranslations('webinar')
  const tc = await getTranslations('common')
  const tm = await getTranslations('marketplace')
  const { data } = await serviceClient()
    .from('webinars')
    .select('id, code, title, starts_at, status')
    .eq('host_id', user.id)
    .order('starts_at', { ascending: false })
    .limit(50)
  const items: WebinarListItem[] = (data ?? []).map((w) => ({
    id: w.id,
    code: w.code,
    title: w.title,
    startsAt: w.starts_at,
    status: w.status,
    viewers: 0,
  }))
  // Prima quelli in onda e in programma, poi i finiti
  const rank = (s: string) => (s === 'live' ? 0 : s === 'scheduled' ? 1 : 2)
  items.sort((a, b) => rank(a.status) - rank(b.status) || (a.status === 'ended' ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt)))

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToDashboard')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" />
            {tm('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <Radio className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('name')}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <Radio className="h-4 w-4" />
              {t('testBadge')}
            </div>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="text-base text-white/70 sm:text-lg">{t('heroText')}</p>
          </div>
        </div>
        <WebinarList items={items} />
      </main>
    </div>
  )
}
