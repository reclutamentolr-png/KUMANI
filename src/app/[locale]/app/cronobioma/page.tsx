import { getTranslations } from 'next-intl/server'
import { ArrowLeft, SunMoon } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import HubBar from '@/components/hubs/HubBar'
import CronobiomaApp from '@/components/cronobioma/CronobiomaApp'
import { createClient } from '@/lib/supabase/server'
import { toolMetadata } from '@/lib/toolMetadata'
import { SITE_URL } from '@/lib/siteUrl'
import type { CronobiomaProfile } from '@/app/actions/cronobioma'
import type { SleepLog } from '@/lib/cronobioma'

export const generateMetadata = toolMetadata('cronobioma')

// KUMANI CRONOBIOMA (piano Plus): l'orologio completo. La pagina è protetta
// dal proxy come gli altri strumenti; profilo e diario arrivano dal database
// (solo i propri).
export default async function CronobiomaPage() {
  const [t, tm, tc] = await Promise.all([getTranslations('cronobioma'), getTranslations('marketplace'), getTranslations('common')])
  const supabase = await createClient()
  const [{ data: profile }, { data: logs }, { data: me }] = await Promise.all([
    supabase.from('cronobioma_profiles').select('answers, wake_time, sleep_need, health_consent_at').maybeSingle(),
    supabase.from('cronobioma_sleep_logs').select('night, bed, wake, quality').order('night', { ascending: false }).limit(120),
    supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null }>(),
  ])
  // L'immagine da condividere porta al test pubblico con il proprio codice
  const shareUrl = `${SITE_URL}/cronobioma${me?.referral_code ? `?invito=${encodeURIComponent(me.referral_code)}` : ''}`

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            label={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToServices')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" />
            {tm('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight tracking-wide">
            <SunMoon className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            {tm('cronobioma')}
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--ink)] to-[#1e2a5a] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <SunMoon className="h-4 w-4" />
              {t('badge')}
            </div>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="text-base text-white/70 sm:text-lg">{t('heroText')}</p>
            <p className="mt-4 text-sm font-semibold italic text-[var(--gold-bright)]">{t('motto')}</p>
          </div>
        </div>

        <CronobiomaApp initialProfile={(profile as CronobiomaProfile | null) ?? null} initialLogs={(logs ?? []) as SleepLog[]} shareUrl={shareUrl} />
      </main>
    </div>
  )
}
