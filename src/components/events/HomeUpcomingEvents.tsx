import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, CalendarHeart, MapPin, Video } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { EVENT_TYPE_EMOJI, formatEventDate } from '@/lib/events'
import { getHomeEvents } from '@/lib/eventsHome'
import { PriceBadge, formatEventPrice } from './EventBadges'

// Fascia "Prossimi eventi" della Home pubblica: le prossime date di KUMANI
// Events (una sola per serie). Senza eventi in programma resta un invito
// compatto a scoprire la sezione.
export default async function HomeUpcomingEvents() {
  const t = await getTranslations('eventsHome')
  const te = await getTranslations('events')
  const locale = await getLocale()
  const events = await getHomeEvents()
  if (events === null) return null

  return (
    <section className="py-10 sm:py-14 border-t border-[var(--gold)]/10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
          <div>
            <span className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[var(--gold-bright)]">
              <CalendarHeart className="w-4 h-4" />
              {t('eyebrow')}
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-white">{t('title')}</h2>
            <p className="mt-1 text-sm sm:text-base text-gray-400">{t('subtitle')}</p>
          </div>
          <Link href="/events" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold-bright)] hover:text-white transition-colors">
            {t('seeAll')}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-white/[0.03] p-5 sm:p-6 text-sm sm:text-base text-gray-300">
            {t('empty')}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => {
              const place = event.mode === 'online' ? te('mode_online') : [event.venue_name, event.city].filter(Boolean).join(' · ')
              return (
                <Link
                  key={event.id}
                  href={`/events/${event.id}`}
                  className="group flex flex-col rounded-2xl border border-[var(--gold)]/25 bg-white/[0.03] p-5 transition-colors hover:border-[var(--gold)]/60 hover:bg-white/[0.06]"
                >
                  <span className="text-xs font-semibold text-[var(--gold-bright)]">
                    {EVENT_TYPE_EMOJI[event.type] ?? '📅'} {te(`type_${event.type}`)}
                  </span>
                  <h3 className="mt-2 text-base sm:text-lg font-bold leading-snug text-white line-clamp-2">{event.title}</h3>
                  <p className="mt-1 text-sm font-medium text-[var(--gold-pale)] first-letter:uppercase">
                    {formatEventDate(event.starts_at, event.timezone, locale)}
                  </p>
                  {place && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-gray-400">
                      {event.mode === 'online' ? <Video className="h-3.5 w-3.5" /> : <MapPin className="h-3.5 w-3.5" />}
                      <span className="truncate">{place}</span>
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs">
                    {event.price ? (
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 font-semibold text-white/80">
                        {te('priceOnSite', { price: formatEventPrice(event.price, event.currency, locale) })}
                      </span>
                    ) : (
                      <PriceBadge event={event} dark />
                    )}
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--gold-bright)] group-hover:text-white">
                      {t('open')} <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
