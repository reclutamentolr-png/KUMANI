'use client'

import { useCallback, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, LoaderCircle, Play, Square, Trash2 } from 'lucide-react'
import { deletePlace, deleteShift, endShift, savePlace, saveShift, startShift } from '@/app/actions/registroOre'
import {
  DEFAULT_DAILY_HOURS,
  DEFAULT_WEEKLY_HOURS,
  PLACE_COLORS,
  REGISTRO_LIMITS,
  endAfter,
  holidayOf,
  romeParts,
  romeTime,
  shiftTimes,
  type WorkPlace,
  type WorkShift,
} from '@/lib/registroOre'
import { askConfirm } from '@/lib/confirm'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'

export const inputClass =
  'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
export const labelClass = 'mb-1 block text-sm font-semibold text-gray-700'
export const primaryClass =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-60'

type Result = { success: true } | { success: false; message: string; limitText?: string }

/**
 * Chiama un'azione del server: se la connessione cade o il server non
 * risponde, invece di restare con la rotellina che gira si ha un errore da
 * mostrare («Non sono riuscito a salvare»).
 */
export async function callAction<T extends Result>(action: () => Promise<T>): Promise<T | { success: false; message: string; limitText?: string }> {
  try {
    return await action()
  } catch (err) {
    console.error('[RegistroOre] action failed:', err)
    return { success: false, message: 'saveError' }
  }
}

/** Messaggio d'errore tradotto per il codice restituito dalle azioni */
export function useErrorText() {
  const t = useTranslations('registroOre')
  return useCallback(
    (result: Result) => {
      if (result.success) return null
      if (result.limitText) return result.limitText
      return t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError')
    },
    [t],
  )
}

function ErrorBox({ text }: { text: string | null }) {
  if (!text) return null
  return <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{text}</p>
}

const fmtNumber = (value: number | null | undefined, locale: string) =>
  value === null || value === undefined ? '' : new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(value)

// ─── Posto di lavoro ──────────────────────────────────────────────────────

export function PlaceForm({
  place,
  usedColors,
  onSaved,
  onDeleted,
  inline,
}: {
  place: WorkPlace | null
  usedColors: string[]
  onSaved: (place: WorkPlace) => void
  onDeleted?: () => void
  inline?: boolean
}) {
  const t = useTranslations('registroOre')
  const locale = useLocale()
  const errorText = useErrorText()
  const [name, setName] = useState(place?.name ?? '')
  const [color, setColor] = useState(place?.color ?? PLACE_COLORS.find((c) => !usedColors.includes(c)) ?? PLACE_COLORS[0])
  const [rate, setRate] = useState(fmtNumber(place?.hourly_rate, locale))
  const [daily, setDaily] = useState(fmtNumber(place?.daily_hours ?? DEFAULT_DAILY_HOURS, locale))
  const [weekly, setWeekly] = useState(fmtNumber(place?.weekly_hours ?? DEFAULT_WEEKLY_HOURS, locale))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await callAction(() => savePlace({ id: place?.id, name, color, hourlyRate: rate, dailyHours: daily, weeklyHours: weekly }))
    setBusy(false)
    if (result.success) onSaved(result.data)
    else setError(errorText(result))
  }

  const remove = async () => {
    if (!place || !(await askConfirm(t('deletePlaceConfirm', { name: place.name })))) return
    setBusy(true)
    const result = await callAction(() => deletePlace(place.id))
    setBusy(false)
    if (result.success) onDeleted?.()
    else setError(errorText(result))
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="ro-place-name">
          {t('placeName')}
        </label>
        <input
          id="ro-place-name"
          className={inputClass}
          value={name}
          maxLength={REGISTRO_LIMITS.placeName}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('placeNamePlaceholder')}
          required
          autoFocus={!place && !inline}
        />
      </div>
      <div>
        <span className={labelClass}>{t('placeColor')}</span>
        <div className="flex flex-wrap gap-2">
          {PLACE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={c}
              aria-pressed={color === c}
              className={`flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 ${color === c ? 'ring-2 ring-[var(--ink)]' : ''}`}
              style={{ backgroundColor: c }}
            >
              {color === c && <Check className="h-4 w-4 text-white" />}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelClass} htmlFor="ro-place-rate">
          {t('hourlyRate')}
        </label>
        <div className="relative">
          <input
            id="ro-place-rate"
            className={`${inputClass} pr-10`}
            inputMode="decimal"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder={t('hourlyRatePlaceholder')}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">€</span>
        </div>
        <p className="mt-1 text-xs text-gray-500">{t('hourlyRateHint')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="ro-place-daily">
            {t('dailyHours')}
          </label>
          <input id="ro-place-daily" className={inputClass} inputMode="decimal" value={daily} onChange={(e) => setDaily(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="ro-place-weekly">
            {t('weeklyHours')}
          </label>
          <input id="ro-place-weekly" className={inputClass} inputMode="decimal" value={weekly} onChange={(e) => setWeekly(e.target.value)} required />
        </div>
      </div>
      <p className="-mt-2 text-xs text-gray-500">{t('thresholdsHint')}</p>
      <ErrorBox text={error} />
      <div className="flex gap-2">
        {!inline && <CancelButton className={cancelButtonLgClass} />}
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {place ? t('save') : t('addPlace')}
        </button>
      </div>
      {place && (
        <button type="button" onClick={remove} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50">
          <Trash2 className="h-4 w-4" /> {t('deletePlace')}
        </button>
      )}
    </form>
  )
}

// ─── Scelta del posto ─────────────────────────────────────────────────────

function PlacePicker({ places, value, onChange }: { places: WorkPlace[]; value: string; onChange: (id: string) => void }) {
  const t = useTranslations('registroOre')
  if (places.length < 2) return null
  return (
    <div>
      <span className={labelClass}>{t('place')}</span>
      <div className="flex flex-wrap gap-2">
        {places.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            aria-pressed={value === p.id}
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${value === p.id ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-gray-300 bg-white text-gray-700'}`}
          >
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </button>
        ))}
      </div>
    </div>
  )
}

