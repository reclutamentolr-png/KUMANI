import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import ToolBackLink from '@/components/ToolBackLink'
import { ArrowLeft, BriefcaseBusiness, Sparkles } from 'lucide-react'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import JobSearch from '@/components/jobs/JobSearch'
import { listJobFavorites, listJobSearches } from '@/app/actions/jobs'
import { isJobCountry, type JobCountry } from '@/lib/jobs/types'

// Trova Lavoro: offerte di lavoro da fonti esterne con filtri accurati.
// KUMANI non ospita annunci e non raccoglie CV: ci si candida sul sito
// dell'annuncio.

// Paese proposto se quello del profilo non è tra quelli cercabili
const BY_LOCALE: Record<string, JobCountry> = { it: 'IT', en: 'GB', fr: 'FR', es: 'ES', pt: 'PT', de: 'DE', ru: 'RU' }

export default async function TrovaLavoroPage() {
  const locale = await getLocale()
  const t = await getTranslations('jobs')
  const commonT = await getTranslations('common')
  const marketplaceT = await getTranslations('marketplace')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  if (!(await hasActiveToolAccess(supabase, user.id, 'trova-lavoro'))) redirect(`/${locale}/dashboard`)

  const [{ data: profile }, favorites, searches] = await Promise.all([
    supabase.rpc('get_my_profile').maybeSingle<{ country_code: string | null }>(),
    listJobFavorites(),
    listJobSearches(),
  ])
  const country = profile?.country_code?.toUpperCase()
  const defaultCountry: JobCountry = isJobCountry(country) ? country : (BY_LOCALE[locale] ?? 'IT')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={
              <>
                <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" /> {marketplaceT('backToMarketplace')}
          </ToolBackLink>
          <span className="flex items-center gap-2 font-semibold tracking-wide">
            <BriefcaseBusiness className="h-5 w-5 text-[var(--gold-bright)]" /> {marketplaceT('trovaLavoro')}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <Sparkles className="h-4 w-4" /> {t('eyebrow')}
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h1>
            <p className="mt-3 text-white/75">{t('heroText')}</p>
          </div>
        </section>

        <JobSearch defaultCountry={defaultCountry} initialFavorites={favorites} initialSearches={searches} />
      </main>
    </div>
  )
}
