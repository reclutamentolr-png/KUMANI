import Image from 'next/image'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, HandCoins, HeartHandshake, Landmark } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getPublicDonationSummary } from '@/lib/donationsPublic'
import { euroFormat, percentFormat } from '@/lib/donationTypes'

// Homepage: le donazioni di KUMANI in grande (percentuale di ogni
// abbonamento, quanto è già stato versato all'associazione con le ricevute,
// associazione), con la foto del cuore al sole a lato (in alto sul
// telefono). Nessun totale maturato: non deve far capire quanti sono gli
// abbonati. Nascosta finché non c'è un'associazione attiva.
export default async function HomeDonations() {
  const summary = await getPublicDonationSummary()
  const active = summary?.active
  if (!summary || !active) return null
  const t = await getTranslations('donations')
  const locale = await getLocale()
  const eur = (cents: number) => euroFormat(locale, cents)

  return (
    <section className="py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="relative grid grid-cols-1 overflow-hidden rounded-3xl border-2 border-[var(--gold)] bg-gradient-to-br from-[#2a2418] via-[var(--ink)] to-[var(--ink)] shadow-[0_24px_60px_rgba(199,154,59,0.25)] lg:grid-cols-[minmax(240px,300px)_1fr]">
          <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[var(--gold)]/20 blur-3xl" />
          {/* Foto: mani che tengono un cuore al sole */}
          <div className="relative h-52 sm:h-64 lg:h-auto">
            <Image src="/home/donation-heart.webp" alt="" fill sizes="(min-width: 1024px) 300px, 100vw" className="object-cover object-[center_35%]" />
          </div>
          <div className="relative grid min-w-0 grid-cols-1 gap-8 p-6 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--ink)]">
                <HeartHandshake className="h-3.5 w-3.5" /> {t('homeEyebrow')}
              </p>
              <h2 className="mt-4 text-3xl font-extrabold leading-tight text-white sm:text-4xl">{t('homeTitle')}</h2>
              <p className="mt-3 text-base leading-relaxed text-gray-300 sm:text-lg">
                {t('pledgeLine', { percent: percentFormat(locale, summary.percent_bp), association: active.name })}
              </p>
              {active.mission && <p className="mt-2 text-sm italic text-[var(--gold-bright)]">“{active.mission}”</p>}
              <Link
                href="/donazioni"
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-xl hover:brightness-110"
              >
                {t('homeCta')} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-[var(--gold)]/40 bg-white/[0.06] p-5 text-center">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">{t('pledgeShort')}</p>
                <p className="mt-1 text-5xl font-extrabold text-white sm:text-6xl">{percentFormat(locale, summary.percent_bp)}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <Landmark className="mx-auto h-5 w-5 text-[var(--gold-bright)]" />
                  <p className="mt-1 text-xl font-bold text-white">{eur(summary.paid_cents)}</p>
                  <p className="text-[11px] text-white/60">{t('paidLabel')}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center">
                  <HandCoins className="mx-auto h-5 w-5 text-[var(--gold-bright)]" />
                  <p className="mt-1 text-xl font-bold text-white">{eur(summary.points_cents)}</p>
                  <p className="text-[11px] text-white/60">{t('fromPoints')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-3">
                {active.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={active.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-lg bg-white object-contain p-1" />
                ) : (
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--gold)]/20">
                    <HeartHandshake className="h-5 w-5 text-[var(--gold-bright)]" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-white/50">{t('associationLabel')}</p>
                  <p className="truncate font-bold text-white">{active.name}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
