import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Swords } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import NexusDuel from '@/components/nexus/NexusDuel'
import { ServiceStopped } from '@/components/ServiceSuspended'
import { getNexusDuel } from '@/app/actions/nexusDuel'
import { createClient } from '@/lib/supabase/server'
import { isToolOnline } from '@/lib/toolOnline'

// Dati legati a un codice e che cambiano: sempre calcolata a ogni richiesta
export const dynamic = 'force-dynamic'

// KUMANI NEXUS — una Sfida (/nexus/<codice>): pubblica, si gioca anche senza
// account. Chi l'ha creata aspetta gli amici e la avvia; chi apre il link entra.
export default async function NexusChallengePage({ params }: { params: Promise<{ code: string }> }) {
  if (!(await isToolOnline('nexus'))) return <ServiceStopped />
  const [{ code }, t, supabase] = await Promise.all([params, getTranslations('nexus'), createClient()])
  const [state, { data }] = await Promise.all([getNexusDuel(code), supabase.auth.getUser()])
  const loggedIn = !!data.user

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href={loggedIn ? '/marketplace/nexus' : '/'} className="flex min-h-11 items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {loggedIn ? t('duel_back') : 'KUMANI'}
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
            {state.error === 'notFound' ? t('duel_notFound') : state.error === 'cancelled' ? t('duel_cancelledTitle') : state.error === 'full' ? t('duel_full') : t('error_load')}
          </p>
          <Link href={loggedIn ? '/marketplace/nexus' : '/'} className="mt-4 inline-flex min-h-11 items-center font-semibold text-[var(--ink)] underline">
            {loggedIn ? t('duel_backToDaily') : t('duel_toHome')}
          </Link>
        </div>
      ) : (
        <NexusDuel initial={state} />
      )}
    </div>
  )
}
