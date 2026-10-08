import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ArrowLeft, Timer } from 'lucide-react'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import Link from '@/components/LocalizedLink'
import TrialCodesManager from '@/components/trials/TrialCodesManager'
import { SITE_URL } from '@/lib/siteUrl'
import { isGuestUser } from '@/lib/trials'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { robots: { index: false, follow: false } }

// Codici di prova dei servizi per Kumani (Base o Pro) e agenti: si crea un
// codice per un servizio e una durata e lo si manda a chi vuole provarlo
// senza registrarsi.
export default async function TrialCodesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=/codici-prova`)
  if (isGuestUser(user)) redirect(`/${locale}/prova/fine`)
  const t = await getTranslations('trials')
  const agent = user.app_metadata?.role === 'agent'
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: plan } = await service.rpc('plan_of', { p_user_id: user.id })
  const allowed = agent || plan === 'base' || plan === 'pro'
  const site = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/+$/, '')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href={agent ? '/agente' : '/dashboard'} className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t(agent ? 'backToAgent' : 'backToDashboard')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold">
            <Timer className="h-5 w-5 text-[var(--gold-bright)]" /> {t('pageHeading')}
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
        <p className="text-gray-700">{t('intro')}</p>
        {allowed ? (
          <TrialCodesManager siteUrl={site} />
        ) : (
          <div className="rounded-2xl border border-[var(--gold)]/30 bg-white p-6 text-center shadow-sm">
            <p className="text-gray-700">{t('needsPlan')}</p>
            <Link href="/dashboard" className="mt-4 inline-block rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-[var(--gold-bright)]">
              {t('backToDashboard')}
            </Link>
          </div>
        )}
      </main>
    </div>
  )
}
