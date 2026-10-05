import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, BookOpen, CalendarClock, Crown, Gift, HeartHandshake, Sparkles, Ticket, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import type { ServiceItem } from '@/lib/servicesCatalog'
import ShowFullDashboardButton from './ShowFullDashboardButton'

// Dashboard essenziale per chi è arrivato con il regalo di un Pass e non ha
// un piano: in alto il servizio ricevuto, poi i servizi gratuiti in una
// griglia ordinata, infine un solo invito a scoprire il resto di KUMANI.
// "Mostra la dashboard completa" la chiude per sempre (anche abbonandosi).
export default async function GiftWelcomeDashboard({
  firstName,
  services,
  passExpiry,
}: {
  firstName: string | null
  services: ServiceItem[]
  passExpiry: (toolName: string) => string | null
}) {
  const t = await getTranslations('gifts')
  const locale = await getLocale()
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const gifted = services.filter((item) => item.open && item.plan !== 'free' && passExpiry(item.toolName))
  const free = services.filter((item) => item.open && item.plan === 'free')

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--gold)]">{t('welcomeEyebrow')}</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">{firstName ? t('welcomeTitleName', { name: firstName }) : t('welcomeTitle')}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t('welcomeIntro')}</p>
      </div>

      {/* Il regalo ricevuto */}
      {gifted.map((item) => {
        const Icon = marketplaceIconMap[item.iconName] || Ticket
        const expiry = passExpiry(item.toolName)
        return (
          <section key={item.toolName} className="relative overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-lg sm:p-8">
            <div aria-hidden className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[var(--gold)]/20 blur-3xl" />
            <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
              <Gift className="h-4 w-4" /> {t('yourGift')}
            </p>
            <div className="relative mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
                <Icon className="h-8 w-8" strokeWidth={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold sm:text-2xl">{item.title}</h2>
                <p className="mt-1 text-sm leading-6 text-white/75">{item.description}</p>
                {expiry && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--gold-pale)]">
                    <CalendarClock className="h-3.5 w-3.5" /> {t('activeUntil', { date: date(expiry) })}
                  </p>
                )}
              </div>
            </div>
            <div className="relative mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href={item.href} className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)]">
                {t('openService')} <ArrowRight className="h-4 w-4" />
              </Link>
              {item.guide && (
                <Link href={`/guida/${item.guide}?from=/dashboard`} className="flex items-center justify-center gap-2 rounded-xl border border-white/20 px-6 py-3 font-semibold text-white hover:bg-white/5">
                  <BookOpen className="h-4 w-4 text-[var(--gold-bright)]" /> {t('howItWorks')}
                </Link>
              )}
            </div>
          </section>
        )
      })}

      {/* Servizi gratuiti */}
      {free.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-[var(--ink)]">{t('freeTitle')}</h2>
          <p className="mb-4 mt-0.5 text-sm text-[var(--muted)]">{t('freeIntro')}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {free.map((item) => {
              const Icon = marketplaceIconMap[item.iconName] || Sparkles
              return (
                <Link
                  key={item.toolName}
                  href={item.href}
                  className="group flex items-start gap-3 rounded-2xl border border-[var(--gold)]/20 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--gold)]/60 hover:shadow-md"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)] text-[var(--gold)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-[var(--ink)]">{item.title}</span>
                    <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-[var(--muted)]">{item.description}</span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Il resto di KUMANI */}
      <section className="rounded-3xl border border-[var(--gold)]/40 bg-gradient-to-br from-[var(--gold-pale)]/70 to-white p-6 sm:p-8">
        <h2 className="text-xl font-extrabold text-[var(--ink)]">{t('moreTitle')}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t('moreIntro')}</p>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { Icon: Crown, text: t('more1') },
            { Icon: Users, text: t('more2') },
            { Icon: HeartHandshake, text: t('more3') },
          ].map(({ Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
              {text}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href="/servizi" className="flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-6 py-3 font-bold text-[var(--gold-bright)]">
            {t('moreServices')} <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/billing" className="flex items-center justify-center rounded-xl border border-[var(--gold)]/50 px-6 py-3 font-semibold text-[var(--ink)] hover:bg-white">
            {t('morePlans')}
          </Link>
        </div>
      </section>

      <div className="text-center">
        <ShowFullDashboardButton />
      </div>
    </div>
  )
}
