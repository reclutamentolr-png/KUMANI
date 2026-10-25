import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, PenLine } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import AppHeader from '@/components/nav/AppHeader'
import { getMyReviewOptions } from '@/app/actions/reviews'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import ReviewWriter from '@/components/reviews/ReviewWriter'
import { getSessionUser, preloadSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function generateMetadata() {
  const t = await getTranslations('reviews')
  return { title: t('writeTitle'), robots: { index: false } }
}

// Scrivi o modifica le tue recensioni: KUMANI in generale e i servizi che
// usi (abbonamento, Pass o licenza omaggio, da almeno 7 giorni). Dal
// pulsante «Recensisci» di un servizio (?s=servizio) si vede solo quello,
// con il link per tornarci.
export default async function WriteReviewPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  const { s } = await searchParams
  const locale = await getLocale()
  const t = await getTranslations('reviews')
  const tm = await getTranslations('marketplace')
  // Utente letto una volta sola per la pagina e la sua intestazione
  preloadSession()
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(s ? `/recensioni/scrivi?s=${s}` : '/recensioni/scrivi')}`)

  const tools = getMarketplaceTools(tm)
  const names = Object.fromEntries(tools.map((tool) => [tool.toolName, tool.title]))
  // Solo il servizio scelto (se è uno dei servizi)
  const single = s ? tools.find((tool) => tool.toolName === s) : undefined
  const options = (await getMyReviewOptions())
    .filter((option) => (single ? option.subject === single.toolName : option.subject === 'kumani' || names[option.subject]))
    .sort((a, b) => (a.subject === 'kumani' ? -1 : b.subject === 'kumani' ? 1 : (names[a.subject] ?? '').localeCompare(names[b.subject] ?? '')))
  const subjectNames = { ...names, kumani: 'KUMANI' }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={single ? t('writeToolTitle', { service: single.title }) : t('writeTitle')} icon={<PenLine className="h-5 w-5" />} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        {single && (
          <Link href={single.href} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gold)] hover:text-[var(--ink)]">
            <ArrowLeft className="h-4 w-4" /> {t('backToTool', { service: single.title })}
          </Link>
        )}
        <p className="text-[var(--muted)]">{single ? t('writeToolIntro', { service: single.title }) : t('writeIntro')}</p>
        <ReviewWriter options={options} subjectNames={subjectNames} initialSubject={single?.toolName ?? null} locale={locale} single={!!single} />
        {single && options.length > 0 && (
          <Link href={single.href} className="inline-flex items-center gap-1.5 text-sm font-bold text-[var(--gold)] hover:text-[var(--ink)]">
            <ArrowLeft className="h-4 w-4" /> {t('backToTool', { service: single.title })}
          </Link>
        )}
      </main>
    </div>
  )
}
