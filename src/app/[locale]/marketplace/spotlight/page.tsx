import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, ArrowRight, Sparkles, Star } from 'lucide-react'
import SpotlightForm from '@/components/spotlight/SpotlightForm'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import { isEmptySpotlightProfile, type SpotlightProfile } from '@/lib/spotlight'

export default async function SpotlightManagePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('spotlight')
  const tm = await getTranslations('marketplace')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  // get_todays_kumano() ritorna sempre un singolo oggetto (non un array —
  // vedi lib/spotlight.ts), ma i tipi generati di supabase-js per .rpc()
  // assumono un array salvo generated types; il cast manuale evita il
  // mismatch senza forzare un .single() che qui non serve (la risposta è
  // già un oggetto singolo, mai avvolta in un array).
  // La pagina resta aperta anche senza abbonamento attivo (per poter
  // eliminare la propria storia), ma scrivere/modificare è per abbonati.
  const [{ data: profile }, { data: todaysKumanoRaw }, canEdit] = await Promise.all([
    supabase.from('spotlight_profiles').select('*').eq('user_id', user.id).maybeSingle<SpotlightProfile>(),
    supabase.rpc('get_todays_kumano'),
    hasActiveToolAccess(supabase, user.id, 'spotlight'),
  ])
  const todaysKumano = todaysKumanoRaw as unknown as SpotlightProfile | null

  const isTodaysKumano = !isEmptySpotlightProfile(todaysKumano) && profile?.id === todaysKumano?.id
  const availableTools = getMarketplaceTools(tm).map((tool) => ({ toolName: tool.toolName, title: tool.title }))

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <Star className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">{t('title')}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-center text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative mx-auto max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-semibold text-[var(--gold-bright)]">
              <Sparkles className="h-4 w-4" /> {t('eyebrow')}
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
            <p className="mt-4 text-base leading-7 text-white/70">{t('subtitle')}</p>
          </div>
        </div>

        {isTodaysKumano && (
          <div className="mb-6 rounded-2xl border border-[var(--gold)] bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] p-5 text-center font-bold text-[var(--ink)]">
            {t('youAreTodaysKumano')}
          </div>
        )}

        <SpotlightForm profile={profile ?? null} availableTools={availableTools} canEdit={canEdit} />

        <p className="mx-auto mt-6 max-w-xl text-center text-xs leading-5 text-[var(--muted)]">{t('candidateNote')}</p>

        <div className="mt-8 text-center">
          <Link href="/spotlight" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
            {t('viewPublicPage')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}
