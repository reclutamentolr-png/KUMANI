import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Swords } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import NexusDuel from '@/components/nexus/NexusDuel'
import { getNexusDuel } from '@/app/actions/nexusDuel'

export const dynamic = 'force-dynamic'

// KUMANI NEXUS — una sfida (/marketplace/nexus/duello/<codice>): chi l'ha
// creata aspetta l'amico; l'amico che apre il link si unisce e si gioca.
export default async function NexusDuelPage({ params }: { params: Promise<{ code: string }> }) {
  const [{ code }, t] = await Promise.all([params, getTranslations('nexus')])
  const state = await getNexusDuel(code)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/marketplace/nexus" className="flex min-h-11 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('duel_back')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <Swords className="h-5 w-5 text-[var(--gold-bright)]" />
            KUMANI Nexus
          </h1>
        </div>
      </header>
      {'error' in state ? (
        <div className="mx-auto mt-10 max-w-md px-4 text-center">
          <p className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-[var(--muted)]">
            {state.error === 'notFound' ? t('duel_notFound') : state.error === 'full' ? t('duel_full') : t('error_load')}
          </p>
          <Link href="/marketplace/nexus" className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--ink)] underline">
            {t('duel_backToDaily')}
          </Link>
        </div>
      ) : (
        <NexusDuel initial={state} />
      )}
    </div>
  )
}
