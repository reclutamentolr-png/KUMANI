import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ScanEye } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import VeriFotoTool from '@/components/verifoto/VeriFotoTool'
import { createClient } from '@/lib/supabase/server'

// VeriFoto (Sicurezza e Verifica, piano Base): la pagina è protetta dal proxy
// come gli altri strumenti; qui solo lo stato del rilevatore per l'utente.
export default async function VeriFotoPage() {
  const t = await getTranslations('verifoto')
  const tc = await getTranslations('common')
  const supabase = await createClient()
  const { data } = await supabase.rpc('verifoto_status')
  const status = (data as { left_today?: number; daily_limit?: number; quota_available?: boolean } | null) ?? null
  const detectorConfigured = !!process.env.SIGHTENGINE_API_USER && !!process.env.SIGHTENGINE_API_SECRET

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToDashboard')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" />
            {t('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <ScanEye className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <ScanEye className="h-4 w-4" />
              {t('badge')}
            </div>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="text-base text-white/70 sm:text-lg">{t('heroText')}</p>
          </div>
        </div>

        <VeriFotoTool
          detectorConfigured={detectorConfigured}
          leftToday={status?.left_today ?? 0}
          quotaAvailable={status?.quota_available ?? false}
        />
      </main>
    </div>
  )
}
