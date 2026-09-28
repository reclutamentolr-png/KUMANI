import { useLocale, useTranslations } from 'next-intl'
import { Baby, BadgeCheck, Crown, Repeat, Sprout, Stamp, Star } from 'lucide-react'
import type { EventCard, OrganizerLevel } from '@/lib/events'

// Piccoli elementi condivisi tra calendario e scheda evento.

export function formatEventPrice(price: number, currency: string, locale: string): string {
  const whole = Number.isInteger(price)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(price)
}

// Prezzo: gratis, oppure pagato sul posto direttamente all'organizzatore.
export function PriceBadge({ event, dark = false }: { event: Pick<EventCard, 'price' | 'currency'>; dark?: boolean }) {
  const t = useTranslations('events')
  const locale = useLocale()
  if (!event.price) {
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${dark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700'}`}>
        {t('free')}
      </span>
    )
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${dark ? 'bg-[var(--gold)]/15 text-[var(--gold-bright)]' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
      {t('priceOnSite', { price: formatEventPrice(event.price, event.currency, locale) })}
    </span>
  )
}

export function EventFlags({
  event,
  dark = false,
}: {
  event: Pick<EventCard, 'is_18plus' | 'kids_friendly'> & Partial<Pick<EventCard, 'series_id' | 'fidelity_stamp' | 'fidelity_business'>>
  dark?: boolean
}) {
  const t = useTranslations('events')
  return (
    <>
      {event.is_18plus && (
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${dark ? 'bg-rose-400/15 text-rose-300' : 'bg-rose-50 text-rose-700'}`}>{t('adultsOnly')}</span>
      )}
      {event.kids_friendly && (
        <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${dark ? 'bg-sky-400/15 text-sky-300' : 'bg-sky-50 text-sky-700'}`}>
          <Baby className="h-3.5 w-3.5" /> {t('kidsFriendly')}
        </span>
      )}
      {event.series_id && (
        <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${dark ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-700'}`}>
          <Repeat className="h-3.5 w-3.5" /> {t('recurring')}
        </span>
      )}
      {event.fidelity_stamp && event.fidelity_business && (
        <span
          className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${dark ? 'bg-[var(--gold)]/15 text-[var(--gold-bright)]' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}
        >
          <Stamp className="h-3.5 w-3.5" /> {t('kumiCardStamp')}
        </span>
      )}
    </>
  )
}

export function TrustedBadge({ dark = false }: { dark?: boolean }) {
  const t = useTranslations('events')
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${dark ? 'bg-[var(--gold)]/20 text-[var(--gold-bright)]' : 'bg-[var(--gold-pale)] text-[var(--ink)]'}`}>
      <BadgeCheck className="h-3.5 w-3.5 text-[var(--gold)]" /> {t('trustedOrganizer')}
    </span>
  )
}

// Posti liberi, oppure "Completo · lista d'attesa aperta" finché ci si può
// ancora mettere in coda (closed = iscrizioni chiuse o evento finito).
export function SpotsBadge({ event, dark = false, closed = false }: { event: Pick<EventCard, 'capacity' | 'people'>; dark?: boolean; closed?: boolean }) {
  const t = useTranslations('events')
  const left = Math.max(0, event.capacity - event.people)
  if (left === 0) {
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${dark ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'}`}>
        {closed ? t('full') : t('fullWaitlistOpen')}
      </span>
    )
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${dark ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-700'}`}>
      {t('spotsLeft', { count: left })}
    </span>
  )
}

// Livello dell'organizzatore: Nuovo / Fidato / Super Organizer (oro).
// Il livello "Nuovo" si mostra solo se richiesto (showNew), es. nella scheda.
export function LevelBadge({ level, dark = false, showNew = false }: { level: OrganizerLevel | null | undefined; dark?: boolean; showNew?: boolean }) {
  const t = useTranslations('events')
  if (level === 'super') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-2 py-0.5 text-[11px] font-extrabold text-[var(--ink)] shadow-sm">
        <Crown className="h-3.5 w-3.5" /> {t('levelSuper')}
      </span>
    )
  }
  if (level === 'trusted') return <TrustedBadge dark={dark} />
  if (!showNew) return null
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${dark ? 'bg-white/10 text-white/75' : 'bg-gray-100 text-gray-600'}`}>
      <Sprout className="h-3.5 w-3.5" /> {t('levelNew')}
    </span>
  )
}

// Numero con una cifra decimale nella lingua di chi guarda (4,8).
export function formatRating(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(value)
}

// Cinque stelle (piene fino al voto, arrotondato).
export function Stars({ rating, size = 'h-4 w-4' }: { rating: number; size?: string }) {
  const full = Math.round(rating)
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`${size} ${n <= full ? 'fill-[var(--gold)] text-[var(--gold)]' : 'text-gray-300'}`} />
      ))}
    </span>
  )
}

// Media e numero di recensioni: "★ 4,8 · 12 recensioni". Niente se non ce ne sono.
export function RatingBadge({ rating, reviews, dark = false }: { rating: number | null | undefined; reviews: number | null | undefined; dark?: boolean }) {
  const t = useTranslations('events')
  const locale = useLocale()
  if (!reviews || rating == null) return null
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${dark ? 'text-white/80' : 'text-[var(--ink-soft)]'}`}>
      <Star className="h-3.5 w-3.5 fill-[var(--gold)] text-[var(--gold)]" />
      {t('ratingSummary', { rating: formatRating(Number(rating), locale), count: Number(reviews) })}
    </span>
  )
}
