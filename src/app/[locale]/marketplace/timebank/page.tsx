import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Hourglass } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import TimeBankHome from '@/components/timebank/TimeBankHome'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { getTimebankMy, getTimebankStatus, listTimebankBoard } from '@/app/actions/timebank'

// KUMANI Time Bank (Community, gratis per gli iscritti verificati).
export default async function TimeBankPage() {
  const t = await getTranslations('timebank')
  const tc = await getTranslations('common')
  const [status, posts] = await Promise.all([getTimebankStatus(), listTimebankBoard({})])
  const my = status?.joined ? await getTimebankMy() : { exchanges: [], posts: [], ledger: [] }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
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
            <Hourglass className="h-5 w-5 text-[var(--gold-bright)]" />
            KUMANI Time Bank
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('eyebrow')}</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="mt-3 text-base text-white/70 sm:text-lg">{t('heroText')}</p>
          </div>
        </div>

        {status && !status.online && <SuspendedBanner className="mb-6" />}

        {status ? (
          <TimeBankHome status={status} initialPosts={posts} initialMy={my} />
        ) : (
          <p className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-[var(--muted)]">{t('error_saveError')}</p>
        )}
      </main>
    </div>
  )
}
