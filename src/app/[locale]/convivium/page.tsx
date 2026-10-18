import { redirect } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, CalendarDays, HandCoins, MapPin, Wine } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import HubBar from '@/components/hubs/HubBar'
import ConviviumNewEvening from '@/components/convivium/ConviviumNewEvening'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { createClient } from '@/lib/supabase/server'
import { isToolOnline } from '@/lib/toolOnline'
import { toolMetadata } from '@/lib/toolMetadata'
import { OccasionTile } from '@/components/convivium/OccasionIcon'
import { formatCost, formatWhen, seated, type ConviviumAnswer, type ConviviumEvent } from '@/lib/convivium'

export const dynamic = 'force-dynamic'
export const generateMetadata = toolMetadata('convivium')

// In arrivo (anche se iniziata da meno di 6 ore, dalla più vicina) e passate
function splitByTime<T extends { starts_at: string }>(events: T[]) {
  const limit = Date.now() - 6 * 3_600_000
  return {
    upcoming: events.filter((e) => new Date(e.starts_at).getTime() > limit).reverse(),
    past: events.filter((e) => new Date(e.starts_at).getTime() <= limit),
  }
}

// KUMANI Convivium: le mie serate e il modulo per crearne una nuova
export default async function ConviviumPage() {
  const locale = await getLocale()
  const t = await getTranslations('convivium')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent('/convivium')}`)

  const [online, { data }] = await Promise.all([
    isToolOnline('convivium'),
    supabase.from('convivium_events').select('*, convivium_rsvps(answer)').order('starts_at', { ascending: false }).limit(100),
  ])
  const events = (data ?? []) as (ConviviumEvent & { convivium_rsvps: { answer: ConviviumAnswer }[] })[]
  const { upcoming, past } = splitByTime(events)

  const card = (e: (typeof events)[number]) => {
    const yes = seated(e.convivium_rsvps.filter((r) => r.answer === 'yes').length, e.host_joins)
    const maybe = e.convivium_rsvps.filter((r) => r.answer === 'maybe').length
    return (
      <li key={e.id}>
        <Link href={`/convivium/${e.id}`} className="flex items-center gap-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm transition hover:border-[var(--gold)]/60">
          <OccasionTile occasion={e.occasion} />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 font-extrabold text-[var(--ink)]">
              {e.title}
              {e.cancelled_at && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">{t('cancelledBadge')}</span>}
            </span>
            <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-[var(--muted)]">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {formatWhen(e.starts_at, locale)}
              </span>
              {e.place && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" aria-hidden /> {e.place}
                </span>
              )}
              {e.cost_cents != null && (
                <span className="flex items-center gap-1">
                  <HandCoins className="h-3.5 w-3.5" aria-hidden /> {e.cost_cents === 0 ? t('costOfferedNoName') : t('costPerPerson', { amount: formatCost(e.cost_cents, locale) })}
                </span>
              )}
            </span>
          </span>
          <span className="shrink-0 text-right text-sm">
            <span className="block font-extrabold text-emerald-700">{e.max_guests ? t('seats', { yes, max: e.max_guests }) : t('yesCount', { count: yes })}</span>
            {maybe > 0 && <span className="block text-xs text-[var(--muted)]">{t('maybeCount', { count: maybe })}</span>}
          </span>
        </Link>
      </li>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
          <Link href="/servizi" className="flex shrink-0 items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToServices')}
          </Link>
          <span className="flex min-w-0 items-center gap-2 text-right font-semibold leading-tight">
            <Wine className="h-5 w-5 shrink-0 text-[var(--gold-bright)]" /> {t('title')}
          </span>
        </div>
      </header>
      <HubBar />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--gold)]">{t('brand')}</p>
          <h1 className="mt-1 text-3xl font-bold text-[var(--ink)] sm:text-4xl">{t('slogan')}</h1>
          <p className="mt-3 text-[var(--muted)]">{t('intro')}</p>
          <p className="mt-2 font-semibold text-[var(--gold)]">{t('motto')}</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          {/* Aperta solo se non ci sono ancora serate; poi «Crea una nuova serata» */}
          {online ? (
            <div>
              <ConviviumNewEvening startOpen={events.length === 0} />
            </div>
          ) : (
            <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:p-6">
              <SuspendedBanner />
            </section>
          )}
          <section>
            <h2 className="mb-3 text-xl font-extrabold text-[var(--ink)]">{t('myEvenings')}</h2>
            {events.length === 0 && <p className="rounded-2xl border border-dashed border-[var(--gold)]/40 p-5 text-sm text-[var(--muted)]">{t('empty')}</p>}
            {upcoming.length > 0 && (
              <>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[var(--muted)]">{t('upcoming')}</h3>
                <ul className="mb-6 space-y-3">{upcoming.map(card)}</ul>
              </>
            )}
            {past.length > 0 && (
              <>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-[var(--muted)]">{t('past')}</h3>
                <ul className="space-y-3 opacity-80">{past.map(card)}</ul>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