const BREAK_CHOICES = [0, 15, 30, 45, 60]

function BreakField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('registroOre')
  return (
    <div>
      <label className={labelClass} htmlFor="ro-break">
        {t('breakMinutes')}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        {BREAK_CHOICES.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onChange(String(m))}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${Number(value || 0) === m ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-gray-300 bg-white text-gray-600'}`}
          >
            {m === 0 ? t('noBreak') : t('minutesShort', { n: m })}
          </button>
        ))}
        <input
          id="ro-break"
          className={`${inputClass} w-24`}
          type="number"
          inputMode="numeric"
          min={0}
          max={REGISTRO_LIMITS.breakMax}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={t('breakMinutes')}
        />
      </div>
    </div>
  )
}

// Anteprima delle ore mentre si scrive
function Preview({ minutes, nextDay, error }: { minutes: number | null; nextDay: boolean; error: string | null }) {
  const t = useTranslations('registroOre')
  if (error) return <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{error}</p>
  if (minutes === null) return null
  return (
    <p className="rounded-lg bg-[var(--gold-pale)] p-3 text-sm text-[var(--ink)]">
      {t('previewWorked', { hm: t('hm', { h: Math.floor(minutes / 60), m: String(minutes % 60).padStart(2, '0') }) })}
      {nextDay && <span className="block text-xs text-gray-600">{t('previewNextDay')}</span>}
    </p>
  )
}

// ─── Turno (a mano o modifica) ────────────────────────────────────────────

