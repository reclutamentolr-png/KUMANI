import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ScanText } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import TextShieldTool from '@/components/textShield/TextShieldTool'
import HubBar from '@/components/hubs/HubBar'
import { createClient } from '@/lib/supabase/server'
import { toolMetadata } from '@/lib/toolMetadata'

// Nome del servizio nella scheda del browser
export const generateMetadata = toolMetadata('testo-protetto')

// TESTO PROTETTO (Sicurezza, piano Plus): dati personali sostituiti con
// etichette neutre prima di usare un testo con un'IA, e rimessi nella
// risposta. La pagina è protetta dal proxy; il testo non lascia mai il browser.
export default async function TestoProtettoPage() {
  const [t, tm, tc] = await Promise.all([getTranslations('textShield'), getTranslations('marketplace'), getTranslations('common')])
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
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
            <ScanText className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            {tm('testoProtetto')}
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <ScanText className="h-4 w-4" />
              {t('badge')}
            </div>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="text-base text-white/70 sm:text-lg">{t('heroText')}</p>
          </div>
        </div>

        <TextShieldTool owner={user?.id ?? 'anon'} />
      </main>
    </div>
  )
}
