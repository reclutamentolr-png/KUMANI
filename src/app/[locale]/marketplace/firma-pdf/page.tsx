import { Caveat, Marck_Script } from 'next/font/google'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Signature } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import FirmaPdfApp from '@/components/firmaPdf/FirmaPdfApp'
import { createClient } from '@/lib/supabase/server'
import { toolMetadata } from '@/lib/toolMetadata'

// Caratteri «a mano» per la firma digitata (anche cirillico)
const caveat = Caveat({ subsets: ['latin', 'cyrillic'], weight: '600', display: 'swap' })
const marck = Marck_Script({ subsets: ['latin', 'cyrillic'], weight: '400', display: 'swap' })

// Nome del servizio nella scheda del browser
export const generateMetadata = toolMetadata('firma-pdf')

// FIRMA PDF (piano Base e Pro): il PDF si apre e si firma nel browser.
// La pagina è protetta dal proxy come gli altri strumenti; il documento
// non viene mai caricato sui server.
export default async function FirmaPdfPage() {
  const t = await getTranslations('firmaPdf')
  const tm = await getTranslations('marketplace')
  const tc = await getTranslations('common')
  const supabase = await createClient()
  const { data: profile } = await supabase.rpc('get_my_profile').maybeSingle<{ first_name: string | null; last_name: string | null }>()
  const defaultName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <ToolBackLink
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
            dashboardLabel={
              <>
                <ArrowLeft className="h-5 w-5" /> {tc('backToDashboard')}
              </>
            }
          >
            <ArrowLeft className="h-5 w-5" />
            {tm('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <Signature className="h-5 w-5 text-[var(--gold-bright)]" />
            {tm('firmaPdf')}
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <Signature className="h-4 w-4" />
              {t('badge')}
            </div>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="text-base text-white/70 sm:text-lg">{t('heroText')}</p>
          </div>
        </div>

        <FirmaPdfApp
          signatureFonts={[
            { family: caveat.style.fontFamily, label: 'Caveat' },
            { family: marck.style.fontFamily, label: 'Marck Script' },
          ]}
          textFont="Arial, Helvetica, sans-serif"
          defaultName={defaultName}
        />
      </main>
    </div>
  )
}
