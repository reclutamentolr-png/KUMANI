import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, BookOpen, Puzzle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ToolBackLink from '@/components/ToolBackLink'
import NexusGame from '@/components/nexus/NexusGame'
import NexusDuelButton from '@/components/nexus/NexusDuelButton'
import { getNexusStatus } from '@/app/actions/nexus'
import { NEXUS_LOCALES, nexusLocaleFor, type NexusLocale } from '@/lib/nexus/types'

export const dynamic = 'force-dynamic'

// KUMANI NEXUS (SVAGO, gratis) — fase 1: il cruciverba del giorno.
// ?lang=it|en sceglie la lingua della griglia (di base quella del sito).
export default async function NexusPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const [t, tc, tg, locale, { lang }] = await Promise.all([getTranslations('nexus'), getTranslations('common'), getTranslations('guides'), getLocale(), searchParams])
  const gridLocale: NexusLocale = (NEXUS_LOCALES as readonly string[]).includes(lang ?? '') ? (lang as NexusLocale) : nexusLocaleFor(locale)
  const status = await getNexusStatus(gridLocale)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <ToolBackLink
            className="flex min-h-11 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToDashboard')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" />
            {t('back')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <Puzzle className="h-5 w-5 text-[var(--gold-bright)]" />
            KUMANI Nexus
          </h1>
        </div>
      </header>

      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <div className="flex items-center gap-3">
          <p className="text-lg font-extrabold text-[var(--ink)]">{t('title')}</p>
          {/* Sul telefono il pulsante fisso della guida lascerebbe spazio alla tastiera: la guida è qui */}
          <Link href="/guida/nexus?from=%2Fmarketplace%2Fnexus" className="flex min-h-9 items-center gap-1 text-sm font-semibold text-[var(--gold)] underline-offset-4 hover:underline sm:hidden">
            <BookOpen className="h-4 w-4" /> {tg('howToUse')}
          </Link>
        </div>
        {/* Lingua della griglia */}
        <div className="flex items-center gap-1 rounded-full border border-[var(--gold)]/30 bg-white p-1 text-xs font-bold" role="group" aria-label={t('gridLanguage')}>
          {NEXUS_LOCALES.map((code) => (
            <Link
              key={code}
              href={`/marketplace/nexus?lang=${code}`}
              aria-current={code === gridLocale ? 'true' : undefined}
              className={`flex min-h-9 items-center rounded-full px-3 ${code === gridLocale ? 'bg-[var(--ink)] text-white' : 'text-[var(--ink)] hover:bg-[var(--gold-pale)]'}`}
            >
              {t(`lang_${code}`)}
            </Link>
          ))}
        </div>
      </div>

      {status ? (
        <NexusGame key={`${status.puzzle.day}:${gridLocale}`} status={status} />
      ) : (
        <p className="mx-auto mt-8 max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-[var(--muted)]">{t('error_load')}</p>
      )}

      <div className="mx-auto mb-10 flex max-w-4xl flex-col gap-4 px-4">
        {/* Duello con un amico */}
        {status && (
          <div className="flex flex-col gap-3 rounded-2xl bg-[var(--ink)] p-5 text-white sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-extrabold">{t('duel_ctaTitle')}</p>
              <p className="text-sm text-white/75">{t('duel_ctaText')}</p>
            </div>
            <NexusDuelButton
              gridLocale={gridLocale}
              className="flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--gold-bright)] px-5 font-extrabold text-[var(--ink)] disabled:opacity-60"
            />
          </div>
        )}
        <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-bold text-[var(--ink)]">{t('howTitle')}</h2>
          <ol className="space-y-2 text-sm leading-6 text-[var(--muted)]">
            <li>1. {t('rule1')}</li>
            <li>2. {t('rule2')}</li>
            <li>3. {t('rule3')}</li>
            <li>4. {t('rule4')}</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
