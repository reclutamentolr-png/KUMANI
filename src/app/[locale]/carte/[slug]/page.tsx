import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, QrCode, ShieldCheck } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import ScamCardView from '@/components/scamCards/ScamCardView'
import ShareCardButton from '@/components/scamCards/ShareCardButton'
import { cardBySlug } from '@/lib/scamCards/cards'
import { inviteCodeFor, scamCardsPublic } from '@/lib/scamCards/publicAccess'
import { pageMetadata } from '@/lib/seo'

// CARTE ANTITRUFFA: pagina pubblica di una carta, quella che arriva su
// WhatsApp con «Avvisa qualcuno». Leggibile da tutti, anche senza iscrizione.
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const card = cardBySlug(slug)
  if (!card) return {}
  const [t, access] = await Promise.all([getTranslations('scamCards'), scamCardsPublic()])
  return pageMetadata(
    `/carte/${slug}`,
    { title: t('metaTitle', { name: card.name }), description: `«${card.bait}» ${card.move}`, robots: access.indexable ? undefined : { index: false, follow: false } },
    { ownImage: true }
  )
}

export default async function ScamCardPublicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ invito?: string; mazzo?: string }> }) {
  const [{ slug }, { invito, mazzo }] = await Promise.all([params, searchParams])
  const card = cardBySlug(slug)
  if (!card) notFound()
  const access = await scamCardsPublic()
  if (!access.visible) notFound()
  const [t, inviteCode] = await Promise.all([getTranslations('scamCards'), inviteCodeFor(access.userId, invito)])
  const incoming = typeof invito === 'string' && /^[A-Z0-9-]{4,20}$/i.test(invito) ? invito.toUpperCase() : null
  const registerHref = incoming ? `/register?invito=${encodeURIComponent(incoming)}` : '/register'

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="bg-[var(--ink)] text-white">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-4">
          <Link href="/" aria-label="KUMANI">
            <Logo size={34} className="h-[34px] w-[34px]" />
          </Link>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold-bright)]">{t('deckName')}</p>
          <Link href={`/carte${incoming ? `?invito=${incoming}` : ''}`} className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/25 px-3 text-sm font-bold hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" aria-hidden /> {t('allCardsLink')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        {/* Arrivati dal QR della carta stampata */}
        {mazzo && (
          <section className="mb-6 flex flex-wrap items-center gap-4 rounded-3xl border-2 border-[var(--gold)] bg-[var(--gold-pale)] p-5">
            <QrCode className="h-9 w-9 shrink-0 text-[var(--ink)]" aria-hidden />
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('deckTitle')}</h2>
              <p className="text-sm text-[var(--ink)]">{access.userId ? t('deckMember') : t('deckGuest')}</p>
            </div>
            <Link
              href={access.userId ? `/app/carte-antitruffa?carta=${card.no}` : registerHref}
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--ink)] px-5 font-bold text-[var(--gold-bright)]"
            >
              {access.userId ? t('deckMemberButton') : t('ctaGuestButton')}
            </Link>
          </section>
        )}
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--gold)]">{t('publicEyebrow', { animal: card.animal })}</p>
        <h1 className="mt-1 text-3xl font-extrabold text-[var(--ink)] sm:text-4xl">{card.name}</h1>

        <div className="mt-6 flex flex-wrap justify-center gap-5 [perspective:1200px] sm:justify-start">
          <ScamCardView card={card} width={260} uid="pf" />
          <ScamCardView card={card} width={260} flipped uid="pb" />
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <section>
            <h2 className="text-lg font-bold text-[var(--ink)]">{t('bait')}</h2>
            <p className="mt-2 rounded-2xl bg-white p-4 italic text-[var(--ink)]">«{card.bait}»</p>
            <h2 className="mt-5 text-lg font-bold text-[var(--ink)]">{t('signs')}</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--ink)]">
              {card.signs.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold text-[var(--ink)]">{t('defense')}</h2>
            <p className="mt-2 rounded-2xl bg-[var(--gold-bright)] p-4 font-bold text-[var(--ink)]">{card.defense}</p>
            <p className="mt-4 text-[var(--ink)]">
              <b>{t('move')}</b> {card.move}
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <ShareCardButton card={card} inviteCode={inviteCode} />
        </div>

        <section className="mt-10 rounded-3xl bg-[var(--ink)] p-6 text-white sm:p-8">
          <ShieldCheck className="h-8 w-8 text-[var(--gold-bright)]" aria-hidden />
          <h2 className="mt-3 text-2xl font-extrabold">{access.userId ? t('ctaMemberTitle') : t('ctaGuestTitle')}</h2>
          <p className="mt-2 max-w-2xl text-white/80">{access.userId ? t('ctaMemberText') : t('ctaGuestText')}</p>
          <Link
            href={access.userId ? '/app/carte-antitruffa' : registerHref}
            className="mt-5 inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--gold-bright)] px-6 font-extrabold text-[var(--ink)]"
          >
            {access.userId ? t('ctaMemberButton') : t('ctaGuestButton')}
          </Link>
        </section>
      </main>
    </div>
  )
}
