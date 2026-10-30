'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileSpreadsheet,
  Info,
  LoaderCircle,
  Moon,
  Pencil,
  Play,
  Plus,
  Square,
  Timer,
} from 'lucide-react'
import { Sheet } from '@/components/memolife/MemoLifeForms'
import { getOpenShift, listPlaces, listShifts, repeatYesterday, startShift, type RegistroInitial } from '@/app/actions/registroOre'
import {
  addDays,
  endsNextDay,
  formatDay,
  formatDecimalHours,
  formatEuro,
  formatHM,
  formatMonth,
  holidayOf,
  monthBounds,
  monthFetchRange,
  mondayOf,
  romeParts,
  romeTime,
  romeToday,
  summarizeMonth,
  weekdayOf,
  workedMinutes,
  type WorkPlace,
  type WorkShift,
} from '@/lib/registroOre'
import { toCsv, downloadCsv } from '@/lib/magazzino'
import { askConfirm } from '@/lib/confirm'
import { EndForm, PlaceForm, ShiftForm, StartForm, inputClass, labelClass, primaryClass, useErrorText } from './RegistroOreForms'

type SheetState =
  | { kind: 'place'; place: WorkPlace | null }
  | { kind: 'shift'; shift: WorkShift | null; date?: string }
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'pdf' }
  | null

