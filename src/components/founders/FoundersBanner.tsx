import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, PartyPopper, Rocket } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getFoundersStatus } from '@/lib/founders'
import { formatOpenDate, getPlansGate } from '@/lib/plansGate'

// «Lancio Beta: entra tra i primi 50 utenti»: sconto commerciale del 100% sul
// Piano Base. Fascia dorata in cima alla homepage e riquadro grande (sopra i
// piani, in fondo alla homepage e nella registrazione), con i posti rimasti.
// Finiti i posti diventa «esauriti in N ore. Grazie!» per 48 ore, poi
// sparisce; sparisce anche con la promozione spenta (Admin).
export default async function FoundersBanner({ variant = 'bar', cta = true }: { variant?: 'bar' | 'card'; cta?: boolean }) {
  const status = await getFoundersStatus()
  if (status.soldOut) return <SoldOutBanner variant={variant} cta={cta} limit={status.limit} hours={status.soldOut.hours} />
  if (!status.enabled || status.left <= 0) return null
  const t = await getTranslations('founders')
  if (variant === 'card')
    return (
      <div className="relative mb-6 overflow-hidden rounded-3xl border-2 border-[var(--gold)] bg-gradient-to-br from-[#2e2716] via-[#1c1912] to-[var(--ink)] p-6 text-center text-white shadow-[0_18px_50px_rgba(199,154,59,0.25)] sm:p-8">
        <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[var(--gold)]/15 blur-2xl" />
        <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] shadow-lg sm:h-16 sm:w-16">
          <Rocket className="h-7 w-7 sm:h-8 sm:w-8" />
        </span>
        <p className="relative mt-4 text-xl font-extrabold leading-tight text-[var(--gold-bright)] sm:text-3xl">{t('bannerTitle', { limit: status.limit })}</p>
        {/* Il prezzo: 0 € anziché 49 € per un anno */}
        <p className="relative mt-4 flex items-baseline justify-center gap-3">
          <span className="text-5xl font-extrabold text-white sm:text-6xl">0 €</span>
          <span className="text-2xl font-bold text-white/50 line-through sm:text-3xl">49 €</span>
          <span className="text-base font-semibold text-white/75">{t('bannerYear')}</span>
        </p>
        <p className="relative mx-auto mt-4 max-w-xl text-base leading-7 text-white/85 sm:text-lg">{t('bannerText', { limit: status.limit })}</p>
        <p className="relative mt-5 inline-flex items-center rounded-full border border-[var(--gold)]/60 bg-[var(--gold)]/15 px-4 py-1.5 text-base font-extrabold text-[var(--gold-bright)]">
          {t('bannerLeft', { left: status.left })}
        </p>
        {cta && (
          <div className="relative mt-5">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-7 text-lg font-extrabold text-[var(--ink)] shadow-lg hover:brightness-110"
            >
              {t('bannerCta')} <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        )}
      </div>
    )
  return (
    <Link
      href="/register"
      className="relative z-30 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)] px-4 py-3 text-center text-base font-extrabold text-[var(--ink)] sm:text-lg"
    >
      <span className="inline-flex items-center gap-2">
        <Rocket className="h-5 w-5" /> {t('bannerTitle', { limit: status.limit })}
      </span>
      <span className="rounded-full bg-[var(--ink)] px-3 py-1 text-sm text-[var(--gold-bright)]">{t('bannerLeft', { left: status.left })}</span>
      <span className="underline underline-offset-2">{t('bannerCta')}</span>
    </Link>
  )
}

// Posti esauriti: il tempo vero (ore fino a un giorno, poi giorni) e il passo
// successivo per chi arriva dopo (iscrizione gratuita, data dei piani)
async function SoldOutBanner({ variant, cta, limit, hours }: { variant: 'bar' | 'card'; cta: boolean; limit: number; hours: number }) {
  const [t, locale, gate] = await Promise.all([getTranslations('founders'), getLocale(), getPlansGate()])
  const duration = hours <= 24 ? t('soldHours', { n: hours }) : t('soldDays', { n: Math.ceil(hours / 24) })
  const title = t('soldTitle', { limit, duration })
  const text = gate.closed ? t('soldText', { date: formatOpenDate(locale, gate.openDate) }) : t('soldTextOpen')
  if (variant === 'card')
    return (
      <div className="relative mb-6 overflow-hidden rounded-3xl border-2 border-[var(--gold)] bg-gradient-to-br from-[#2e2716] via-[#1c1912] to-[var(--ink)] p-6 text-center text-white shadow-[0_18px_50px_rgba(199,154,59,0.25)] sm:p-8">
        <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[var(--gold)]/15 blur-2xl" />
        <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] shadow-lg sm:h-16 sm:w-16">
          <PartyPopper className="h-7 w-7 sm:h-8 sm:w-8" />
        </span>
        <p className="relative mt-4 text-xl font-extrabold leading-tight text-[var(--gold-bright)] sm:text-3xl">{title}</p>
        <p className="relative mx-auto mt-4 max-w-xl text-base leading-7 text-white/85 sm:text-lg">{text}</p>
        {cta && (
          <div className="relative mt-5">
            <Link
              href="/register"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-7 text-lg font-extrabold text-[var(--ink)] shadow-lg hover:brightness-110"
            >
              {t('soldCta')} <ArrowRight className="h-5 w-5" />
            </Link>
          </div>
        )}
      </div>
    )
  return (
    <Link
      href="/register"
      className="relative z-30 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)] px-4 py-3 text-center text-base font-extrabold text-[var(--ink)] sm:text-lg"
    >
      <span className="inline-flex items-center gap-2">
        <PartyPopper className="h-5 w-5" /> {title}
      </span>
      <span className="underline underline-offset-2">{t('soldCta')}</span>
    </Link>
  )
}
