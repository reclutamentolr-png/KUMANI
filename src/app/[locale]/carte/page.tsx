import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { BookOpen, Home, Layers, Share2, ShieldCheck } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import ScamCardView from '@/components/scamCards/ScamCardView'
import { cardSlug, SCAM_CARDS } from '@/lib/scamCards/cards'
import { scamCardsPublic } from '@/lib/scamCards/publicAccess'
import { pageMetadata } from '@/lib/seo'

// CARTE ANTITRUFFA: come funzionano e le 20 carte, pubbliche (ogni carta apre
// la sua pagina). È la pagina da aprire dalle notifiche e dai post.
export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
  const [t, access] = await Promise.all([getTranslations('scamCards'), scamCardsPublic()])
  return pageMetadata('/carte', { title: t('indexMetaTitle'), description: t('indexMetaDescription'), robots: access.indexable ? undefined : { index: false, follow: false } })
}

export default async function ScamCardsIndexPage({ searchParams }: { searchParams: Promise<{ invito?: string }> }) {
  const access = await scamCardsPublic()
  if (!access.visible) notFound()
  const [{ invito }, t] = await Promise.all([searchParams, getTranslations('scamCards')])
  const incoming = typeof invito === 'string' && /^[A-Z0-9-]{4,20}$/i.test(invito) ? invito.toUpperCase() : null
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="bg-[var(--ink)] text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-4">
          <Link href="/" aria-label="KUMANI">
            <Logo size={34} className="h-[34px] w-[34px]" />
          </Link>
          <p className="min-w-0 text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold-bright)]">{t('deckName')}</p>
          <Link
            href={access.userId ? '/dashboard' : '/'}
            className="ml-auto inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/25 px-3 text-sm font-bold hover:bg-white/10"
          >
            <Home className="h-4 w-4" aria-hidden /> {access.userId ? t('backDashboard') : t('backHome')}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">{t('heroTitle')}</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">{t('indexText')}</p>

        {/* Come funzionano */}
        <section className="mt-8 rounded-3xl bg-[var(--ink)] p-6 text-white sm:p-8" aria-labelledby="come-funzionano">
          <h2 id="come-funzionano" className="text-2xl font-extrabold text-[var(--gold-bright)]">
            {t('howTitle')}
          </h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-2">
            {(
              [
                [BookOpen, 'howRead'],
                [Layers, 'howQuiz'],
                [ShieldCheck, 'howCapture'],
                [Share2, 'howShare'],
              ] as const
            ).map(([Icon, key]) => (
              <li key={key} className="flex gap-3 rounded-2xl bg-white/5 p-4">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-[var(--gold-bright)]" aria-hidden />
                <div>
                  <p className="font-bold">{t(`${key}Title`)}</p>
                  <p className="mt-1 text-sm text-white/75">{t(`${key}Text`)}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-5 text-sm text-white/70">{t('howPlans')}</p>
          <Link
            href={access.userId ? '/app/carte-antitruffa' : `/register${incoming ? `?invito=${incoming}` : ''}`}
            className="mt-4 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--gold-bright)] px-6 font-extrabold text-[var(--ink)]"
          >
            {access.userId ? t('ctaMemberButton') : t('ctaGuestButton')}
          </Link>
        </section>

        <h2 className="mt-10 text-2xl font-extrabold text-[var(--ink)]">{t('indexCardsTitle')}</h2>
        <ul className="mt-8 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] justify-items-center gap-x-3 gap-y-6">
          {SCAM_CARDS.map((card) => (
            <li key={card.no}>
              <Link href={`/carte/${cardSlug(card)}${incoming ? `?invito=${incoming}` : ''}`} aria-label={card.name} className="block rounded-[10px] transition hover:-translate-y-0.5">
                <ScamCardView card={card} width={150} uid={`i${card.no}`} />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