const card = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5'

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Tempo passato dall'inizio: «2:05:09»
function elapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function RegistroOreApp({ initial, year: initialYear, month: initialMonth }: { initial: RegistroInitial; year: number; month: number }) {
  const t = useTranslations('registroOre')
  const locale = useLocale()
  const errorText = useErrorText()
  const [places, setPlaces] = useState(initial.places)
  const [shifts, setShifts] = useState(initial.shifts)
  const [open, setOpen] = useState(initial.open)
  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(initialMonth)
  const [placeFilter, setPlaceFilter] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  const [personName, setPersonName] = useState(initial.personName)

  // Orologio del turno in corso
  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [open])

  const loadMonth = useCallback(async (y: number, m: number) => {
    setLoading(true)
    const range = monthFetchRange(y, m)
    const [list, current] = await Promise.all([listShifts(range.from, range.to), getOpenShift()])
    setShifts(list)
    setOpen(current)
    setLoading(false)
  }, [])

  const refresh = useCallback(() => loadMonth(year, month), [loadMonth, year, month])

  const goMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month - 1 + delta, 1))
    const y = d.getUTCFullYear()
    const m = d.getUTCMonth() + 1
    setYear(y)
    setMonth(m)
    setSelected(null)
    loadMonth(y, m)
  }

  const placeById = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  const summary = useMemo(() => summarizeMonth(shifts, places, year, month, placeFilter || null), [shifts, places, year, month, placeFilter])
  const today = romeToday()
  const { first, last } = monthBounds(year, month)
  const totals = summary.totals
  const shownPlaces = placeFilter ? places.filter((p) => p.id === placeFilter) : places

  // Posto proposto per un turno nuovo: filtro attivo, ultimo usato o il primo
  const lastShift = useMemo(() => [...shifts].filter((s) => s.ends_at).sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))[0] ?? null, [shifts])
  const defaultPlaceId = placeFilter || (lastShift && placeById.has(lastShift.place_id) ? lastShift.place_id : places[0]?.id) || ''
  const lastOfPlace = (placeId: string) =>
    [...shifts].filter((s) => s.ends_at && s.place_id === placeId).sort((a, b) => Date.parse(b.starts_at) - Date.parse(a.starts_at))[0] ?? null

  const shiftDefaults = (date?: string) => {
    const prev = lastOfPlace(defaultPlaceId)
    return {
      placeId: defaultPlaceId,
      date: date ?? selected ?? today,
      start: prev ? romeTime(prev.starts_at) : '09:00',
      end: prev?.ends_at ? romeTime(prev.ends_at) : '17:00',
      breakMinutes: prev?.break_minutes ?? 0,
    }
  }

  const hm = (min: number) => t('hm', { h: Math.floor(min / 60), m: String(min % 60).padStart(2, '0') })

  // ─── Azioni rapide ───
  const quickStart = async () => {
    if (places.length > 1) return setSheet({ kind: 'start' })
    setBusy('start')
    const result = await startShift(defaultPlaceId)
    setBusy(null)
    if (!result.success) return setNotice(errorText(result))
    setOpen(result.data)
    setNow(Date.now())
    setNotice(t('startedNotice', { time: romeTime(result.data.starts_at) }))
  }

  const repeat = async () => {
    const todayShifts = shifts.filter((s) => s.work_date === today)
    if (todayShifts.length && !(await askConfirm(t('repeatConfirm')))) return
    setBusy('repeat')
    const result = await repeatYesterday()
    setBusy(null)
    if (!result.success) return setNotice(errorText(result))
    setNotice(t('repeatedNotice', { n: result.data.length }))
    await refresh()
  }

  // ─── Esportazioni ───
  const exportCsv = () => {
    const rows: (string | number | null)[][] = [
      [t('csvDate'), t('csvWeekday'), t('csvPlace'), t('csvStart'), t('csvEnd'), t('csvBreak'), t('csvHours'), t('csvHoursDecimal'), t('csvOvertimeDecimal'), t('csvHoliday'), t('csvNight'), t('csvNotes')],
    ]
    const dec = (min: number) => Math.round((min / 60) * 100) / 100
    for (const day of summary.days) {
      for (const s of day.shifts) {
        const worked = workedMinutes(s)
        rows.push([
          day.date,
          formatDay(day.date, locale, { weekday: 'long' }),
          placeById.get(s.place_id)?.name ?? '',
          romeTime(s.starts_at),
          s.ends_at ? romeTime(s.ends_at) : '',
          s.break_minutes,
          formatHM(worked),
          dec(worked),
          dec(day.shiftOvertime[s.id] ?? 0),
          s.is_holiday ? t('yes') : day.holiday ? t(`holiday_${day.holiday}`) : '',
          s.is_night ? t('yes') : '',
          s.notes ?? '',
        ])
      }
    }
    rows.push([])
    rows.push([t('totalWorked'), null, null, null, null, null, formatHM(totals.worked), dec(totals.worked), dec(totals.overtime), null, null, null])
    downloadCsv(`registro-ore-${year}-${String(month).padStart(2, '0')}.csv`, toCsv(rows))
  }

  const exportPdf = async (name: string) => {
    setBusy('pdf')
    try {
      const { buildRegistroPdf } = await import('@/lib/registroOrePdf')
      const monthLabel = formatMonth(year, month, locale)
      const blob = await buildRegistroPdf({
        year,
        month,
        locale,
        personName: name,
        places,
        shownPlaces: shownPlaces.length ? shownPlaces : places,
        summary,
        labels: {
          title: t('pdfTitle'),
          monthLabel,
          personLabel: t('pdfPerson'),
          placeLabel: t('pdfPlace'),
          colDay: t('pdfColDay'),
          colPlace: t('pdfColPlace'),
          colTime: t('pdfColTime'),
          colBreak: t('pdfColBreak'),
          colHours: t('pdfColHours'),
          colOvertime: t('pdfColOvertime'),
          colNotes: t('pdfColNotes'),
          nextDay: t('nextDayShort'),
          holidayMark: t('tagHoliday'),
          nightMark: t('tagNight'),
          holidayName: (key) => t(`holiday_${key}`),
          totalsTitle: t('totalsTitle'),
          totalWorked: t('totalWorked'),
          ordinary: t('ordinary'),
          overtime: t('overtime'),
          sundays: t('sundays'),
          holidays: t('holidays'),
          night: t('night'),
          shiftsCount: t('shiftsCount'),
          grossEstimate: t('grossEstimate'),
          grossNote: t('grossNote'),
          grossPartial: t('grossPartial'),
          weeksTitle: t('weeksTitle'),
          weekLine: (from, to, worked, threshold, place) => t('pdfWeekLine', { from, to, worked, threshold, place: place ? ` · ${place}` : '' }),
          weekOver: (over) => t('weekOver', { hm: over }),
          weekCrossesMonth: t('weekCrossesMonth'),
          hoursUnit: t('hoursUnit'),
          signatureWorker: t('pdfSignatureWorker'),
          signatureEmployer: t('pdfSignatureEmployer'),
          footer: t('pdfFooter'),
          pageOf: (page, pages) => t('pdfPageOf', { page, pages }),
        },
      })
      downloadBlob(blob, `registro-ore-${year}-${String(month).padStart(2, '0')}.pdf`)
      setSheet(null)
    } catch (err) {
      console.error(err)
      setNotice(t('pdfError'))
    } finally {
      setBusy(null)
    }
  }

  // ─── Primo uso: nessun posto di lavoro ───
  if (!places.length) {
    return (
      <div className="mx-auto max-w-lg">
        <div className={card}>
          <h3 className="text-xl font-bold text-[var(--ink)]">{t('firstPlaceTitle')}</h3>
          <p className="mb-4 mt-1 text-sm text-gray-600">{t('firstPlaceText')}</p>
          <PlaceForm place={null} usedColors={[]} inline onSaved={(p) => setPlaces([p])} />
        </div>
      </div>
    )
  }

  // Calendario: lunedì della prima settimana → domenica dell'ultima
  const gridStart = mondayOf(first)
  const gridDays: string[] = []
  for (let d = gridStart; d <= addDays(mondayOf(last), 6); d = addDays(d, 1)) gridDays.push(d)
  const dayByDate = new Map(summary.days.map((d) => [d.date, d]))
  const weekdayNames = Array.from({ length: 7 }, (_, i) => formatDay(addDays('2026-10-05', i), locale, { weekday: 'narrow' }))
  const listDays = selected ? summary.days.filter((d) => d.date === selected) : [...summary.days].reverse()
  const openPlace = open ? placeById.get(open.place_id) : null
  const openStartDay = open ? romeParts(Date.parse(open.starts_at)).date : null

  return (
    <div className="space-y-5">
      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] p-3 text-sm text-[var(--ink)]">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="font-bold text-gray-500" aria-label="×">
            ×
          </button>
        </div>
      )}

      {/* Turno in corso o pulsanti rapidi */}
      {open ? (
        <div className="rounded-2xl bg-[var(--ink)] p-5 text-white shadow-lg">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[var(--gold-bright)]">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-400" /> {t('openTitle')}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-white/80">
            {openPlace && <span className="h-3 w-3 rounded-full" style={{ backgroundColor: openPlace.color }} />}
            {openPlace?.name} ·{' '}
            {openStartDay === today
              ? t('openSince', { time: romeTime(open.starts_at) })
              : t('openSinceDay', { time: romeTime(open.starts_at), day: formatDay(openStartDay!, locale) })}
          </p>
          <p className="mt-2 font-mono text-5xl font-bold tabular-nums tracking-tight" aria-live="off">
            {now === null ? '…' : elapsed(now - Date.parse(open.starts_at))}
          </p>
          {now !== null && now - Date.parse(open.starts_at) > 16 * 3_600_000 && <p className="mt-2 text-sm text-amber-300">{t('openTooLong')}</p>}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setSheet({ kind: 'end' })} className={primaryClass}>
              <Square className="h-4 w-4" /> {t('endShift')}
            </button>
            <button
              type="button"
              onClick={() => setSheet({ kind: 'shift', shift: open })}
              className="flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-3 font-semibold text-white hover:bg-white/10"
            >
              <Pencil className="h-4 w-4" /> {t('editOpen')}
            </button>
          </div>
        </div>
      ) : (
        <div className={card}>
          <button type="button" onClick={quickStart} disabled={busy === 'start'} className={`${primaryClass} py-4 text-lg`}>
            {busy === 'start' ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />} {t('startShift')}
          </button>
          <p className="mt-1.5 text-center text-xs text-gray-500">{t('startShiftHint')}</p>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setSheet({ kind: 'shift', shift: null })}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-800 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" /> {t('addShift')}
            </button>
            <button
              type="button"
              onClick={repeat}
              disabled={busy === 'repeat'}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              {busy === 'repeat' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} {t('repeatYesterday')}
            </button>
          </div>
        </div>
      )}

      {/* Mese e posto */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => goMonth(-1)} className="rounded-lg p-2 hover:bg-gray-100" aria-label={t('prevMonth')}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <h3 className="min-w-[10rem] text-center text-lg font-bold capitalize text-[var(--ink)]">{formatMonth(year, month, locale)}</h3>
          <button type="button" onClick={() => goMonth(1)} className="rounded-lg p-2 hover:bg-gray-100" aria-label={t('nextMonth')}>
            <ChevronRight className="h-5 w-5" />
          </button>
          {loading && <LoaderCircle className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
        {places.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {[{ id: '', name: t('allPlaces'), color: '' }, ...places].map((p) => (
              <button
                key={p.id || 'all'}
                type="button"
                onClick={() => setPlaceFilter(p.id)}
                aria-pressed={placeFilter === p.id}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold ${placeFilter === p.id ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-gray-300 bg-white text-gray-700'}`}
              >
                {p.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />}
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Totali del mese */}
      <div className={card}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2 rounded-xl bg-[var(--gold-pale)] p-3 sm:col-span-1">
            <p className="text-xs font-semibold text-gray-600">{t('totalWorked')}</p>
            <p className="text-2xl font-bold text-[var(--ink)]">{hm(totals.worked)}</p>
            <p className="text-xs text-gray-600">{t('decimalHours', { n: formatDecimalHours(totals.worked, locale) })}</p>
          </div>
          <Stat label={t('ordinary')} value={hm(totals.ordinary)} />
          <Stat label={t('overtime')} value={hm(totals.overtime)} strong={totals.overtime > 0} />
          <Stat label={t('daysWorked')} value={String(totals.daysWorked)} />
          <Stat label={t('sundays')} value={hm(totals.sunday)} />
          <Stat label={t('holidays')} value={hm(totals.holiday)} />
          {totals.night > 0 && <Stat label={t('night')} value={hm(totals.night)} />}
          {totals.gross !== null && <Stat label={t('grossEstimate')} value={formatEuro(totals.gross, locale)} />}
        </div>
        {totals.gross !== null && (
          <p className="mt-3 text-xs text-gray-500">
            {t('grossNote')} {totals.grossPartial && t('grossPartial')}
          </p>
        )}
        {totals.gross === null && totals.worked > 0 && <p className="mt-3 text-xs text-gray-500">{t('noRateHint')}</p>}
      </div>

      {/* Calendario */}
      <div className={card}>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold uppercase text-gray-500">
          {weekdayNames.map((name, i) => (
            <span key={i} className={i === 6 ? 'text-red-600' : ''}>
              {name}
            </span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {gridDays.map((date) => {
            const inMonth = date >= first && date <= last
            if (!inMonth) return <span key={date} />
            const day = dayByDate.get(date)
            const red = weekdayOf(date) === 0 || !!holidayOf(date)
            const isSel = selected === date
            const colors = [...new Set((day?.shifts ?? []).map((s) => placeById.get(s.place_id)?.color).filter(Boolean))] as string[]
            return (
              <button
                key={date}
                type="button"
                onClick={() => setSelected(isSel ? null : date)}
                title={holidayOf(date) ? t(`holiday_${holidayOf(date)}`) : undefined}
                aria-pressed={isSel}
                className={`flex min-h-[3.4rem] flex-col items-center rounded-lg border p-1 text-xs ${
                  isSel ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : day ? 'border-[var(--gold)]/50 bg-[var(--gold-pale)]' : 'border-gray-100 bg-white'
                } ${date === today && !isSel ? 'ring-2 ring-[var(--gold)]' : ''}`}
              >
                <span className={`font-bold ${red && !isSel ? 'text-red-600' : ''}`}>{Number(date.slice(8))}</span>
                {day && <span className="mt-0.5 font-semibold tabular-nums">{formatHM(day.worked)}</span>}
                {day && day.overtime > 0 && <span className={`text-[10px] font-bold ${isSel ? 'text-[var(--gold-bright)]' : 'text-amber-700'}`}>+{formatHM(day.overtime)}</span>}
                {colors.length > 0 && (
                  <span className="mt-auto flex gap-0.5">
                    {colors.map((c) => (
                      <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">{t('calendarHint')}</p>
      </div>

      {/* Giorno per giorno */}
      <div className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 font-bold text-[var(--ink)]">
            <CalendarDays className="h-5 w-5 text-[var(--gold)]" />
            {selected ? formatDay(selected, locale, { weekday: 'long', day: 'numeric', month: 'long' }) : t('dayByDay')}
          </h3>
          {selected && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSheet({ kind: 'shift', shift: null, date: selected })}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--ink)] px-3 py-2 text-sm font-bold text-white"
              >
                <Plus className="h-4 w-4" /> {t('addShiftDay')}
              </button>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">
                {t('wholeMonth')}
              </button>
            </div>
          )}
        </div>
        {selected && holidayOf(selected) && <p className="mb-2 text-sm font-semibold text-red-700">{t(`holiday_${holidayOf(selected)}`)}</p>}
        {!listDays.length ? (
          <p className="py-4 text-center text-sm text-gray-500">{selected ? t('noShiftsDay') : t('noShiftsMonth')}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {listDays.map((day) => (
              <li key={day.date} className="py-3">
                {!selected && (
                  <p className="mb-1 flex flex-wrap items-baseline gap-2 text-sm font-bold capitalize text-[var(--ink)]">
                    <span className={weekdayOf(day.date) === 0 || day.holiday ? 'text-red-700' : ''}>{formatDay(day.date, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                    {day.holiday && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold normal-case text-red-700">{t(`holiday_${day.holiday}`)}</span>}
                  </p>
                )}
                <div className="space-y-1.5">
                  {day.shifts.map((s) => {
                    const place = placeById.get(s.place_id)
                    const over = day.shiftOvertime[s.id] ?? 0
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSheet({ kind: 'shift', shift: s })}
                        className="flex w-full items-start gap-3 rounded-xl border border-gray-100 p-3 text-left hover:border-[var(--gold)]/60 hover:bg-[var(--gold-pale)]/40"
                      >
                        <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: place?.color }} />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold tabular-nums text-[var(--ink)]">
                            {romeTime(s.starts_at)} – {s.ends_at ? romeTime(s.ends_at) : '…'}
                            {endsNextDay(s) && <span className="ml-1 text-xs font-normal text-gray-500">({t('nextDayShort')})</span>}
                          </span>
                          <span className="block text-xs text-gray-600">
                            {places.length > 1 && `${place?.name} · `}
                            {s.break_minutes ? t('breakShort', { n: s.break_minutes }) : t('noBreak')}
                          </span>
                          {(s.is_holiday || s.is_night) && (
                            <span className="mt-1 flex flex-wrap gap-1">
                              {s.is_holiday && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700">{t('tagHoliday')}</span>}
                              {s.is_night && (
                                <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                                  <Moon className="h-3 w-3" /> {t('tagNight')}
                                </span>
                              )}
                            </span>
                          )}
                          {s.notes && <span className="mt-1 block truncate text-xs italic text-gray-500">{s.notes}</span>}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-bold tabular-nums text-[var(--ink)]">{hm(workedMinutes(s))}</span>
                          {over > 0 && <span className="block text-xs font-bold text-amber-700">{t('overtimeShort', { hm: formatHM(over) })}</span>}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {day.shifts.length > 1 && <p className="mt-1.5 text-right text-xs font-semibold text-gray-600">{t('dayTotal', { hm: hm(day.worked) })}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Settimane */}
      {summary.weeks.length > 0 && (
        <div className={card}>
          <h3 className="mb-1 flex items-center gap-2 font-bold text-[var(--ink)]">
            <Timer className="h-5 w-5 text-[var(--gold)]" /> {t('weeksTitle')}
          </h3>
          <p className="mb-3 text-xs text-gray-500">{t('weeksHint')}</p>
          <ul className="space-y-2">
            {summary.weeks.map((w) => {
              const place = placeById.get(w.placeId)
              const pct = Math.min(100, Math.round((w.worked / w.threshold) * 100))
              return (
                <li key={`${w.monday}-${w.placeId}`} className="text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-semibold text-gray-800">
                      {formatDay(w.monday, locale, { day: 'numeric', month: 'short' })} – {formatDay(w.sunday, locale, { day: 'numeric', month: 'short' })}
                      {w.crossesMonth && <span className="text-gray-400">*</span>}
                      {places.length > 1 && !placeFilter && <span className="ml-1 font-normal text-gray-500">· {place?.name}</span>}
                    </span>
                    <span className="tabular-nums text-gray-700">
                      {t('weekOf', { worked: formatHM(w.worked), threshold: formatHM(w.threshold) })}
                      {w.over > 0 && <span className="ml-2 font-bold text-amber-700">{t('weekOver', { hm: formatHM(w.over) })}</span>}
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className={`h-full rounded-full ${w.over > 0 ? 'bg-amber-500' : 'bg-[var(--gold)]'}`} style={{ width: `${pct}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
          {summary.weeks.some((w) => w.crossesMonth) && <p className="mt-2 text-xs text-gray-500">* {t('weekCrossesMonth')}</p>}
        </div>
      )}

      {/* Esportazioni */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => setSheet({ kind: 'pdf' })} disabled={!summary.days.length} className={primaryClass}>
          <Download className="h-4 w-4" /> {t('downloadPdf')}
        </button>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!summary.days.length}
          className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" /> {t('downloadCsv')}
        </button>
      </div>

      {/* Posti di lavoro */}
      <div className={card}>
        <h3 className="mb-3 font-bold text-[var(--ink)]">{t('placesTitle')}</h3>
        <ul className="space-y-2">
          {places.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSheet({ kind: 'place', place: p })}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-100 p-3 text-left hover:bg-gray-50"
              >
                <span className="h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-[var(--ink)]">{p.name}</span>
                  <span className="block text-xs text-gray-600">
                    {t('placeSummary', { daily: formatDecimalHours(p.daily_hours * 60, locale), weekly: formatDecimalHours(p.weekly_hours * 60, locale) })}
                    {p.hourly_rate !== null && ` · ${t('ratePerHour', { rate: formatEuro(p.hourly_rate, locale) })}`}
                  </span>
                </span>
                <Pencil className="h-4 w-4 shrink-0 text-gray-400" />
              </button>
            </li>
          ))}
        </ul>
        {places.length < 30 && (
          <button
            type="button"
            onClick={() => setSheet({ kind: 'place', place: null })}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" /> {t('addPlace')}
          </button>
        )}
      </div>

      {/* Come si contano le ore */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
        <p className="mb-2 flex items-center gap-2 font-bold text-[var(--ink)]">
          <Info className="h-4 w-4 text-[var(--gold)]" /> {t('howTitle')}
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t('how1')}</li>
          <li>{t('how2')}</li>
          <li>{t('how3')}</li>
          <li>{t('how4')}</li>
          <li>{t('how5')}</li>
        </ul>
      </div>

      {/* Finestre */}
      {sheet?.kind === 'place' && (
        <Sheet title={sheet.place ? t('editPlace') : t('newPlace')} onClose={() => setSheet(null)}>
          <PlaceForm
            place={sheet.place}
            usedColors={places.map((p) => p.color)}
            onSaved={(p) => {
              setPlaces((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]))
              setSheet(null)
              setNotice(t('placeSaved'))
            }}
            onDeleted={async () => {
              setSheet(null)
              setPlaceFilter('')
              setPlaces(await listPlaces())
              setNotice(t('placeDeleted'))
              await refresh()
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === 'shift' && (
        <Sheet title={sheet.shift ? t('editShift') : t('newShift')} onClose={() => setSheet(null)}>
          <ShiftForm
            shift={sheet.shift}
            places={places}
            defaults={shiftDefaults(sheet.date)}
            onSaved={async (s) => {
              setSheet(null)
              setNotice(t('shiftSaved', { hm: hm(workedMinutes(s)) }))
              await refresh()
            }}
            onDeleted={async () => {
              setSheet(null)
              setNotice(t('shiftDeleted'))
              await refresh()
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === 'start' && (
        <Sheet title={t('startShift')} onClose={() => setSheet(null)}>
          <StartForm
            places={places}
            defaultPlaceId={defaultPlaceId}
            onSaved={(s) => {
              setSheet(null)
              setOpen(s)
              setNow(Date.now())
              setNotice(t('startedNotice', { time: romeTime(s.starts_at) }))
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === 'end' && open && (
        <Sheet title={t('endShift')} onClose={() => setSheet(null)}>
          <EndForm
            shift={open}
            defaultBreak={lastOfPlace(open.place_id)?.break_minutes ?? 0}
            onSaved={async (s) => {
              setSheet(null)
              setOpen(null)
              setNotice(t('endedNotice', { hm: hm(workedMinutes(s)) }))
              await refresh()
            }}
          />
        </Sheet>
      )}
      {sheet?.kind === 'pdf' && (
        <Sheet title={t('downloadPdf')} onClose={() => setSheet(null)}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              exportPdf(personName.trim())
            }}
          >
            <p className="text-sm text-gray-600">
              {t('pdfIntro', { month: formatMonth(year, month, locale), places: (shownPlaces.length ? shownPlaces : places).map((p) => p.name).join(', ') })}
            </p>
            <div>
              <label className={labelClass} htmlFor="ro-pdf-name">
                {t('pdfNameLabel')}
              </label>
              <input id="ro-pdf-name" className={inputClass} value={personName} maxLength={120} onChange={(e) => setPersonName(e.target.value)} />
            </div>
            <button type="submit" disabled={busy === 'pdf'} className={primaryClass}>
              {busy === 'pdf' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {busy === 'pdf' ? t('pdfMaking') : t('downloadPdf')}
            </button>
          </form>
        </Sheet>
      )}
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-100 p-3">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${strong ? 'text-amber-700' : 'text-[var(--ink)]'}`}>{value}</p>
    </div>
  )
}
