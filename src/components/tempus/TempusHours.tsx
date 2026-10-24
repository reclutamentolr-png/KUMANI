'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, LoaderCircle, Plus, Trash2, X } from 'lucide-react'
import { addTempusClosure, deleteTempusClosure, saveTempusPage } from '@/app/actions/tempus'
import { SLOT_STEPS, TEMPUS_TIMEZONES, WEEK_ORDER, todayIn, type TempusClosure, type TempusSettings, type TimeRange, type WeekHours } from '@/lib/tempus'
import { card, chip, field, label, primary, secondary } from './ui'

const NOTICE = [0, 30, 60, 120, 240, 720, 1440, 2880]
const AHEAD = [7, 14, 30, 60, 90, 180]
const CANCEL = [0, 2, 12, 24, 48]
const BUFFERS = [0, 5, 10, 15, 30]

// Nome del giorno (0 = domenica) nella lingua dell'utente
const weekdayName = (day: number, locale: string) => new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 7 + day)))
const dayLabel = (date: string, locale: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))

export default function TempusHours({
  settings,
  closures,
  onSettings,
  onClosures,
}: {
  settings: TempusSettings
  closures: TempusClosure[]
  onSettings: (s: TempusSettings) => void
  onClosures: (c: TempusClosure[]) => void
}) {
  const t = useTranslations('tempus')
  const locale = useLocale()
  const [hours, setHours] = useState<WeekHours>(settings.hours)
  const [rules, setRules] = useState({
    slot_step: settings.slot_step,
    buffer_min: settings.buffer_min,
    min_notice_min: settings.min_notice_min,
    max_days_ahead: settings.max_days_ahead,
    cancel_limit_hours: settings.cancel_limit_hours,
    timezone: settings.timezone,
  })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const setDay = (day: number, ranges: TimeRange[]) => {
    setSaved(false)
    setHours((h) => {
      const next = { ...h }
      if (ranges.length) next[String(day)] = ranges
      else delete next[String(day)]
      return next
    })
  }

  // Gli orari del lunedì anche negli altri giorni aperti (o in tutti i feriali)
  const copyMonday = () => {
    const monday = hours['1']
    if (!monday) return
    setSaved(false)
    setHours((h) => {
      const next = { ...h }
      for (const day of [2, 3, 4, 5]) next[String(day)] = monday.map((r) => [...r] as TimeRange)
      return next
    })
  }

  const save = async () => {
    setBusy(true)
    setError('')
    const res = await saveTempusPage({ ...settings, ...rules, hours })
    setBusy(false)
    if (!res.success) return setError(t(`error_${res.message}`))
    onSettings(res.settings)
    setHours(res.settings.hours)
    setSaved(true)
  }

  const noticeLabel = (m: number) => (m === 0 ? t('noNotice') : m < 60 ? `${m} min` : m < 1440 ? t('hoursCount', { count: m / 60 }) : t('daysCount', { count: m / 1440 }))

  return (
    <div className="space-y-4">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('hoursTitle')}</h3>
            <p className="mt-0.5 text-sm text-[var(--muted)]">{t('hoursText')}</p>
          </div>
          <button type="button" onClick={copyMonday} disabled={!hours['1']} className={secondary}>
            <Copy className="h-4 w-4" /> {t('copyMonday')}
          </button>
        </div>
        <ul className="mt-4 space-y-3">
          {WEEK_ORDER.map((day) => {
            const ranges = hours[String(day)] ?? []
            return (
              <li key={day} className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-100 px-3 py-3">
                <label className="flex w-36 items-center gap-2 font-bold capitalize text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={ranges.length > 0}
                    onChange={(e) => setDay(day, e.target.checked ? [['09:00', '18:00']] : [])}
                    className="h-5 w-5 accent-[var(--gold)]"
                  />
                  {weekdayName(day, locale)}
                </label>
                {ranges.length === 0 ? (
                  <span className="text-sm text-[var(--muted)]">{t('closed')}</span>
                ) : (
                  <div className="flex flex-1 flex-wrap items-center gap-2">
                    {ranges.map((r, i) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-xl bg-[var(--paper)] px-2 py-1">
                        <input type="time" step={300} value={r[0]} onChange={(e) => setDay(day, ranges.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm font-bold" />
                        –
                        <input type="time" step={300} value={r[1]} onChange={(e) => setDay(day, ranges.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-sm font-bold" />
                        <button type="button" onClick={() => setDay(day, ranges.filter((_, j) => j !== i))} className="rounded p-1 text-gray-400 hover:text-red-700" aria-label={t('removeRange')}>
                          <X className="h-4 w-4" />
                        </button>
                      </span>
                    ))}
                    {ranges.length < 3 && (
                      <button type="button" onClick={() => setDay(day, [...ranges, [ranges[ranges.length - 1][1] < '20:00' ? ranges[ranges.length - 1][1] : '15:00', '19:00']])} className="text-sm font-semibold text-[var(--gold)] hover:underline">
                        + {t('addRange')}
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      <div className={card}>
        <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('rulesTitle')}</h3>
        <div className="mt-4 space-y-5">
          <Choice title={t('slotStep')} hint={t('slotStepHint')} options={[...SLOT_STEPS]} value={rules.slot_step} render={(v) => `${v} min`} onPick={(v) => setRules({ ...rules, slot_step: v })} />
          <Choice title={t('buffer')} hint={t('bufferHint')} options={BUFFERS} value={rules.buffer_min} render={(v) => (v ? `${v} min` : t('none'))} onPick={(v) => setRules({ ...rules, buffer_min: v })} />
          <Choice title={t('minNotice')} hint={t('minNoticeHint')} options={NOTICE} value={rules.min_notice_min} render={noticeLabel} onPick={(v) => setRules({ ...rules, min_notice_min: v })} />
          <Choice title={t('maxAhead')} hint={t('maxAheadHint')} options={AHEAD} value={rules.max_days_ahead} render={(v) => t('daysCount', { count: v })} onPick={(v) => setRules({ ...rules, max_days_ahead: v })} />
          <Choice title={t('cancelLimit')} hint={t('cancelLimitHint')} options={CANCEL} value={rules.cancel_limit_hours} render={(v) => (v ? t('hoursBefore', { count: v }) : t('anytime'))} onPick={(v) => setRules({ ...rules, cancel_limit_hours: v })} />
          <label className={label}>
            {t('timezone')}
            <select value={rules.timezone} onChange={(e) => setRules({ ...rules, timezone: e.target.value })} className={field}>
              {TEMPUS_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz.replace('_', ' ')}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
        <div className="mt-5 flex items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className={primary}>
            {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
            {t('saveHours')}
          </button>
          {saved && <span className="text-sm font-semibold text-green-700">{t('saved')}</span>}
        </div>
      </div>

      <Closures timezone={settings.timezone} closures={closures} onClosures={onClosures} locale={locale} />
    </div>
  )
}

function Choice({ title, hint, options, value, render, onPick }: { title: string; hint: string; options: number[]; value: number; render: (v: number) => string; onPick: (v: number) => void }) {
  return (
    <div>
      <p className={label}>{title}</p>
      <p className="text-xs text-[var(--muted)]">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o} type="button" onClick={() => onPick(o)} className={chip(value === o)}>
            {render(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Closures({ timezone, closures, onClosures, locale }: { timezone: string; closures: TempusClosure[]; onClosures: (c: TempusClosure[]) => void; locale: string }) {
  const t = useTranslations('tempus')
  const today = todayIn(timezone)
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async () => {
    setBusy(true)
    setError('')
    const res = await addTempusClosure({ starts_on: from, ends_on: to < from ? from : to, note })
    setBusy(false)
    if (!res.success) return setError(t(`error_${res.message}`))
    onClosures([...closures, res.closure].sort((a, b) => a.starts_on.localeCompare(b.starts_on)))
    setNote('')
  }

  const remove = async (id: string) => {
    if ((await deleteTempusClosure(id)).success) onClosures(closures.filter((c) => c.id !== id))
  }

  return (
    <div className={card}>
      <h3 className="text-lg font-extrabold text-[var(--ink)]">{t('closuresTitle')}</h3>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{t('closuresText')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className={label}>
          {t('closureFrom')}
          <input type="date" min={today} value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
        </label>
        <label className={label}>
          {t('closureTo')}
          <input type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
        <label className={label}>
          {t('closureNote')}
          <input value={note} onChange={(e) => setNote(e.target.value.slice(0, 120))} className={field} placeholder={t('closureNotePlaceholder')} />
        </label>
      </div>
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      <button type="button" onClick={add} disabled={busy || !from} className={`${secondary} mt-3`}>
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {t('addClosure')}
      </button>
      {closures.length > 0 && (
        <ul className="mt-4 space-y-2">
          {closures.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-100 px-3 py-2 text-sm">
              <span className="text-[var(--ink)]">
                <strong>{c.starts_on === c.ends_on ? dayLabel(c.starts_on, locale) : `${dayLabel(c.starts_on, locale)} – ${dayLabel(c.ends_on, locale)}`}</strong>
                {c.note ? ` · ${c.note}` : ''}
              </span>
              <button type="button" onClick={() => remove(c.id)} className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-700" aria-label={t('delete')}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
