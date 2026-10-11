import { getTranslations } from 'next-intl/server'
import { ArrowLeft, ShieldAlert } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import ScamNetHub, { type HubTab } from '@/components/scamNet/ScamNetHub'
import { SCAM_KINDS, type ScamKind } from '@/lib/scamNet'
import { toolMetadata } from '@/lib/toolMetadata'

// Nome del servizio nella scheda del browser
export const generateMetadata = toolMetadata('rete-antitruffa')

const TABS: HubTab[] = ['allerta', 'segnala', 'numero', 'mie']

// RETE ANTI-TRUFFA (gratis per tutti gli iscritti): allerta della community,
// segnalazioni, «Chi mi ha chiamato?» e le proprie segnalazioni.
// ?tab=segnala&kind=site&value=… arriva dai controlli (SVAT, IBAN, CheckMail).
export default async function ReteAntitruffaPage({ searchParams }: { searchParams: Promise<{ tab?: string; kind?: string; value?: string; n?: string }> }) {
  const params = await searchParams
  const t = await getTranslations('scamNet')
  const tm = await getTranslations('marketplace')
  const tc = await getTranslations('common')
  const tab = (TABS as string[]).includes(params.tab ?? '') ? (params.tab as HubTab) : params.n ? 'numero' : 'allerta'
  const kind = (SCAM_KINDS as readonly string[]).includes(params.kind ?? '') ? (params.kind as ScamKind) : undefined
  const value = typeof params.value === 'string' ? params.value.slice(0, 300) : undefined
  const phone = typeof params.n === 'string' ? params.n.slice(0, 40) : undefined

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
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
            <ShieldAlert className="h-5 w-5 text-[var(--gold-bright)]" />
            {tm('reteAntitruffa')}
          </h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <ShieldAlert className="h-4 w-4" />
              {t('badge')}
            </div>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t('heroTitle')}</h2>
            <p className="text-base text-white/75 sm:text-lg">{t('heroText')}</p>
          </div>
        </div>
        <ScamNetHub initialTab={tab} initialKind={kind} initialValue={value} initialPhone={phone} />
      </main>
    </div>
  )
}
