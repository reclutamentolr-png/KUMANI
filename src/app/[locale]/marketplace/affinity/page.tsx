import { SITE_URL } from '@/lib/siteUrl'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, HeartHandshake } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import AffinityGame from '@/components/affinity/AffinityGame'
import { createClient } from '@/lib/supabase/server'
import { isAffinityArchetype, isAffinityMap } from '@/lib/affinity'

export default async function AffinityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('affinity')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: row } = await supabase.from('affinity_profiles').select('map, archetype, duo_code').eq('user_id', user.id).maybeSingle()
  const initial =
    row && isAffinityMap(row.map) && isAffinityArchetype(row.archetype) ? { map: row.map, archetype: row.archetype, duoCode: row.duo_code as string } : null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">KUMANI Affinity</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <div className="relative mx-auto mb-10 max-w-3xl overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-center text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Affinity</h1>
            <p className="mt-3 text-lg font-semibold text-[var(--gold-bright)]">{t('tagline')}</p>
          </div>
        </div>
        <AffinityGame initial={initial} siteUrl={SITE_URL} />
        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-5 text-[var(--muted)]">{t('disclaimer')}</p>
      </main>
    </div>
  )
}
