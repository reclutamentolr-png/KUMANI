'use client'

import { useMemo, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { ChevronLeft, ChevronRight, LoaderCircle, Mail, MessageCircle, Phone, Plus, StickyNote, Trash2, UserX, X } from 'lucide-react'
import { addManualBooking, deleteTempusBooking, saveTempusOwnerNote, setTempusBookingStatus, tempusAgenda } from '@/app/actions/tempus'
import { askConfirm } from '@/lib/confirm'
import { utcToZoned } from '@/lib/events'
import { addDays, formatPrice, formatWhen, isPast, mondayOf, phoneDigits, todayIn, type TempusBooking, type TempusService, type TempusSettings } from '@/lib/tempus'
import { card, chip, field, label, primary, secondary } from './ui'

// Giorno 'YYYY-MM-DD' scritto per esteso (senza spostamenti di fuso)
const dayLabel = (date: string, locale: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))

export default function TempusAgenda({
  settings,
  services,
  initialBookings,
  initialWeek,
}: {
  settings: TempusSettings
  services: TempusService[]
  initialBookings: TempusBooking[]
  initialWeek: string
}) {
  const t = useTranslations('tempus')
  const locale = useLocale()
  const tz = settings.timezone
  const [week, setWeek] = useState(initialWeek)
  const [bookings, setBookings] = useState(initialBookings)
  const [loading, setLoading] = useState(false)
  const [showCancelled, setShowCancelled] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const today = todayIn(tz)

  const goTo = async (monday: string) => {
    setLoading(true)
    const res = await tempusAgenda(monday)
    setLoading(false)
    if (res.success) {
      setWeek(monday)
      setBookings(res.bookings)
    }
  }

  const days = useMemo(() => {
    const byDay = new Map<string, TempusBooking[]>()
    for (const b of bookings) {
      if (!showCancelled && b.status === 'cancelled') continue
      const day = utcToZoned(b.starts_at, tz).date
      byDay.set(day, [...(byDay.get(day) ?? []), b])
    }
    return Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((date) => ({ date, items: byDay.get(date) ?? [] }))
  }, [bookings, week, tz, showCancelled])

  const active = bookings.filter((b) => b.status === 'confirmed').length
  const update = (b: TempusBooking) => setBookings((list) => list.map((x) => (x.id === b.id ? b : x)))

  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => goTo(addDays(week, -7))} className={secondary} aria-label={t('prevWeek')}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button type="button" onClick={() => goTo(mondayOf(today))} className={secondary} disabled={week === mondayOf(today)}>
            {t('thisWeek')}
          </button>
          <button type="button" onClick={() => goTo(addDays(week, 7))} className={secondary} aria-label={t('nextWeek')}>
            <ChevronRight className="h-5 w-5" />
          </button>
          {loading && <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" />}
        </div>
        <div className="text-right">
          <p className="font-extrabold text-[var(--ink)]">
            {dayLabel(week, locale, { day: 'numeric', month: 'short' })} – {dayLabel(addDays(week, 6), locale, { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
          <p className="text-sm text-[var(--muted)]">{t('weekCount', { count: active })}</p>
        </div>
        <label className="flex w-full items-center gap-2 text-sm text-[var(--muted)]">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
          {t('showCancelled')}
        </label>
      </div>

      {days.map(({ date, items }) => (
        <section key={date} className={`${card} ${date === today ? 'ring-2 ring-[var(--gold)]' : ''}`}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-extrabold capitalize text-[var(--ink)]">
              {dayLabel(date, locale, { weekday: 'long', day: 'numeric', month: 'long' })}
              {date === today && <span className="ml-2 rounded-full bg-[var(--gold)]/20 px-2 py-0.5 text-xs font-bold normal-case">{t('today')}</span>}
            </h3>
            {services.length > 0 && date >= today && (
              <button type="button" onClick={() => setAdding(adding === date ? null : date)} className={secondary}>
                <Plus className="h-4 w-4" /> {t('addBooking')}
              </button>
            )}
          </div>
          {adding === date && (
            <ManualBookingForm
              date={date}
              services={services}
              onCancel={() => setAdding(null)}
              onAdded={(b) => {
                setBookings((list) => [...list, b].sort((x, y) => x.starts_at.localeCompare(y.starts_at)))
                setAdding(null)
              }}
            />
          )}
          {items.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--muted)]">{t('noBookings')}</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {items.map((b) => (
                <BookingCard key={b.id} booking={b} settings={settings} onChange={update} onDelete={() => setBookings((list) => list.filter((x) => x.id !== b.id))} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

function BookingCard({ booking: b, settings, onChange, onDelete }: { booking: TempusBooking; settings: TempusSettings; onChange: (b: TempusBooking) => void; onDelete: () => void }) {
  const t = useTranslations('tempus')
  const locale = useLocale()
  const [cancelling, setCancelling] = useState(false)
  const [message, setMessage] = useState('')
  const [note, setNote] = useState(b.owner_note ?? '')
  const [editingNote, setEditingNote] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const time = (iso: string) => formatWhen(iso, settings.timezone, locale, { hour: '2-digit', minute: '2-digit' })
  const digits = phoneDigits(b.customer_phone)
  const past = isPast(b.starts_at)

  const setStatus = async (status: 'cancelled' | 'no_show' | 'confirmed') => {
    setBusy(true)
    setError('')
    const res = await setTempusBookingStatus(b.id, status, message)
    setBusy(false)
    if (!res.success) return setError(t(`error_${res.message ?? 'saveError'}`))
    onChange({ ...b, status, cancelled_by: status === 'cancelled' ? 'owner' : null })
    setCancelling(false)
  }

  const saveNote = async () => {
    setBusy(true)
    const res = await saveTempusOwnerNote(b.id, note)
    setBusy(false)
    if (res.success) {
      onChange({ ...b, owner_note: note.trim() || null })
      setEditingNote(false)
    }
  }

  const remove = async () => {
    if (!(await askConfirm(t('deleteBookingConfirm')))) return
    if ((await deleteTempusBooking(b.id)).success) onDelete()
  }

  const muted = b.status !== 'confirmed'
  return (
    <li className={`rounded-2xl border p-4 ${muted ? 'border-gray-200 bg-gray-50' : 'border-[var(--gold)]/30 bg-[var(--paper)]'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={`text-lg font-extrabold text-[var(--ink)] ${b.status === 'cancelled' ? 'line-through opacity-60' : ''}`}>
            {time(b.starts_at)}–{time(b.ends_at)} · {b.customer_name}
          </p>
          <p className="text-sm text-[var(--muted)]">
            {b.service_name}
            {b.price_cents != null && settings.show_prices ? ` · ${formatPrice(b.price_cents, locale)}` : ''}
            {' · '}
            {b.source === 'online' ? t('sourceOnline') : t('sourceManual')}
          </p>
        </div>
        {b.status !== 'confirmed' && (
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${b.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-900'}`}>
            {b.status === 'cancelled' ? (b.cancelled_by === 'customer' ? t('cancelledByCustomer') : t('cancelledByYou')) : t('noShow')}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {digits && (
          <>
            <a href={`tel:${digits}`} className={secondary}>
              <Phone className="h-4 w-4" /> {b.customer_phone}
            </a>
            <a href={`https://wa.me/${digits.replace(/^\+/, '')}`} target="_blank" rel="noopener noreferrer" className={secondary}>
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </>
        )}
        {b.customer_email && (
          <a href={`mailto:${b.customer_email}`} className={secondary}>
            <Mail className="h-4 w-4" /> {b.customer_email}
          </a>
        )}
      </div>
      {b.customer_note && <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-[var(--ink)]">«{b.customer_note}»</p>}

      {editingNote ? (
        <div className="mt-3">
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} className={field} placeholder={t('ownerNotePlaceholder')} />
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={saveNote} disabled={busy} className={secondary}>
              {t('save')}
            </button>
            <button type="button" onClick={() => setEditingNote(false)} className={secondary}>
              {t('close')}
            </button>
          </div>
        </div>
      ) : b.owner_note ? (
        <button type="button" onClick={() => setEditingNote(true)} className="mt-3 flex w-full items-start gap-2 rounded-xl bg-white px-3 py-2 text-left text-sm text-[var(--ink)]">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {b.owner_note}
        </button>
      ) : null}

      {cancelling ? (
        <div className="mt-3 rounded-xl border-2 border-red-200 bg-white p-3">
          <label className={label}>
            {b.customer_email ? t('cancelMessageLabel') : t('cancelNoEmail')}
            {b.customer_email && <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, 300))} rows={2} className={field} placeholder={t('cancelMessagePlaceholder')} />}
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => setStatus('cancelled')} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 text-sm font-bold text-white disabled:opacity-50">
              {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('confirmCancel')}
            </button>
            <button type="button" onClick={() => setCancelling(false)} className={secondary}>
              {t('close')}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {!editingNote && (
            <button type="button" onClick={() => setEditingNote(true)} className={secondary}>
              <StickyNote className="h-4 w-4" /> {b.owner_note ? t('editNote') : t('addNote')}
            </button>
          )}
          {b.status === 'confirmed' && !past && (
            <button type="button" onClick={() => setCancelling(true)} className={secondary}>
              <X className="h-4 w-4" /> {t('cancelBooking')}
            </button>
          )}
          {b.status === 'confirmed' && past && (
            <button type="button" onClick={() => setStatus('no_show')} disabled={busy} className={secondary}>
              <UserX className="h-4 w-4" /> {t('markNoShow')}
            </button>
          )}
          {b.status === 'no_show' && (
            <button type="button" onClick={() => setStatus('confirmed')} disabled={busy} className={secondary}>
              {t('undoNoShow')}
            </button>
          )}
          {b.status === 'cancelled' && (
            <button type="button" onClick={remove} className={secondary}>
              <Trash2 className="h-4 w-4" /> {t('deleteBooking')}
            </button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
    </li>
  )
}

function ManualBookingForm({ date, services, onCancel, onAdded }: { date: string; services: TempusService[]; onCancel: () => void; onAdded: (b: TempusBooking) => void }) {
  const t = useTranslations('tempus')
  const [serviceId, setServiceId] = useState(services.find((s) => s.active)?.id ?? services[0]?.id ?? '')
  const [day, setDay] = useState(date)
  const [time, setTime] = useState('09:00')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [sendEmail, setSendEmail] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setBusy(true)
    setError('')
    const res = await addManualBooking({ serviceId, date: day, time, name, phone, email, note, sendEmail })
    setBusy(false)
    if (res.success) onAdded(res.booking)
    else setError(t(`error_${res.message}`))
  }

  return (
    <div className="mt-4 rounded-2xl border-2 border-[var(--gold)]/40 bg-[var(--gold-pale)] p-4">
      <p className="font-bold text-[var(--ink)]">{t('manualTitle')}</p>
      <p className="mt-0.5 text-sm text-[var(--muted)]">{t('manualText')}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className={`${label} sm:col-span-2`}>
          {t('service')}
          <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className={field}>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.duration_min} min){s.active ? '' : ` – ${t('hidden')}`}
              </option>
            ))}
          </select>
        </label>
        <label className={label}>
          {t('date')}
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)} className={field} />
        </label>
        <label className={label}>
          {t('time')}
          <input type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} className={field} />
        </label>
        <label className={label}>
          {t('customerName')}
          <input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className={field} autoComplete="off" />
        </label>
        <label className={label}>
          {t('customerPhone')}
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 40))} className={field} autoComplete="off" />
        </label>
        <label className={`${label} sm:col-span-2`}>
          {t('customerEmailOptional')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 160))} className={field} autoComplete="off" />
        </label>
        <label className={`${label} sm:col-span-2`}>
          {t('noteOptional')}
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} className={field} />
        </label>
      </div>
      {email && (
        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--ink)]">
          <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 accent-[var(--gold)]" />
          {t('sendConfirmation')}
        </label>
      )}
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={busy || !name.trim() || !serviceId} className={primary}>
          {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
          {t('saveBooking')}
        </button>
        <button type="button" onClick={onCancel} className={`${chip(false)} px-4`}>
          {t('close')}
        </button>
      </div>
    </div>
  )
}
