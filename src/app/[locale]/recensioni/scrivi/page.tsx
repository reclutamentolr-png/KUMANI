import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { PenLine } from 'lucide-react'
import AppHeader from '@/components/nav/AppHeader'
import { createClient } from '@/lib/supabase/server'
import { getMyReviewOptions } from '@/app/actions/reviews'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import ReviewWriter from '@/components/reviews/ReviewWriter'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('reviews')
  return { title: t('writeTitle'), robots: { index: false } }
}

// Scrivi o modifica le tue recensioni: KUMANI in generale e i servizi che
// hai acquistato (abbonamento o Pass, da almeno 7 giorni)
export default async function WriteReviewPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams
  const locale = await getLocale()
  const t = await getTranslations('reviews')
  const tm = await getTranslations('marketplace')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent('/recensioni/scrivi')}`)

  const names = Object.fromEntries(getMarketplaceTools(tm).map((tool) => [tool.toolName, tool.title]))
  const options = (await getMyReviewOptions())
    .filter((option) => option.subject === 'kumani' || names[option.subject])
    .sort((a, b) => (a.subject === 'kumani' ? -1 : b.subject === 'kumani' ? 1 : (names[a.subject] ?? '').localeCompare(names[b.subject] ?? '')))
  const subjectNames = { ...names, kumani: 'KUMANI' }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('writeTitle')} icon={<PenLine className="h-5 w-5" />} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <p className="text-[var(--muted)]">{t('writeIntro')}</p>
        <ReviewWriter options={options} subjectNames={subjectNames} initialSubject={s ?? null} locale={locale} />
      </main>
    </div>
  )
}