export function ShiftForm({
  shift,
  places,
  defaults,
  onSaved,
  onDeleted,
}: {
  shift: WorkShift | null
  places: WorkPlace[]
  defaults: { placeId: string; date: string; start: string; end: string; breakMinutes: number }
  onSaved: (shift: WorkShift) => void
  onDeleted: () => void
}) {
  const t = useTranslations('registroOre')
  const errorText = useErrorText()
  const isOpen = !!shift && !shift.ends_at
  const [placeId, setPlaceId] = useState(shift?.place_id ?? defaults.placeId)
  const [date, setDate] = useState(shift?.work_date ?? defaults.date)
  const [start, setStart] = useState(shift ? romeTime(shift.starts_at) : defaults.start)
  const [end, setEnd] = useState(shift?.ends_at ? romeTime(shift.ends_at) : shift ? '' : defaults.end)
  const [stillOpen, setStillOpen] = useState(isOpen)
  const [breakMinutes, setBreakMinutes] = useState(String(shift?.break_minutes ?? defaults.breakMinutes))
  const [isHoliday, setIsHoliday] = useState(shift?.is_holiday ?? false)
  const [isNight, setIsNight] = useState(shift?.is_night ?? false)
  const [notes, setNotes] = useState(shift?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const holiday = date ? holidayOf(date) : null
  // Anteprima con gli stessi calcoli del salvataggio
  let preview: { minutes: number | null; nextDay: boolean; error: string | null } = { minutes: null, nextDay: false, error: null }
  if (!stillOpen && date && start && end) {
    const times = shiftTimes(date, start, end)
    if (!times.ok) preview = { minutes: null, nextDay: false, error: t(`error_${times.error}`) }
    else if (times.endMs !== null) {
      const total = Math.round((times.endMs - times.startMs) / 60_000)
      const pause = Number(breakMinutes || 0)
      preview =
        pause >= total
          ? { minutes: null, nextDay: false, error: t('error_breakTooLong') }
          : { minutes: total - pause, nextDay: romeParts(times.endMs).date !== date, error: null }
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await callAction(() =>
      saveShift({
        id: shift?.id,
        placeId,
        date,
        start,
        end: stillOpen ? null : end,
        breakMinutes: breakMinutes || 0,
        isHoliday,
        isNight,
        notes,
      }),
    )
    setBusy(false)
    if (result.success) onSaved(result.data)
    else setError(errorText(result))
  }

  const remove = async () => {
    if (!shift || !(await askConfirm(t('deleteShiftConfirm')))) return
    setBusy(true)
    const result = await callAction(() => deleteShift(shift.id))
    setBusy(false)
    if (result.success) onDeleted()
    else setError(errorText(result))
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PlacePicker places={places} value={placeId} onChange={setPlaceId} />
      <div>
        <label className={labelClass} htmlFor="ro-date">
          {t('date')}
        </label>
        <input id="ro-date" type="date" className={inputClass} value={date} onChange={(e) => setDate(e.target.value)} required />
        {holiday && <p className="mt-1 text-xs font-semibold text-red-700">{t('isNationalHoliday', { name: t(`holiday_${holiday}`) })}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass} htmlFor="ro-start">
            {t('start')}
          </label>
          <input id="ro-start" type="time" className={inputClass} value={start} onChange={(e) => setStart(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="ro-end">
            {t('end')}
          </label>
          <input
            id="ro-end"
            type="time"
            className={inputClass}
            value={stillOpen ? '' : end}
            onChange={(e) => setEnd(e.target.value)}
            disabled={stillOpen}
            required={!stillOpen}
          />
        </div>
      </div>
      {isOpen && (
        <label className="flex items-center gap-3 text-sm font-semibold text-gray-700">
          <input type="checkbox" className="h-5 w-5 accent-[var(--gold)]" checked={stillOpen} onChange={(e) => setStillOpen(e.target.checked)} />
          {t('stillOpen')}
        </label>
      )}
      <p className="-mt-2 text-xs text-gray-500">{t('overnightHint')}</p>
      {!stillOpen && <BreakField value={breakMinutes} onChange={setBreakMinutes} />}
      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--gold)]" checked={isHoliday} onChange={(e) => setIsHoliday(e.target.checked)} />
          <span>
            <span className="font-semibold">{t('markHoliday')}</span>
            <span className="block text-xs text-gray-500">{t('markHolidayHint')}</span>
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--gold)]" checked={isNight} onChange={(e) => setIsNight(e.target.checked)} />
          <span>
            <span className="font-semibold">{t('markNight')}</span>
            <span className="block text-xs text-gray-500">{t('markNightHint')}</span>
          </span>
        </label>
      </div>
      <div>
        <label className={labelClass} htmlFor="ro-notes">
          {t('notes')}
        </label>
        <textarea
          id="ro-notes"
          className={inputClass}
          rows={2}
          maxLength={REGISTRO_LIMITS.notes}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('notesPlaceholder')}
        />
      </div>
      <Preview {...preview} />
      <ErrorBox text={error} />
      <div className="flex gap-2">
        <CancelButton className={cancelButtonLgClass} />
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('save')}
        </button>
      </div>
      {shift && (
        <button type="button" onClick={remove} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600 disabled:opacity-50">
          <Trash2 className="h-4 w-4" /> {t('deleteShift')}
        </button>
      )}
    </form>
  )
}

