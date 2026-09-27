'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CalendarPlus, Check, CircleCheck, Copy, Flag, LoaderCircle, MessageCircle, Settings, Ticket } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import OfferMakerQR from '@/components/OfferMakerQR'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { registerToEvent, reportEvent, unregisterFromEvent } from '@/app/actions/events'
import { eventPassUrl, formatEventDate, type EventDetail } from '@/lib/events'

const REGISTER_ERRORS = ['full', 'age', 'started', 'organizer', 'not_available', 'not_logged', 'not_allowed', 'invalid']

const goldButton =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] disabled:opacity-60'

// Azioni della scheda evento: iscrizione, pass con QR, condivisione, segnalazione.
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
  const [reportState, setReportState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const dateLabel = formatEventDate(event.starts_at, event.timezone, locale)
  const published = event.status === 'published'
  const full = event.people >= event.capacity
  const registered = !!event.my_pass && (event.my_status === 'registered' || event.my_status === 'checked_in' || event.my_status === 'no_show')

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
    const code = result.error && REGISTER_ERRORS.includes(result.error) ? result.error : 'saveError'
    setError(t(`error_${code}`))
  }

  const leave = async () => {
    if (!confirm(t('unregisterConfirm'))) return
    setBusy(true)
    setError(null)
    const result = await unregisterFromEvent(event.id)
    setBusy(false)
    if (result === 'ok') router.refresh()
    else setError(t(result === 'not_allowed' ? 'error_unregisterClosed' : 'error_saveError'))
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

  const sendReport = async () => {
    if (reason.trim().length < 5) return
    setReportState('sending')
    const result = await reportEvent(event.id, reason.trim())
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
                onClick={leave}
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
      {!event.is_organizer && !registered && published && !event.ended && (
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          {started ? (
            <p className="text-center text-sm font-semibold text-[var(--muted)]">{t('registrationClosed')}</p>
          ) : full ? (
            <p className="text-center text-sm font-semibold text-[var(--muted)]">{t('fullMessage')}</p>
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
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={5}
                maxLength={1000}
                placeholder={t('reportPlaceholder')}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none"
              />
              {reportState === 'error' && <p className="mt-2 text-sm font-semibold text-red-600">{t('error_saveError')}</p>}
              <button
                type="button"
                onClick={sendReport}
                disabled={reason.trim().length < 5 || reportState === 'sending'}
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
