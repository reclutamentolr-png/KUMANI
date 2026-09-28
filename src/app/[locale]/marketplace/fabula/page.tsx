import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Dices } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import FabulaHome from '@/components/fabula/FabulaHome'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { getFabulaGallery, getFabulaMy, getFabulaStatus } from '@/app/actions/fabula'

// Kumani Fabula (SVAGO, gratis): sei dadi, una micro-storia.
export default async function FabulaPage() {
  const t = await getTranslations('fabula')
  const tc = await getTranslations('common')
  const [status, gallery, my] = await Promise.all([getFabulaStatus(), getFabulaGallery(null, null), getFabulaMy()])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
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
            <Dices className="h-5 w-5 text-[var(--gold-bright)]" />
            Kumani Fabula
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">Kumani Fabula</p>
            <h2 className="mt-2 font-serif text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="mt-3 text-base text-white/70 sm:text-lg">{t('heroText')}</p>
          </div>
        </div>

        {status && !status.online && <SuspendedBanner className="mb-6" />}

        {status ? (
          <FabulaHome status={status} initialGallery={gallery} initialMy={my} />
        ) : (
          <p className="rounded-2xl border border-gray-200 bg-white p-6 text-center text-sm text-[var(--muted)]">{t('error_saveError')}</p>
        )}

        <div className="mt-8 rounded-2xl border border-[var(--gold)]/25 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-bold text-[var(--ink)]">{t('howTitle')}</h2>
          <ol className="space-y-2 text-sm leading-6 text-[var(--muted)]">
            <li>1. {t('rule1')}</li>
            <li>2. {t('rule2')}</li>
            <li>3. {t('rule3')}</li>
            <li>4. {t('rule4')}</li>
          </ol>
        </div>
      </main>
    </div>
  )
}
