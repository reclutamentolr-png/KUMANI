'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, CheckCircle2, Clock, LoaderCircle, QrCode, RefreshCw, UserCheck, Users, XCircle } from 'lucide-react'
import { checkInPass, getAttendees } from '@/app/actions/events'
import { formatEventDate, type EventAttendee, type OrganizedEvent } from '@/lib/events'
import EventScanner from './EventScanner'

type ScanResult = { result: string; name?: string; at?: string }

// Iscritti di un evento e check-in all'ingresso: elenco con codice e stato,
// "Scansiona pass" con la fotocamera (o codice a 6 cifre) e risultato grande.
export default function EventAttendees({ event }: { event: OrganizedEvent }) {
  const t = useTranslations('eventsOrganizer')
  const locale = useLocale()
  const [attendees, setAttendees] = useState<EventAttendee[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const [checking, setChecking] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)

  const load = useCallback(async () => {
    setAttendees(await getAttendees(event.id))
  }, [event.id])

  useEffect(() => {
    // Caricamento iniziale dal server (setState asincrono)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  const onScan = useCallback(
    async (value: string) => {
      setScanning(false)
      setChecking(true)
      const outcome = await checkInPass(event.id, value)
      setChecking(false)
      setResult(outcome)
      if (outcome.result === 'ok') load()
    },
    [event.id, load],
  )
  const onCancel = useCallback(() => setScanning(false), [])

  const checkedIn = attendees?.filter((a) => a.status === 'checked_in').length ?? 0

  const resultBox = (() => {
    if (!result) return null
    const styles: Record<string, { box: string; icon: React.ReactNode }> = {
      ok: { box: 'border-emerald-300 bg-emerald-50 text-emerald-800', icon: <CheckCircle2 className="h-14 w-14 text-emerald-600" /> },
      already: { box: 'border-amber-300 bg-amber-50 text-amber-800', icon: <AlertTriangle className="h-14 w-14 text-amber-500" /> },
      not_today: { box: 'border-amber-300 bg-amber-50 text-amber-800', icon: <Clock className="h-14 w-14 text-amber-500" /> },
    }
    const style = styles[result.result] ?? { box: 'border-red-300 bg-red-50 text-red-800', icon: <XCircle className="h-14 w-14 text-red-600" /> }
    const key = ['ok', 'already', 'not_today', 'not_allowed'].includes(result.result) ? result.result : 'invalid'
    return (
      <div className={`flex flex-col items-center gap-2 rounded-2xl border-2 p-6 text-center ${style.box}`}>
        {style.icon}
        <p className="text-2xl font-extrabold">{t(`scan_${key}`)}</p>
        {result.name && <p className="text-xl font-semibold">{result.name}</p>}
        {result.result === 'already' && result.at && (
          <p className="text-sm">{t('scanAlreadyAt', { time: formatEventDate(result.at, event.timezone, locale, false) })}</p>
        )}
      </div>
    )
  })()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <Users className="h-4 w-4 text-[var(--gold)]" /> {t('attendeesCount', { count: attendees?.length ?? event.people, capacity: event.capacity })}
        </span>
        <span className="flex items-center gap-1.5">
          <UserCheck className="h-4 w-4 text-emerald-600" /> {t('checkedInCount', { count: attendees ? checkedIn : event.checked_in })}
        </span>
      </div>

      {scanning ? (
        <EventScanner onResult={onScan} onCancel={onCancel} />
      ) : checking ? (
        <div className="flex justify-center py-10">
          <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold)]" />
        </div>
      ) : (
        <>
          {resultBox}
          <button
            type="button"
            onClick={() => {
              setResult(null)
              setScanning(true)
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-white"
          >
            <QrCode className="h-5 w-5" /> {result ? t('scanNext') : t('scanPass')}
          </button>
        </>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">{t('attendeesTitle')}</p>
          <button type="button" onClick={() => load()} className="rounded-md p-1 text-gray-400 hover:bg-gray-100" aria-label={t('refresh')}>
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
        {attendees === null ? (
          <div className="flex justify-center py-6">
            <LoaderCircle className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : attendees.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-[var(--muted)]">{t('attendeesEmpty')}</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {attendees.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--ink)]">{a.name || '—'}</span>
                <span className="font-mono text-xs tracking-widest text-gray-500">{a.code}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    a.status === 'checked_in' ? 'bg-emerald-100 text-emerald-700' : a.status === 'no_show' ? 'bg-gray-100 text-gray-500' : 'bg-[var(--gold-pale)] text-[var(--ink)]'
                  }`}
                >
                  {t(`attendee_${a.status}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
