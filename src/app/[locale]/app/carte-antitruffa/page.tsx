import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Layers } from 'lucide-react'
import ToolBackLink from '@/components/ToolBackLink'
import ScamCardsApp from '@/components/scamCards/ScamCardsApp'
import HubBar from '@/components/hubs/HubBar'
import { createClient } from '@/lib/supabase/server'
import { todayKey } from '@/lib/agenda'
import { monthKey } from '@/lib/scamCards/cards'
import { toolMetadata } from '@/lib/toolMetadata'

// Nome del servizio nella scheda del browser
export const generateMetadata = toolMetadata('carte-antitruffa')

// CARTE ANTITRUFFA (piani Plus e Pro): album di 20 carte, una per truffa.
// La pagina è protetta dal proxy; le carte prese si leggono con le regole
// del database (ognuno vede solo le sue).
export default async function CarteAntitruffaPage({ searchParams }: { searchParams: Promise<{ carta?: string }> }) {
  const { carta } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const [{ data: rows }, { data: fails }, { data: month }, { data: me }, t, tm, tc] = await Promise.all([
    user ? supabase.from('scam_cards').select('card_no, rarity, obtained_at, rare_at').eq('user_id', user.id) : Promise.resolve({ data: [] }),
    // Carte sbagliate oggi: si riprovano domani
    user ? supabase.from('scam_card_fails').select('card_no').eq('user_id', user.id).eq('failed_on', todayKey()) : Promise.resolve({ data: [] }),
    // Carta del mese (scelta dallo Staff)
    supabase.from('scam_card_month').select('card_no').eq('month', monthKey(todayKey())).maybeSingle(),
    // Codice d'invito per «Avvisa qualcuno» e nome per le carte rare
    supabase.rpc('get_my_profile').maybeSingle<{ referral_code: string | null; first_name: string | null }>(),
    getTranslations('scamCards'),
    getTranslations('marketplace'),
    getTranslations('common'),
  ])
  const owned = (rows ?? []).map((r) => ({ no: r.card_no as number, rarity: r.rarity as string, obtainedAt: r.obtained_at as string, rareAt: (r.rare_at as string | null) ?? null }))
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
            <Layers className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
            {tm('carteAntitruffa')}
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">{t('heroTitle')}</h2>
          <p className="mt-2 max-w-2xl text-base text-[var(--muted)] sm:text-lg">{t('heroText')}</p>
        </div>
        <ScamCardsApp
          initialOwned={owned}
          initialFailedToday={(fails ?? []).map((f) => f.card_no as number)}
          monthCard={(month?.card_no as number | undefined) ?? null}
          inviteCode={me?.referral_code ?? null}
          firstName={me?.first_name ?? null}
          openCard={Number(carta) || null}
        />
      </main>
    </div>
  )
}
