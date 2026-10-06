'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckSquare, LoaderCircle, Lock, Plus, Ticket, Users } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { createTrip, joinTrip } from '@/app/actions/travel'
import { formatTripDates, tripPhase, type TripSummary } from '@/lib/travel'
import TravelTripForm from './TravelTripForm'

// I miei viaggi: prossimi in alto, "Nuovo viaggio" (con il piano) ed
// "Entra con un codice" (per tutti, anche senza abbonamento).
export default function TravelHome({
  trips,
  canCreate,
  today,
  prefill = null,
}: {
  trips: TripSummary[]
  canCreate: boolean
  today: string
  // Viaggio nuovo già compilato da un altro servizio (es. un evento)
  prefill?: { title: string; destination: string; startsOn: string; endsOn: string } | null
}) {
  const t = useTranslations('travel')
  const locale = useLocale()
  const router = useRouter()
  const [creating, setCreating] = useState(!!prefill && canCreate)
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const tripPath = (id: string) => `${locale === 'it' ? '' : `/${locale}`}/viaggi/${id}`

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setJoining(true)
    setJoinError(null)
    const result = await joinTrip(code)
    setJoining(false)
    if (result.success && result.id) router.push(tripPath(result.id))
    else setJoinError(t(`error_${result.success ? 'saveError' : result.error}`))
  }

  const upcoming = trips.filter((trip) => tripPhase(trip, today).phase !== 'ended')
  const past = trips.filter((trip) => tripPhase(trip, today).phase === 'ended')

  const phaseLabel = (trip: TripSummary) => {
    const phase = tripPhase(trip, today)
    if (phase.phase === 'upcoming') return phase.days === 0 ? t('departsToday') : t('departsIn', { count: phase.days })
    if (phase.phase === 'ongoing') return t('ongoingDay', { day: phase.day, total: phase.total })
    if (phase.phase === 'ended') return t('ended')
    return t('noDates')
  }

  const card = (trip: TripSummary) => {
    const dates = formatTripDates(trip, locale)
    const phase = tripPhase(trip, today)
    return (
      <Link
        key={trip.id}
        href={`/viaggi/${trip.id}`}
        className={`group flex flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-[var(--gold)]/60 hover:shadow-md ${phase.phase === 'ended' ? 'border-gray-200 opacity-75' : 'border-[var(--gold)]/30'}`}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ink)] text-2xl">{trip.emoji}</span>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
              phase.phase === 'ongoing' ? 'bg-emerald-100 text-emerald-700' : phase.phase === 'upcoming' ? 'bg-[var(--gold-pale)] text-[var(--ink)]' : 'bg-gray-100 text-gray-500'
            }`}
          >
            {phaseLabel(trip)}
          </span>
        </div>
        <h3 className="text-lg font-bold text-[var(--ink)] group-hover:text-[var(--gold)]">{trip.title}</h3>
        <p className="text-sm text-[var(--muted)]">{[trip.destination, dates].filter(Boolean).join(' · ') || t('noDates')}</p>
        {!trip.is_owner && <p className="mt-1 text-xs font-semibold text-[var(--gold)]">{t('organizedBy', { name: trip.organizer_name })}</p>}
        <div className="mt-4 flex items-center gap-4 text-xs font-semibold text-[var(--muted)]">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" /> {t('membersCount', { count: trip.members })}
          </span>
          {trip.checklist_total > 0 && (
            <span className="flex items-center gap-1">
              <CheckSquare className="h-4 w-4" /> {trip.checklist_done}/{trip.checklist_total}
            </span>
          )}
          {trip.is_owner && <span className="ml-auto rounded bg-[var(--ink)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--gold-bright)]">{t('organizer')}</span>}
        </div>
      </Link>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <form onSubmit={join} className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            <Ticket className="h-4 w-4 text-[var(--gold)]" /> {t('joinWithCode')}
          </label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={12}
              placeholder="K7Q2M9"
              className="w-full rounded-xl border border-gray-300 px-3 py-2.5 font-mono uppercase tracking-widest focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30"
            />
            <button type="submit" disabled={joining || !code.trim()} className="flex items-center gap-1 rounded-xl bg-[var(--ink)] px-4 font-semibold text-white disabled:opacity-50">
              {joining && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('join')}
            </button>
          </div>
          {joinError && <p className="mt-2 text-sm text-red-600">{joinError}</p>}
        </form>
        {canCreate ? (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-4 font-bold text-[var(--ink)] shadow-lg hover:brightness-110"
          >
            <Plus className="h-5 w-5" /> {t('newTrip')}
          </button>
        ) : (
          <Link
            href={{ pathname: '/billing' }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-[var(--gold)]/40 bg-white px-6 py-4 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
          >
            <Lock className="h-4 w-4 text-[var(--gold)]" /> {t('createNeedsPlan')}
          </Link>
        )}
      </div>

      {!canCreate && <p className="rounded-xl bg-[var(--gold-pale)] px-4 py-3 text-sm text-[var(--ink)]">{t('invitedTripsHint')}</p>}

      {trips.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-[var(--gold)]/40 bg-white/70 p-10 text-center">
          <p className="mb-2 text-4xl">🧳</p>
          <h3 className="text-lg font-bold text-[var(--ink)]">{t('emptyTitle')}</h3>
          <p className="mx-auto mt-1 max-w-md text-[var(--muted)]">{t('emptyText')}</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-[var(--ink)]">{t('upcomingTrips')}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{upcoming.map(card)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-lg font-bold text-[var(--muted)]">{t('pastTrips')}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{past.map(card)}</div>
            </section>
          )}
        </>
      )}

      {creating && (
        <Sheet title={t('newTrip')} onClose={() => setCreating(false)}>
          <TravelTripForm
            mode="create"
            initial={prefill ?? undefined}
            onSubmit={async (values, checklist) => {
              const result = await createTrip({ ...values, checklist })
              if (result.success && result.id) {
                router.push(tripPath(result.id))
                return null
              }
              return t(`error_${result.success ? 'saveError' : result.error}`)
            }}
          />
        </Sheet>
      )}
    </div>
  )
}
