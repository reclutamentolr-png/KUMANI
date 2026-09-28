import { cache } from 'react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowLeft, Ban, CalendarDays, CalendarHeart, ChevronRight, Clock, Euro, Hourglass, Languages, Lock, MapPin, MessageSquareQuote, Repeat, ShieldCheck, Stamp, TriangleAlert, UserRound, Users, Video } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import EventActions from '@/components/events/EventActions'
import { EventFlags, LevelBadge, PriceBadge, RatingBadge, SpotsBadge, Stars, formatEventPrice, formatRating } from '@/components/events/EventBadges'
import ViewerTime from '@/components/events/ViewerTime'
import { getEvent } from '@/app/actions/events'
import { EVENT_TYPE_EMOJI, countryName, formatEventDate, languageName, stampKey, utcToZoned } from '@/lib/events'
import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

type Props = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ ref?: string }>
}

// Una sola lettura per richiesta (metadati + pagina)
const loadEvent = cache(getEvent)

// Istante già passato? (fuori dal componente: il render resta puro)
function hasStarted(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now()
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const event = await loadEvent(id)
  if (!event) return { title: 'KUMANI Events' }
  return { title: `${event.title} · KUMANI Events`, description: event.description.slice(0, 160) }
}

// Scheda di un evento: pubblica. Indirizzo esatto e link online arrivano
// dal database solo a iscritti e organizzatore.
export default async function EventPage({ params, searchParams }: Props) {
  const { id } = await params
  const { ref } = await searchParams
  const t = await getTranslations('events')
  const locale = await getLocale()
  const supabase = await createClient()
  const [
    event,
    {
      data: { user },
    },
  ] = await Promise.all([loadEvent(id), supabase.auth.getUser()])
  if (!event) notFound()
  const online = await isToolOnline('events')

  let myReferral: string | null = null
  if (user) {
    const { data: me } = await supabase.from('profiles').select('referral_code').eq('id', user.id).maybeSingle()
    myReferral = me?.referral_code ?? null
  }

  // Sponsor per la registrazione: chi ha condiviso il link, altrimenti l'organizzatore.
  const refCode = typeof ref === 'string' ? ref.trim().toUpperCase() : ''
  const sponsor = /^[A-Z0-9-]{3,32}$/.test(refCode) ? refCode : event.organizer_referral

  const started = hasStarted(event.starts_at)
  const start = utcToZoned(event.starts_at, event.timezone)
  const end = event.ends_at ? utcToZoned(event.ends_at, event.timezone) : null
  const endLabel =
    event.ends_at && end
      ? end.date === start.date
        ? end.time
        : formatEventDate(event.ends_at, event.timezone, locale)
      : null
  const place = [event.city, countryName(event.country_code, locale)].filter(Boolean).join(', ')
  const showsPlace = event.mode !== 'online'
  const showsOnline = event.mode !== 'in_person'
  const level = event.organizer_level ?? (event.organizer_trusted ? 'trusted' : 'new')
  const reviews = event.reviews ?? []
  const reviewsCount = Number(event.organizer_reviews ?? 0)
  const full = event.people >= event.capacity
  const waitlistCount = Number(event.waitlist ?? 0)
  const reviewDate = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))
  const seriesDates = event.series ?? []
  const unlocked = !!event.address || !!event.map_link || !!event.online_link || event.is_organizer || !!event.my_pass

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link href="/events" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('allEvents')}
          </Link>
          <div className="flex items-center gap-2">
            <CalendarHeart className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">KUMANI Events</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6 sm:py-8">
        {!online && <SuspendedBanner />}
        {/* Stato */}
        {event.status === 'pending' && event.is_organizer && (
          <Banner tone="amber" icon={<Hourglass className="h-5 w-5 shrink-0" />} title={t('statusPendingTitle')} text={t('statusPendingText')} />
        )}
        {event.status === 'rejected' && event.is_organizer && (
          <Banner
            tone="red"
            icon={<TriangleAlert className="h-5 w-5 shrink-0" />}
            title={t('statusRejectedTitle')}
            text={event.review_note ? t('statusRejectedNote', { note: event.review_note }) : t('statusRejectedText')}
          />
        )}
        {event.status === 'cancelled' && <Banner tone="red" icon={<Ban className="h-5 w-5 shrink-0" />} title={t('statusCancelledTitle')} text={t('statusCancelledText')} />}
        {event.status === 'banned' && <Banner tone="red" icon={<Ban className="h-5 w-5 shrink-0" />} title={t('statusBannedTitle')} text={t('statusBannedText')} />}
        {event.ended && event.status === 'published' && <Banner tone="gray" icon={<CalendarDays className="h-5 w-5 shrink-0" />} title={t('ended')} text={t('endedText')} />}

        {/* Intestazione */}
        <section className="rounded-2xl bg-[var(--ink)] p-5 text-white shadow-sm sm:p-7">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)]">
            <span className="text-2xl">{EVENT_TYPE_EMOJI[event.type] ?? '📅'}</span>
            {t(`type_${event.type}`)}
          </div>
          <h1 className="mt-2 text-2xl font-bold leading-tight sm:text-4xl">{event.title}</h1>
          <p className="mt-2 text-lg font-medium text-[var(--gold-pale)] first-letter:uppercase">{formatEventDate(event.starts_at, event.timezone, locale)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/70">
            <span>{t('organizedBy', { name: event.organizer_name })}</span>
            <LevelBadge level={level} dark />
            <RatingBadge rating={event.organizer_rating} reviews={event.organizer_reviews} dark />
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <PriceBadge event={event} dark />
            <SpotsBadge event={event} dark closed={started || event.ended} />
            <EventFlags event={event} dark />
          </div>
        </section>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="space-y-5">
            {/* Informazioni */}
            <section className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white shadow-sm">
              <InfoRow icon={<Clock className="h-5 w-5" />} label={t('when')}>
                <p className="font-semibold text-[var(--ink)] first-letter:uppercase">{formatEventDate(event.starts_at, event.timezone, locale)}</p>
                {endLabel && <p className="text-sm text-[var(--muted)]">{t('endsAt', { time: endLabel })}</p>}
                <p className="text-xs text-[var(--muted)]">{t('localTime', { zone: event.timezone.replace(/_/g, ' ') })}</p>
                <ViewerTime iso={event.starts_at} timeZone={event.timezone} className="mt-1 text-xs font-semibold text-[var(--ink-soft)]" />
              </InfoRow>

              <InfoRow icon={event.mode === 'online' ? <Video className="h-5 w-5" /> : <MapPin className="h-5 w-5" />} label={t('where')}>
                <p className="font-semibold text-[var(--ink)]">{t(`mode_${event.mode}`)}</p>
                {showsPlace && (event.venue_name || place) && (
                  <p className="text-sm text-[var(--ink-soft)]">{[event.venue_name, place].filter(Boolean).join(' · ')}</p>
                )}
                {showsPlace && event.address && <p className="text-sm text-[var(--ink-soft)]">{event.address}</p>}
                <div className="mt-1 flex flex-wrap gap-3 text-sm">
                  {showsPlace && event.map_link && /^https?:\/\//i.test(event.map_link) && (
                    <a href={event.map_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--gold)] underline-offset-2 hover:underline">
                      {t('openMap')}
                    </a>
                  )}
                  {showsOnline && event.online_link && /^https?:\/\//i.test(event.online_link) && (
                    <a href={event.online_link} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--gold)] underline-offset-2 hover:underline">
                      {t('openOnlineLink')}
                    </a>
                  )}
                </div>
                {!unlocked && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-[var(--gold-pale)]/60 px-3 py-2 text-xs text-[var(--ink)]">
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {t('addressAfterJoin')}
                  </p>
                )}
              </InfoRow>

              {(event.languages ?? []).length > 0 && (
                <InfoRow icon={<Languages className="h-5 w-5" />} label={t('languagesSpoken')}>
                  <div className="flex flex-wrap gap-1.5">
                    {event.languages.map((code) => (
                      <span key={code} className="rounded-md bg-gray-100 px-2 py-0.5 text-sm font-medium text-gray-700">
                        {languageName(code, locale)}
                      </span>
                    ))}
                  </div>
                </InfoRow>
              )}

              <InfoRow icon={<Users className="h-5 w-5" />} label={t('places')}>
                <p className="font-semibold text-[var(--ink)]">{t('peopleOfCapacity', { people: event.people, capacity: event.capacity })}</p>
                <p className="text-sm text-[var(--muted)]">
                  {full ? (started || event.ended ? t('full') : t('fullWaitlistOpen')) : t('spotsLeft', { count: event.capacity - event.people })}
                </p>
                {full && waitlistCount > 0 && !event.ended && (
                  <p className="text-sm font-semibold text-[var(--ink-soft)]">{t('waitlistInfo', { count: waitlistCount })}</p>
                )}
              </InfoRow>

              <InfoRow icon={<Euro className="h-5 w-5" />} label={t('price')}>
                <p className="font-semibold text-[var(--ink)]">
                  {event.price ? t('pricePerPerson', { price: formatEventPrice(event.price, event.currency, locale) }) : t('free')}
                </p>
                {event.price > 0 && <p className="text-sm text-[var(--muted)]">{t('priceNote')}</p>}
              </InfoRow>
            </section>

            {/* Descrizione */}
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="mb-2 font-bold text-[var(--ink)]">{t('aboutEvent')}</h2>
              <p className="whitespace-pre-line break-words text-sm leading-6 text-[var(--ink-soft)]">{event.description}</p>
            </section>

            {/* Altre date della stessa serie */}
            {seriesDates.length > 0 && (
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-bold text-[var(--ink)]">
                  <Repeat className="h-5 w-5 text-[var(--gold)]" /> {t('seriesTitle')}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{t('seriesSubtitle')}</p>
                <ul className="mt-3 divide-y divide-gray-100">
                  {seriesDates.map((date) => (
                    <li key={date.id}>
                      <Link href={`/events/${date.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-[var(--gold)]">
                        <span className="text-sm font-semibold text-[var(--ink)] first-letter:uppercase">{formatEventDate(date.starts_at, event.timezone, locale)}</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-[var(--muted)]">
                          {date.status !== 'published'
                            ? t(`seriesStatus_${date.status}`)
                            : date.people >= date.capacity
                              ? t('full')
                              : t('spotsLeft', { count: date.capacity - date.people })}
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Organizzatore: livello e reputazione */}
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
              <h2 className="mb-3 font-bold text-[var(--ink)]">{t('organizerBoxTitle')}</h2>
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${
                    level === 'super' ? 'bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]' : 'bg-[var(--ink)] text-[var(--gold-bright)]'
                  }`}
                >
                  <UserRound className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-bold text-[var(--ink)]">{event.organizer_name}</p>
                    <LevelBadge level={level} showNew />
                  </div>
                  {reviewsCount > 0 && event.organizer_rating != null ? (
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-[var(--ink-soft)]">
                      <Stars rating={Number(event.organizer_rating)} />
                      <span className="font-semibold">{t('ratingSummary', { rating: formatRating(Number(event.organizer_rating), locale), count: reviewsCount })}</span>
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--muted)]">{t('noReviewsYet')}</p>
                  )}
                  <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{t(`level_${level}_text`)}</p>
                </div>
              </div>
            </section>

            {/* Recensioni dei partecipanti */}
            {reviews.length > 0 && (
              <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-bold text-[var(--ink)]">
                  <MessageSquareQuote className="h-5 w-5 text-[var(--gold)]" /> {t('reviewsTitle')}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{t('reviewsSubtitle', { name: event.organizer_name })}</p>
                <ul className="mt-3 divide-y divide-gray-100">
                  {reviews.map((review, index) => (
                    <li key={`${review.created_at}-${index}`} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Stars rating={review.rating} size="h-3.5 w-3.5" />
                        <span className="text-xs text-[var(--muted)]">{reviewDate(review.created_at)}</span>
                      </div>
                      {review.comment && <p className="mt-1.5 whitespace-pre-line break-words text-sm text-[var(--ink-soft)]">{review.comment}</p>}
                      <p className="mt-1 text-xs text-[var(--muted)]">{t('reviewBy', { name: review.name, event: review.event_title })}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          <div className="space-y-5">
            {(event.status === 'published' || event.is_organizer) && (
              <EventActions event={event} loggedIn={!!user} sponsor={sponsor} siteUrl={SITE_URL} myReferral={myReferral} started={started} />
            )}

            {/* Timbro Kumi Card per chi entra */}
            {event.fidelity_stamp && event.fidelity_business && (
              <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
                <h2 className="flex items-center gap-2 font-bold text-[var(--ink)]">
                  <Stamp className="h-5 w-5 text-[var(--gold)]" /> {t('kumiCardTitle')}
                </h2>
                <p className="mt-2 text-sm text-[var(--ink-soft)]">{t('kumiCardText', { business: event.fidelity_business })}</p>
                {event.my_stamp_status && (
                  <p className="mt-2 text-sm font-semibold text-[var(--ink)]">{t(stampKey(event.my_stamp_status))}</p>
                )}
                {event.my_card_token && (
                  <Link
                    href={`/f/${event.my_card_token}`}
                    className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--ink-soft)]"
                  >
                    <Stamp className="h-4 w-4 text-[var(--gold-bright)]" /> {t('kumiCardOpen')}
                  </Link>
                )}
              </section>
            )}

            {/* Codice di condotta */}
            <section className="rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 p-5">
              <h2 className="flex items-center gap-2 font-bold text-[var(--ink)]">
                <ShieldCheck className="h-5 w-5 text-[var(--gold)]" /> {t('rulesTitle')}
              </h2>
              <ul className="mt-3 space-y-2 text-sm text-[var(--ink-soft)]">
                {(['rulesRespect', 'rulesNoHarassment', 'rulesAdults', 'rulesReport'] as const).map((key) => (
                  <li key={key} className="flex gap-2">
                    <span className="text-[var(--gold)]">•</span> <span>{t(key)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-[var(--muted)]">{t('paymentDisclaimer')}</p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 p-4">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--gold-pale)] text-[var(--ink)]">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{label}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  )
}

function Banner({ tone, icon, title, text }: { tone: 'amber' | 'red' | 'gray'; icon: React.ReactNode; title: string; text: string }) {
  const styles = {
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    red: 'border-red-200 bg-red-50 text-red-900',
    gray: 'border-gray-200 bg-gray-50 text-gray-800',
  }[tone]
  return (
    <div className={`flex gap-3 rounded-2xl border p-4 ${styles}`}>
      {icon}
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-0.5 whitespace-pre-line text-sm">{text}</p>
      </div>
    </div>
  )
}
