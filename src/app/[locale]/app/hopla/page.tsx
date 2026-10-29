import { getTranslations } from 'next-intl/server'
import { ArrowLeft, MonitorSmartphone } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import HoplaHost from '@/components/hopla/HoplaHost'
import { toolMetadata } from '@/lib/toolMetadata'
import HubBar from '@/components/hubs/HubBar'

// Nome del servizio nella scheda del browser
export const generateMetadata = toolMetadata('hopla')

// HOPLÀ (piano Plus e Pro): file tra telefono e computer o tra due telefoni,
// direttamente, in tutte e due le direzioni.
// La pagina è protetta dal proxy come gli altri strumenti; i file passano
// da dispositivo a dispositivo e non vengono mai salvati sui server.
export default async function HoplaPage() {
  const t = await getTranslations('hopla')
  const tm = await getTranslations('marketplace')
  const tc = await getTranslations('common')

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
          <h1 className="flex items-center gap-2 font-semibold tracking-wide min-w-0 text-right leading-tight">
            <MonitorSmartphone className="h-5 w-5 text-[var(--gold-bright)] shrink-0" />
            {tm('hopla')}
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <MonitorSmartphone className="h-4 w-4" />
              {t('badge')}
            </div>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="text-base text-white/70 sm:text-lg">{t('heroText')}</p>
          </div>
        </div>

        <HoplaHost />
      </main>
    </div>
  )
}