// ─── Inizio turno (con più posti, o per cambiare l'ora) ───────────────────

export function StartForm({
  places,
  defaultPlaceId,
  onSaved,
  onStale,
}: {
  places: WorkPlace[]
  defaultPlaceId: string
  onSaved: (shift: WorkShift) => void
  /** il turno in corso è già stato aperto (altro dispositivo): la pagina si aggiorna */
  onStale: (text: string) => void
}) {
  const t = useTranslations('registroOre')
  const errorText = useErrorText()
  const [placeId, setPlaceId] = useState(defaultPlaceId)
  const [time, setTime] = useState(() => romeParts(Date.now()).time)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    // Ora non toccata = adesso al minuto
    const result = await callAction(() => startShift(placeId, touched ? time : null))
    setBusy(false)
    if (result.success) onSaved(result.data)
    else if (result.message === 'alreadyOpen') onStale(errorText(result) ?? '')
    else setError(errorText(result))
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PlacePicker places={places} value={placeId} onChange={setPlaceId} />
      <div>
        <label className={labelClass} htmlFor="ro-start-now">
          {t('startTime')}
        </label>
        <input id="ro-start-now" type="time" className={inputClass} value={time}
          onChange={(e) => {
            setTime(e.target.value)
            setTouched(true)
          }}
          required
        />
        <p className="mt-1 text-xs text-gray-500">{t('startTimeHint')}</p>
      </div>
      <ErrorBox text={error} />
      <div className="flex gap-2">
        <CancelButton className={cancelButtonLgClass} />
        <button type="submit" disabled={busy || !placeId} className={primaryClass}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} {t('startShift')}
        </button>
      </div>
    </form>
  )
}

// ─── Fine turno ───────────────────────────────────────────────────────────

export function EndForm({
  shift,
  defaultBreak,
  onSaved,
  onStale,
}: {
  shift: WorkShift
  defaultBreak: number
  onSaved: (shift: WorkShift) => void
  /** turno già chiuso o cancellato (altro dispositivo): la pagina si aggiorna */
  onStale: (text: string) => void
}) {
  const t = useTranslations('registroOre')
  const errorText = useErrorText()
  const [time, setTime] = useState(() => romeParts(Date.now()).time)
  const [breakMinutes, setBreakMinutes] = useState(String(defaultBreak))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startMs = Date.parse(shift.starts_at)
  const endMs = endAfter(startMs, time)
  let preview: { minutes: number | null; nextDay: boolean; error: string | null } = { minutes: null, nextDay: false, error: null }
  if (endMs !== null) {
    const total = Math.round((endMs - startMs) / 60_000)
    const pause = Number(breakMinutes || 0)
    preview =
      total > 24 * 60
        ? { minutes: null, nextDay: false, error: t('error_tooLong') }
        : pause >= total
          ? { minutes: null, nextDay: false, error: t('error_breakTooLong') }
          : { minutes: total - pause, nextDay: romeParts(endMs).date !== shift.work_date, error: null }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await callAction(() => endShift(shift.id, time, breakMinutes || 0))
    setBusy(false)
    if (result.success) onSaved(result.data)
    else if (result.message === 'alreadyClosed' || result.message === 'notFound') onStale(errorText(result) ?? '')
    else setError(errorText(result))
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-600">{t('endStartedAt', { time: romeTime(shift.starts_at) })}</p>
      <div>
        <label className={labelClass} htmlFor="ro-end-now">
          {t('endTime')}
        </label>
        <input id="ro-end-now" type="time" className={inputClass} value={time} onChange={(e) => setTime(e.target.value)} required />
      </div>
      <BreakField value={breakMinutes} onChange={setBreakMinutes} />
      <Preview {...preview} />
      <ErrorBox text={error} />
      <div className="flex gap-2">
        <CancelButton className={cancelButtonLgClass} />
        <button type="submit" disabled={busy} className={primaryClass}>
          {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />} {t('endShift')}
        </button>
      </div>
    </form>
  )
}
