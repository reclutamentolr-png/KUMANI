'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Check, CircleCheck, Copy, Flag, Hourglass, LoaderCircle, MessageCircle, Settings, Star, Ticket } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import OfferMakerQR from '@/components/OfferMakerQR'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { registerToEvent, reportEvent, reviewEvent, unregisterFromEvent } from '@/app/actions/events'
import { eventPassUrl, formatEventDate, type EventDetail } from '@/lib/events'
import NativeShareButton from '@/components/NativeShareButton'
import { askConfirm } from '@/lib/confirm'

const REGISTER_ERRORS = ['full', 'age', 'started', 'organizer', 'not_available', 'not_logged', 'not_allowed', 'invalid', 'suspended']

const goldButton =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] disabled:opacity-60'

// Azioni della scheda evento: iscrizione (o lista d'attesa), pass con QR,
// recensione dopo l'evento, condivisione, segnalazione.
export default function EventActions({
  event,
  loggedIn,
  sponsor,
  siteUrl,
  myReferral,
  started,
}: {
  event: EventDetail
  loggedIn: boolean
  sponsor: string | null
  siteUrl: string
  myReferral: string | null
  started: boolean
}) {
  const t = useTranslations('events')
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reason, setReason] = useState('')
  // Motivo «mi è stato chiesto un pagamento» (solo per gli eventi gratuiti)
  const [reportKind, setReportKind] = useState<'other' | 'free_paid'>('other')
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  // Appena messo in lista d'attesa (prima che la pagina si aggiorni)
  const [justWaitlisted, setJustWaitlisted] = useState(false)
  // Recensione (precompilata con quella già lasciata, modificabile)
  const [rating, setRating] = useState(event.my_review?.rating ?? 0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState(event.my_review?.comment ?? '')
  const [reviewState, setReviewState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [reviewError, setReviewError] = useState<string | null>(null)

  const dateLabel = formatEventDate(event.starts_at, event.timezone, locale)
  const published = event.status === 'published'
  const full = event.people >= event.capacity
  const registered = !!event.my_pass && (event.my_status === 'registered' || event.my_status === 'checked_in' || event.my_status === 'no_show')
  const waiting = !registered && (event.my_status === 'waitlist' || justWaitlisted)
  const waitlistCount = event.waitlist ?? 0

  // Link condiviso: porta il codice invito di chi condivide (?ref=).
  const shareUrl = `${siteUrl}/events/${event.id}${myReferral ? `?ref=${encodeURIComponent(myReferral)}` : ''}`
  const shareText = t('shareMessage', { title: event.title, date: dateLabel, url: shareUrl })

  const join = async () => {
    setBusy(true)
    setError(null)
    const result = await registerToEvent(event.id)
    setBusy(false)
    if (result.pass) {
      router.refresh()
      return
    }
    if (result.waitlist) {
      setJustWaitlisted(true)
      router.refresh()
      return
    }
    const code = result.error && REGISTER_ERRORS.includes(result.error) ? result.error : 'saveError'
    setError(t(`error_${code}`))
  }

  const leave = async (fromWaitlist = false) => {
    if (!(await askConfirm(t(fromWaitlist ? 'waitlistLeaveConfirm' : 'unregisterConfirm')))) return
    setBusy(true)
    setError(null)
    const result = await unregisterFromEvent(event.id)
    setBusy(false)
    if (result === 'ok') {
      setJustWaitlisted(false)
      router.refresh()
    } else setError(t(result === 'not_allowed' ? 'error_unregisterClosed' : result === 'suspended' ? 'error_suspended' : 'error_saveError'))
  }

  const saveReview = async () => {
    if (rating < 1) {
      setReviewError(t('reviewPickStars'))
      return
    }
    setReviewState('saving')
    setReviewError(null)
    const result = await reviewEvent(event.id, rating, comment)
    if (result === 'ok') {
      setReviewState('saved')
      router.refresh()
      return
    }
    setReviewState('error')
    setReviewError(t(result === 'invalid' ? 'reviewPickStars' : result === 'not_allowed' ? 'reviewNotAllowed' : 'error_saveError'))
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard non disponibile: il link resta visibile da copiare a mano
    }
  }

  const reportReady = reportKind === 'free_paid' || reason.trim().length >= 5
  const sendReport = async () => {
    if (!reportReady) return
    setReportState('sending')
    const result = await reportEvent(event.id, reason.trim(), reportKind)
    setReportState(result === 'ok' ? 'sent' : 'error')
  }

  // --- Non registrato su KUMANI ---
  if (!loggedIn) {
    return (
      <section className="rounded-2xl bg-[var(--ink)] p-5 text-center text-white shadow-sm">
        <p className="text-sm leading-6 text-white/75">{t('guestPitch')}</p>
        {published && !event.ended && (
          <Link href={sponsor ? `/register?sponsor=${encodeURIComponent(sponsor)}` : '/register'} className={`${goldButton} mt-4`}>
            {t('registerToJoin')}
          </Link>
        )}
        <Link href="/login" className="mt-3 block text-sm text-white/70 hover:text-white">
          {t('alreadyMember')}
        </Link>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {/* Organizzatore */}
      {event.is_organizer && (
        <section className="rounded-2xl border border-[var(--gold)]/40 bg-white p-5 shadow-sm">
          <p className="text-sm text-[var(--muted)]">{t('youOrganize')}</p>
          <Link href={`/events/my?event=${event.id}`} className={`${goldButton} mt-3`}>
            <Settings className="h-5 w-5" /> {t('manageEvent')}
          </Link>
        </section>
      )}

      {/* Il mio pass */}
      {!event.is_organizer && registered && event.my_pass && event.status !== 'cancelled' && (
        <section className="rounded-2xl bg-[var(--ink)] p-5 text-white shadow-sm">
          <div className="flex items-center gap-2 text-[var(--gold-bright)]">
            <Ticket className="h-5 w-5" />
            <h2 className="font-bold">{t('yourPass')}</h2>
          </div>
          {event.my_status === 'checked_in' ? (
            <p className="mt-3 flex items-center gap-2 rounded-xl bg-emerald-400/15 px-3 py-2 text-sm font-bold text-emerald-300">
              <CircleCheck className="h-5 w-5" /> {t('checkedIn')}
            </p>
          ) : (
            <p className="mt-1 text-sm text-white/65">{t('passHint')}</p>
          )}
          <div className="mt-4 flex flex-col items-center rounded-2xl bg-white p-4 text-center text-[var(--ink)]">
            <OfferMakerQR
              url={eventPassUrl(siteUrl, event.my_pass)}
              fileName={`kumani-pass-${event.my_pass.slice(-6)}`}
              fgColor="#0b0b0b"
              generatingLabel={t('qrGenerating')}
              downloadLabel={t('qrDownload')}
              accentClassName="bg-[var(--ink)] hover:bg-[var(--ink-soft)]"
            />
            <p className="mt-3 text-xs uppercase tracking-widest text-[var(--muted)]">{t('manualCode')}</p>
            <p className="font-mono text-3xl font-bold tracking-[0.3em]">{event.my_pass.slice(-6)}</p>
            <p className="mt-2 font-semibold">{event.title}</p>
            <p className="text-sm text-[var(--muted)] first-letter:uppercase">{dateLabel}</p>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a
              href={`/api/events/${event.id}/ics`}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/25 px-4 py-3 text-sm font-semibold hover:border-[var(--gold-bright)]"
            >
              <CalendarPlus className="h-4 w-4" /> {t('addToCalendar')}
            </a>
            {!started && event.my_status === 'registered' && (
              <button
                type="button"
                onClick={() => leave()}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-semibold text-white/75 hover:text-white disabled:opacity-60"
              >
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('unregister')}
              </button>
            )}
          </div>
          {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}
        </section>
      )}

      {/* Partecipa */}
      {/* In lista d'attesa */}
      {!event.is_organizer && waiting && published && !event.ended && (
        <section className="rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)]/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 text-[var(--ink)]">
            <Hourglass className="h-5 w-5 text-[var(--gold)]" />
            <h2 className="font-bold">{t('waitlistTitle')}</h2>
          </div>
          {event.my_waitlist_position ? (
            <p className="mt-3 text-2xl font-extrabold text-[var(--ink)]">{t('waitlistPosition', { position: event.my_waitlist_position })}</p>
          ) : (
            <p className="mt-3 text-sm font-semibold text-[var(--ink)]">{t('waitlistJoined')}</p>
          )}
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{t('waitlistHint')}</p>
          {!started && (
            <button
              type="button"
              onClick={() => leave(true)}
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-[var(--ink)] hover:border-[var(--gold)] disabled:opacity-60"
            >
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('waitlistLeave')}
            </button>
          )}
          {error && <p className="mt-3 text-center text-sm font-semibold text-red-700">{error}</p>}
        </section>
      )}

      {/* Partecipa (o mettiti in lista d'attesa se è completo) */}
      {!event.is_organizer && !registered && !waiting && published && !event.ended && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          {started ? (
            <p className="text-center text-sm font-semibold text-[var(--muted)]">{t('registrationClosed')}</p>
          ) : full ? (
            <>
              <p className="mb-3 text-center text-sm font-semibold text-[var(--ink)]">{t('fullWaitlistOpen')}</p>
              <button type="button" onClick={join} disabled={busy} className={goldButton}>
                {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Hourglass className="h-4 w-4" />} {t('waitlistJoin')}
              </button>
              <p className="mt-2 text-center text-xs text-[var(--muted)]">
                {t('waitlistJoinHint')}
                {waitlistCount > 0 && <> {t('waitlistAhead', { count: waitlistCount })}</>}
              </p>
            </>
          ) : (
            <>
              <button type="button" onClick={join} disabled={busy} className={goldButton}>
                {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('join')}
              </button>
              <p className="mt-2 text-center text-xs text-[var(--muted)]">{t('joinHint')}</p>
            </>
          )}
          {error && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-800">{error}</p>}
        </section>
      )}

      {/* Recensione dopo l'evento */}
      {!event.is_organizer && event.can_review && (
        <section className="rounded-2xl border border-[var(--gold)]/40 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-[var(--ink)]">{event.my_review ? t('reviewYours') : t('reviewTitle')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('reviewHint', { name: event.organizer_name })}</p>
          {reviewState === 'saved' ? (
            <div className="mt-4 space-y-3">
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{t('reviewThanks')}</p>
              <button type="button" onClick={() => setReviewState('idle')} className="text-sm font-semibold text-[var(--gold)] underline-offset-2 hover:underline">
                {t('reviewEdit')}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-4 flex justify-center gap-1" role="radiogroup" aria-label={t('reviewStarsLabel')} onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={t('reviewStars', { count: n })}
                    onClick={() => {
                      setRating(n)
                      setReviewError(null)
                    }}
                    onMouseEnter={() => setHover(n)}
                    className="rounded-lg p-1 transition-transform hover:scale-110"
                  >
                    <Star className={`h-9 w-9 ${n <= (hover || rating) ? 'fill-[var(--gold)] text-[var(--gold)]' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder={t('reviewPlaceholder')}
                className="mt-4 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none"
              />
              <p className="text-right text-xs text-[var(--muted)]">{comment.length}/500</p>
              {reviewError && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-800">{reviewError}</p>}
              <button type="button" onClick={saveReview} disabled={reviewState === 'saving'} className={`${goldButton} mt-3`}>
                {reviewState === 'saving' && <LoaderCircle className="h-4 w-4 animate-spin" />} {event.my_review ? t('reviewUpdate') : t('reviewSave')}
              </button>
            </>
          )}
        </section>
      )}

      {/* Condividi e segnala */}
      {published && !event.ended && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-[var(--ink)]">{t('shareTitle')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('shareHint')}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 font-bold text-white"
            >
              <MessageCircle className="h-5 w-5" /> {t('shareWhatsapp')}
            </a>
            <button type="button" onClick={copyLink} className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 py-3 font-semibold text-[var(--ink)]">
              {copied ? <Check className="h-5 w-5 text-emerald-600" /> : <Copy className="h-5 w-5" />} {copied ? t('copied') : t('copyLink')}
            </button>
          </div>
          {/* Menu del telefono: Instagram, Telegram e le altre app */}
          <NativeShareButton url={shareUrl} title={event.title} text={shareText.replace(shareUrl, '').trim()} variant="dark" copyFallback={false} className="mt-2 w-full py-3" />
        </section>
      )}
      {!event.is_organizer && (
        <div className="text-center">
          <button
            type="button"
            onClick={() => {
              setReportOpen(true)
              setReportState('idle')
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--muted)] hover:text-red-600"
          >
            <Flag className="h-4 w-4" /> {t('report')}
          </button>
        </div>
      )}

      {reportOpen && (
        <Sheet title={t('reportTitle')} onClose={() => setReportOpen(false)}>
          {reportState === 'sent' ? (
            <>
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{t('reportSent')}</p>
              <button type="button" onClick={() => setReportOpen(false)} className="mt-4 w-full rounded-xl bg-[var(--ink)] py-3 font-semibold text-white">
                {t('close')}
              </button>
            </>
          ) : (
            <>
              <p className="mb-3 text-sm text-gray-600">{t('reportHint')}</p>
              {!event.price && (
                <div role="radiogroup" aria-label={t('reportTitle')} className="mb-3 space-y-2">
                  {(['free_paid', 'other'] as const).map((kind) => (
                    <label
                      key={kind}
                      className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                        reportKind === kind ? (kind === 'free_paid' ? 'border-red-300 bg-red-50 text-red-800' : 'border-gray-400 bg-gray-50') : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="event-report-kind"
                        className="mt-0.5 h-4 w-4 accent-red-600"
                        checked={reportKind === kind}
                        onChange={() => setReportKind(kind)}
                      />
                      <span className="font-semibold">{kind === 'free_paid' ? t('reportFreePaid') : t('reportOther')}</span>
                    </label>
                  ))}
                </div>
              )}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={5}
                maxLength={1000}
                placeholder={reportKind === 'free_paid' ? t('reportFreePaidPlaceholder') : t('reportPlaceholder')}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none"
              />
              {reportState === 'error' && <p className="mt-2 text-sm font-semibold text-red-600">{t('error_saveError')}</p>}
              <button
                type="button"
                onClick={sendReport}
                disabled={!reportReady || reportState === 'sending'}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-50"
              >
                {reportState === 'sending' && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('reportSend')}
              </button>
            </>
          )}
        </Sheet>
      )}
    </div>
  )
}
