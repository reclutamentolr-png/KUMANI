'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { AlertTriangle, BadgeCheck, CalendarDays, CheckCircle2, CreditCard, ExternalLink, Hourglass, LoaderCircle, MapPin, Pencil, Plus, QrCode, Repeat, ShieldCheck, Stamp, Ticket, UserCheck, Users, XCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import VerificationSetup from '@/components/verification/VerificationSetup'
import { cancelEvent, getEvent, type EventFormInput } from '@/app/actions/events'
import { EVENT_TYPE_EMOJI, MIN_FEE_PAYMENT, formatEventDate, type EventFee, type EventPassItem, type OrganizedEvent, type OrganizerStatus } from '@/lib/events'
import EventForm from './EventForm'
import type { BusinessProfile } from '@/lib/businessProfile'
import EventAttendees from './EventAttendees'
import OrganizerReputation from './OrganizerReputation'
import { LevelBadge } from './EventBadges'
import { askConfirm } from '@/lib/confirm'

type Notice = 'paid' | 'pending' | 'canceled' | 'error' | 'none' | null
type SheetState =
  | { kind: 'setup' }
  | { kind: 'create' }
  | { kind: 'edit'; event: OrganizedEvent; initial: Partial<Pick<EventFormInput, 'address' | 'mapLink' | 'onlineLink'>> }
  | { kind: 'attendees'; event: OrganizedEvent }
  | { kind: 'saved'; id: string; status: string; edited: boolean; dates?: number }
  | null

// Area personale di KUMANI Events: stato di organizzatore (verifica, piano,
// fidato), commissioni da pagare, i miei eventi con check-in e i miei pass.
// Evento già iniziato: non si annulla più (fuori dal componente: render puro)
function hasStarted(iso: string): boolean {
  return new Date(iso).getTime() <= Date.now()
}

