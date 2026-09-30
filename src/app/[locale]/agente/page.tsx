import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getAgentOverview } from '@/app/actions/agents'
import AgentArea, { AgentLogoutButton } from '@/components/agents/AgentArea'
import Logo from '@/components/Logo'

// Area dell'agente venditore: link personale, vendite, provvigioni e pagamenti.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false },
}

export default async function AgentPage() {
  const locale = await getLocale()
  const overview = await getAgentOverview(locale)

  if (!overview) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) redirect(`/${locale}/login`)

    // Collegato ma non (più) agente attivo: account sospeso
    const t = await getTranslations('agentArea')
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--ink)] px-4 py-12">
        <div className="w-full max-w-md rounded-2xl border border-[var(--gold)]/40 bg-[var(--paper)] p-8 text-center shadow-xl">
          <div className="mb-4 flex justify-center">
            <Logo size={56} priority />
          </div>
          <h1 className="text-xl font-bold text-[var(--ink)]">{t('suspended.title')}</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">{t('suspended.text')}</p>
          <div className="mt-6 flex justify-center">
            <AgentLogoutButton variant="light" />
          </div>
        </div>
      </main>
    )
  }

  return <AgentArea overview={overview} />
}
