import { useLocale, useTranslations } from 'next-intl'
import { Baby, BadgeCheck } from 'lucide-react'
import type { EventCard } from '@/lib/events'

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

export function EventFlags({ event, dark = false }: { event: Pick<EventCard, 'is_18plus' | 'kids_friendly'>; dark?: boolean }) {
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

// Posti liberi (o "Completo").
export function SpotsBadge({ event, dark = false }: { event: Pick<EventCard, 'capacity' | 'people'>; dark?: boolean }) {
  const t = useTranslations('events')
  const left = Math.max(0, event.capacity - event.people)
  if (left === 0) {
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${dark ? 'bg-white/10 text-white/70' : 'bg-gray-100 text-gray-600'}`}>{t('full')}</span>
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${dark ? 'bg-white/10 text-white/80' : 'bg-gray-100 text-gray-700'}`}>
      {t('spotsLeft', { count: left })}
    </span>
  )
}
