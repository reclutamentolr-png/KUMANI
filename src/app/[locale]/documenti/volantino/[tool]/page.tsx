import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Megaphone } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { verifyAdmin } from '@/lib/verifyAdmin'
import { SITE_URL } from '@/lib/siteUrl'
import { getFlyer } from '@/lib/flyers'
import { getFlyerPlan, getFlyerTitles, listPublishedFlyers } from '@/lib/flyersData'
import FlyerView from '@/components/flyers/FlyerView'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('flyers')
  return { title: t('sectionTitle') }
}

// Anteprima e download di un volantino. Visibile se attivato in Admin
// (lo Staff lo vede sempre, per controllarlo prima di attivarlo).
export default async function FlyerPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params
  const locale = await getLocale()
  const t = await getTranslations('flyers')
  const config = getFlyer(tool)
  if (!config) notFound()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const published = await listPublishedFlyers(supabase)
  if (!published.has(tool) && !(await verifyAdmin('settings.read'))) notFound()

  const [titles, plan, { data: profile }] = await Promise.all([
    getFlyerTitles(),
    getFlyerPlan(supabase, tool),
    supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null }>(),
  ])
  const code = profile?.referral_code
  // Link di invito come quello della dashboard, sempre sul dominio pubblico
  const site = /localhost|127\.0\.0\.1/.test(SITE_URL) ? 'https://kumani.io' : SITE_URL
  const inviteUrl = code ? `${site}/${locale}/ref/${encodeURIComponent(code)}` : null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/documenti" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('back')}
          </Link>
          <span className="flex items-center gap-2 font-semibold tracking-wide">
            <Megaphone className="h-5 w-5 text-[var(--gold-bright)]" /> {titles[tool] ?? tool}
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-10">
        <FlyerView config={config} plan={plan} title={titles[tool] ?? tool} inviteUrl={inviteUrl} screenshotLang={locale === 'it' ? 'it' : 'en'} />
      </main>
    </div>
  )
}
