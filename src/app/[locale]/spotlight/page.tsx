import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, Star } from 'lucide-react'
import SpotlightCard from '@/components/spotlight/SpotlightCard'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { isEmptySpotlightProfile, type SpotlightProfile } from '@/lib/spotlight'
import { ServiceStopped } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

// Dati personali, legati a un codice o che cambiano: sempre calcolata a ogni
// richiesta, mai preparata in anticipo né tenuta in memoria
export const dynamic = 'force-dynamic'

interface ArchiveRow {
  day: string
  spotlight_profiles: {
    display_name: string
    city: string | null
    country: string | null
    profession: string | null
    story: string
  } | null
}

// Pagina pubblica (nessun controllo di autenticazione, come /ref/[code]):
// è la "vetrina" pensata per essere condivisa e vista anche da chi non è
// ancora iscritto a KUMANI.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('spotlight')
  return pageMetadata('/spotlight', { title: t('title'), description: t('subtitle') })
}

export default async function SpotlightPage() {
  if (!(await isToolOnline('spotlight'))) return <ServiceStopped />
  const t = await getTranslations('spotlight')
  const tm = await getTranslations('marketplace')
  const commonT = await getTranslations('common')
  const aboutT = await getTranslations('aboutPage')
  const homeT = await getTranslations('spotlightHome')
  const supabase = await createClient()

  // Pagina raggiungibile anche da chi non ha sessione (link condiviso), ma
  // per chi ce l'ha serve comunque un modo di tornare indietro: senza
  // header/nav propri, questa era una pagina senza uscita.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const today = new Date().toISOString().slice(0, 10)

  // get_todays_kumano() ritorna sempre un singolo oggetto, non un array —
  // vedi lib/spotlight.ts e il cast analogo in marketplace/spotlight/page.tsx.
  const [{ data: todaysKumanoRaw }, { data: archiveRows }] = await Promise.all([
    supabase.rpc('get_todays_kumano'),
    supabase
      .from('spotlight_days')
      .select('day, spotlight_profiles(display_name, city, country, profession, story)')
      .lt('day', today)
      .order('day', { ascending: false })
      .limit(30)
      .returns<ArchiveRow[]>(),
  ])
  const todaysKumano = todaysKumanoRaw as unknown as SpotlightProfile | null

  const toolTitleMap = new Map(getMarketplaceTools(tm).map((tool) => [tool.toolName, tool.title]))
  const hasTodaysKumano = !isEmptySpotlightProfile(todaysKumano)
  const archive = (archiveRows ?? []).filter((row) => row.spotlight_profiles)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        {/* Iscritto: torna alla dashboard. Visitatore arrivato dalla landing:
            torna alla home a sinistra, registrazione a destra. */}
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 pt-4 sm:px-6 lg:px-8">
          <Link href={user ? '/dashboard' : '/'} className="inline-flex items-center gap-2 text-sm font-medium text-white/70 transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-4 w-4" /> {user ? commonT('backToDashboard') : aboutT('backToHome')}
          </Link>
          {!user && (
            <Link
              href="/register"
              className="rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-1.5 text-sm font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
            >
              {homeT('register')}
            </Link>
          )}
        </div>
        <div className="mx-auto max-w-4xl px-4 pb-8 pt-4 text-center sm:px-6 lg:px-8">
          <div className="mb-3 flex items-center justify-center gap-2">
            <Star className="h-6 w-6 text-[var(--gold-bright)]" fill="currentColor" />
            <span className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('title')}</span>
          </div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t('publicHeader')}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t('todaysKumano')}</h2>
        {hasTodaysKumano && todaysKumano ? (
          <SpotlightCard
            displayName={todaysKumano.display_name}
            city={todaysKumano.city}
            country={todaysKumano.country}
            profession={todaysKumano.profession}
            story={todaysKumano.story}
            favoriteTools={(todaysKumano.favorite_tools ?? []).map((name) => toolTitleMap.get(name) ?? name)}
            badgeLabel={t('title')}
          />
        ) : (
          <p className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--paper)] p-6 text-sm text-[var(--muted)]">{t('noKumanoToday')}</p>
        )}

        <div className="mt-8 rounded-2xl border border-[var(--gold)]/25 bg-gradient-to-r from-[var(--ink)] to-[var(--ink-soft)] p-6 text-center text-white">
          <p className="text-lg font-bold">{t('ctaJoin')}</p>
          <Link
            href="/marketplace/spotlight"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 text-sm font-bold text-[var(--ink)]"
          >
            {t('ctaJoinButton')}
          </Link>
        </div>

        <h2 className="mb-4 mt-10 text-lg font-bold text-[var(--ink)]">{t('archiveTitle')}</h2>
        {archive.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">{t('archiveEmpty')}</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {archive.map((row) => (
              <SpotlightCard
                key={row.day}
                displayName={row.spotlight_profiles!.display_name}
                city={row.spotlight_profiles!.city}
                country={row.spotlight_profiles!.country}
                profession={row.spotlight_profiles!.profession}
                story={row.spotlight_profiles!.story}
                compact
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