export default function OrganizerHome({
  status,
  organized,
  passes,
  fees,
  notice,
  openEventId,
  businessProfile = null,
}: {
  status: OrganizerStatus | null
  organized: OrganizedEvent[]
  passes: EventPassItem[]
  fees: EventFee[]
  notice: Notice
  openEventId: string | null
  businessProfile?: BusinessProfile | null
}) {
  const t = useTranslations('eventsOrganizer')
  const locale = useLocale()
  const router = useRouter()
  const [sheet, setSheet] = useState<SheetState>(() => {
    const event = openEventId ? organized.find((e) => e.id === openEventId) : undefined
    return event ? { kind: 'attendees', event } : null
  })
  const [working, setWorking] = useState<string | null>(null)
  const [showNotice, setShowNotice] = useState(notice !== null)

  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value)
  const percent = status?.fee_percent ?? 0
  const freeFee = Number(status?.free_fee_eur ?? 0)
  // Posti massimi secondo il livello (20 / 100 / 300)
  const maxCapacity = status?.max_capacity ?? (status?.trusted ? 100 : 20)
  const dueTotal = Math.round(fees.filter((f) => f.status === 'due').reduce((sum, f) => sum + Number(f.amount), 0) * 100) / 100
  const feesBlock = dueTotal >= MIN_FEE_PAYMENT
  const canCreate = !!status?.verified && !!status?.plan && !status?.blocked && !feesBlock

  const openEdit = async (event: OrganizedEvent) => {
    setWorking(event.id)
    const detail = await getEvent(event.id)
    setWorking(null)
    // Senza i dati privati (indirizzo, link) il salvataggio li cancellerebbe
    if (!detail) {
      alert(t('error_saveError'))
      return
    }
    setSheet({
      kind: 'edit',
      event,
      initial: { address: detail.address ?? '', mapLink: detail.map_link ?? '', onlineLink: detail.online_link ?? '' },
    })
  }

  const doCancel = async (event: OrganizedEvent) => {
    if (!(await askConfirm(t('cancelConfirm', { title: event.title })))) return
    // Date ripetute: si può annullare anche il resto della serie
    const following = !!event.series_id && (await askConfirm(t('cancelSeriesConfirm')))
    setWorking(event.id)
    const result = await cancelEvent(event.id, following)
    setWorking(null)
    if (result !== 'ok') alert(t.has(`error_${result}`) ? t(`error_${result}`) : t('error_saveError'))
    router.refresh()
  }

  const statusBadge = (event: OrganizedEvent) => {
    const key = event.status === 'published' && event.ended ? 'ended' : event.status
    const colors: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      published: 'bg-emerald-100 text-emerald-700',
      rejected: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-600',
      banned: 'bg-red-600 text-white',
      ended: 'bg-gray-100 text-gray-600',
    }
    return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[key] ?? colors.ended}`}>{t(`status_${key}`)}</span>
  }

  const noticeText: Record<Exclude<Notice, null>, { text: string; tone: string }> = {
    paid: { text: t('notice_paid'), tone: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
    pending: { text: t('notice_pending'), tone: 'border-amber-200 bg-amber-50 text-amber-800' },
    canceled: { text: t('notice_canceled'), tone: 'border-gray-200 bg-white text-gray-700' },
    error: { text: t('notice_error'), tone: 'border-red-200 bg-red-50 text-red-700' },
    none: { text: t('notice_none'), tone: 'border-gray-200 bg-white text-gray-700' },
  }

  return (
    <div className="space-y-10">
      {showNotice && notice && (
        <div className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${noticeText[notice].tone}`}>
          <span>{noticeText[notice].text}</span>
          <button type="button" onClick={() => setShowNotice(false)} className="text-xs underline">
            {t('close')}
          </button>
        </div>
      )}

      {/* Stato organizzatore */}
      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <h2 className="flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
              <ShieldCheck className="h-5 w-5 text-[var(--gold)]" /> {t('organizerTitle')}
            </h2>
            {!status ? (
              <p className="text-sm text-red-700">{t('statusError')}</p>
            ) : status.blocked ? (
              <p className="text-sm font-semibold text-red-700">{t('blocked')}</p>
            ) : !status.verified ? (
              <>
                <p className="text-sm text-gray-600">{t('notVerifiedText')}</p>
                <button
                  type="button"
                  onClick={() => setSheet({ kind: 'setup' })}
                  className="mt-1 inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white"
                >
                  <BadgeCheck className="h-4 w-4" /> {t('becomeOrganizer')}
                </button>
              </>
            ) : (
              <>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> {t('verified')}
                </p>
                {!status.plan && (
                  <p className="text-sm text-gray-700">
                    {t('planRequired')}{' '}
                    <Link href={{ pathname: '/billing' }} className="font-semibold text-[var(--gold)] underline">
                      {t('planCta')}
                    </Link>
                  </p>
                )}
                {status.trusted ? (
                  <LevelBadge level={status.level ?? 'trusted'} />
                ) : (
                  <p className="text-sm text-gray-600">{t('newOrganizerNote')}</p>
                )}
              </>
            )}
            {status && (
              <p className="text-xs leading-5 text-[var(--muted)]">
                {t('feeNotice', { percent })} {freeFee > 0 ? t('freeFeeNotice', { fee: money(freeFee) }) : t('freeNoFeeShort')}
              </p>
            )}
          </div>
          {status?.verified && status.plan && (
            <div className="flex flex-col items-stretch gap-1 sm:items-end">
              <button
                type="button"
                disabled={!canCreate}
                onClick={() => setSheet({ kind: 'create' })}
                className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 font-bold text-[var(--ink)] shadow-sm hover:brightness-105 disabled:opacity-50"
              >
                <Plus className="h-5 w-5" /> {t('newEvent')}
              </button>
              {feesBlock && <p className="max-w-xs text-xs font-semibold text-red-700">{t('newEventBlockedFees')}</p>}
            </div>
          )}
        </div>
      </section>

      {/* Reputazione e livello */}
      {status?.verified && !status.blocked && <OrganizerReputation status={status} />}

      {/* Commissioni */}
      {fees.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
            <CreditCard className="h-5 w-5 text-[var(--gold)]" /> {t('feesTitle')}
          </h2>
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
            <ul className="divide-y divide-gray-100">
              {fees.map((fee) => (
                <li key={fee.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--ink)]">{fee.title}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {Number(fee.price) > 0
                        ? t('feeFormula', { participants: fee.participants, price: money(Number(fee.price)), percent: Number(fee.percent) })
                        : t('feeFormulaFree', { participants: fee.participants, fee: money(fee.participants > 0 ? Number(fee.amount) / fee.participants : 0) })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--ink)]">{money(Number(fee.amount))}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        fee.status === 'due' ? 'bg-amber-100 text-amber-800' : fee.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t(`fee_${fee.status}`)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {feesBlock ? (
              <form method="POST" action={`/api/events/fee-checkout?locale=${locale}`} className="mt-4">
                <button type="submit" className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-white sm:w-auto">
                  <CreditCard className="h-4 w-4" /> {t('payFees', { amount: money(dueTotal) })}
                </button>
                <p className="mt-2 text-xs text-[var(--muted)]">{t('payFeesHint')}</p>
              </form>
            ) : dueTotal > 0 ? (
              <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{t('feesBelowMinimum', { amount: money(dueTotal), min: money(MIN_FEE_PAYMENT) })}</p>
            ) : null}
          </div>
        </section>
      )}

      {/* I miei eventi */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
          <CalendarDays className="h-5 w-5 text-[var(--gold)]" /> {t('myEventsTitle')}
        </h2>
        {organized.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white/70 p-8 text-center text-sm text-[var(--muted)]">{t('myEventsEmpty')}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {organized.map((event) => {
              const active = (event.status === 'pending' || event.status === 'published') && !event.ended
              const editable = (active || event.status === 'rejected') && !event.ended
              return (
                <div key={event.id} className="flex flex-col rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <p className="font-bold text-[var(--ink)]">
                      {EVENT_TYPE_EMOJI[event.type]} {event.title}
                    </p>
                    {statusBadge(event)}
                  </div>
                  <p className="text-sm capitalize text-gray-700">{formatEventDate(event.starts_at, event.timezone, locale)}</p>
                  {event.city && (
                    <p className="flex items-center gap-1 text-xs text-[var(--muted)]">
                      <MapPin className="h-3.5 w-3.5" /> {event.city}
                    </p>
                  )}
                  {(event.series_id || event.fidelity_stamp) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {event.series_id && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">
                          <Repeat className="h-3 w-3" /> {t('seriesBadge')}
                        </span>
                      )}
                      {event.fidelity_stamp && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gold-pale)] px-2 py-0.5 text-[11px] font-semibold text-[var(--ink)]">
                          <Stamp className="h-3 w-3 text-[var(--gold)]" /> {t('fidelityBadge')}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-[var(--gold)]" /> {event.people}/{event.capacity}
                    </span>
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-3.5 w-3.5 text-emerald-600" /> {t('checkedInShort', { count: event.checked_in })}
                    </span>
                    <span>{event.price > 0 ? money(Number(event.price)) : t('free')}</span>
                  </div>
                  {event.status === 'rejected' && event.review_note && (
                    <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                      {t('reviewNote')}: {event.review_note}
                    </p>
                  )}
                  {event.status === 'banned' && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{event.review_note || t('bannedNote')}</p>}
                  {event.status === 'pending' && <p className="mt-2 text-xs text-amber-700">{t('pendingNote')}</p>}
                  {event.fee && (
                    <p className="mt-2 text-xs text-gray-600">
                      {t('eventFee', { amount: money(Number(event.fee.amount)) })} · {t(`fee_${event.fee.status}`)}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2 pt-3">
                    <Link
                      href={`/events/${event.id}`}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> {t('view')}
                    </Link>
                    {editable && (
                      <button
                        type="button"
                        disabled={working === event.id}
                        onClick={() => openEdit(event)}
                        className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {working === event.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />} {t('edit')}
                      </button>
                    )}
                    {(event.status === 'published' || event.people > 0) && (
                      <button
                        type="button"
                        onClick={() => setSheet({ kind: 'attendees', event })}
                        className="flex items-center gap-1 rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-xs font-semibold text-white"
                      >
                        <QrCode className="h-3.5 w-3.5" /> {t('attendeesCta')}
                      </button>
                    )}
                    {active && !hasStarted(event.starts_at) && (
                      <button
                        type="button"
                        disabled={working === event.id}
                        onClick={() => doCancel(event)}
                        className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> {t('cancel')}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* I miei pass */}
      <section id="passes" className="scroll-mt-24">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-[var(--ink)]">
          <Ticket className="h-5 w-5 text-[var(--gold)]" /> {t('passesTitle')}
        </h2>
        {passes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white/70 p-8 text-center text-sm text-[var(--muted)]">
            {t('passesEmpty')}{' '}
            <Link href="/events" className="font-semibold text-[var(--gold)] underline">
              {t('browseEvents')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {passes.map((pass) => (
              <Link
                key={pass.id}
                href={`/events/${pass.id}`}
                className="flex flex-col rounded-2xl border border-[var(--gold)]/25 bg-white p-4 shadow-sm transition hover:border-[var(--gold)]"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="font-bold text-[var(--ink)]">
                    {EVENT_TYPE_EMOJI[pass.type]} {pass.title}
                  </p>
                  <span
                    className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      pass.status === 'cancelled'
                        ? 'bg-red-100 text-red-700'
                        : pass.my_status === 'checked_in'
                          ? 'bg-emerald-100 text-emerald-700'
                          : pass.my_status === 'waitlist'
                            ? 'border border-dashed border-[var(--gold)] bg-white text-[var(--ink)]'
                            : 'bg-[var(--gold-pale)] text-[var(--ink)]'
                    }`}
                  >
                    {pass.my_status === 'waitlist' && pass.status !== 'cancelled' && <Hourglass className="h-3 w-3" />}
                    {pass.status === 'cancelled' ? t('status_cancelled') : t(`pass_${pass.my_status}`)}
                  </span>
                </div>
                <p className="text-sm capitalize text-gray-700">{formatEventDate(pass.starts_at, pass.timezone, locale)}</p>
                {pass.city && <p className="text-xs text-[var(--muted)]">{pass.city}</p>}
                {pass.pass ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--gold)]">
                    <QrCode className="h-4 w-4" /> {t('showPass')}
                  </p>
                ) : (
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
                    <ExternalLink className="h-4 w-4" /> {t('waitlistPassNote')}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Finestre */}
      {sheet?.kind === 'setup' && status && (
        <VerificationSetup
          kind="events"
          status={status}
          title={t('setupTitle')}
          intro={t('setupIntro')}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null)
            router.refresh()
          }}
        />
      )}
      {(sheet?.kind === 'create' || sheet?.kind === 'edit') && (
        <Sheet title={sheet.kind === 'edit' ? t('editTitle') : t('newEvent')} onClose={() => setSheet(null)}>
          <EventForm
            event={sheet.kind === 'edit' ? sheet.event : null}
            initial={sheet.kind === 'edit' ? sheet.initial : undefined}
            maxCapacity={maxCapacity}
            feePercent={percent}
            freeFee={sheet.kind === 'edit' && sheet.event.people > 0 ? Number(sheet.event.free_fee_eur ?? 0) : freeFee}
            fidelityCard={status?.fidelity_card ?? null}
            businessProfile={businessProfile}
            onSaved={(result) => {
              setSheet({ kind: 'saved', id: result.id, status: result.status, edited: sheet.kind === 'edit', dates: result.dates })
              router.refresh()
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === 'saved' && (
        <Sheet title={sheet.edited ? t('savedTitle') : t('createdTitle')} onClose={() => setSheet(null)}>
          <div className="space-y-4 text-center">
            {sheet.status === 'published' ? (
              <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" />
            ) : (
              <AlertTriangle className="mx-auto h-14 w-14 text-amber-500" />
            )}
            <p className="text-sm text-gray-700">{sheet.status === 'published' ? t('resultPublished') : t('resultPending')}</p>
            {(sheet.dates ?? 1) > 1 && <p className="text-sm font-semibold text-[var(--ink)]">{t('resultSeries', { count: sheet.dates ?? 1 })}</p>}
            <Link
              href={`/events/${sheet.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-white"
            >
              <ExternalLink className="h-4 w-4" /> {t('view')}
            </Link>
          </div>
        </Sheet>
      )}
      {sheet?.kind === 'attendees' && (
        <Sheet title={t('attendeesSheetTitle', { title: sheet.event.title })} onClose={() => setSheet(null)}>
          <EventAttendees event={sheet.event} />
        </Sheet>
      )}
    </div>
  )
}
