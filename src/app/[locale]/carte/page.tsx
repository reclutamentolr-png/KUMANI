import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import ScamCardView from '@/components/scamCards/ScamCardView'
import { cardSlug, SCAM_CARDS } from '@/lib/scamCards/cards'
import { scamCardsPublic } from '@/lib/scamCards/publicAccess'
import { pageMetadata } from '@/lib/seo'

// CARTE ANTITRUFFA: le 20 carte, pubbliche (ogni carta apre la sua pagina)
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
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold-bright)]">{t('deckName')}</p>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <h1 className="text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">{t('heroTitle')}</h1>
        <p className="mt-2 max-w-2xl text-[var(--muted)]">{t('indexText')}</p>
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
