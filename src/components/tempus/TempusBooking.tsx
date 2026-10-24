'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, CalendarPlus, CheckCircle2, ChevronLeft, ChevronRight, Clock3, LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { bookTempus, tempusAvailability, type TempusDay } from '@/app/actions/tempus'
import { addDays, bookingIcs, formatDuration, formatPrice, formatWhen, TEMPUS_DAYS_PER_PAGE, type Slot, type TempusService } from '@/lib/tempus'
import { card, field, label, primary, secondary } from './ui'

const dayLabel = (date: string, locale: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...opts, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))

type Done = { token: string; startsAt: string; endsAt: string; serviceName: string; email: string }

export default function TempusBooking(props: {
  slug: string
  businessName: string
  address: string
  timezone: string
  showPrices: boolean
  cancelLimitHours: number
  services: TempusService[]
  preview: boolean
  prefill: { name: string; email: string }
  locale: string
}) {
  const t = useTranslations('tempus')
  const { locale, timezone } = props
  const [service, setService] = useState<TempusService | null>(props.services.length === 1 ? props.services[0] : null)
  const [from, setFrom] = useState<string | undefined>(undefined)
  const [days, setDays] = useState<TempusDay[] | null>(null)
  const [more, setMore] = useState(false)
  const [day, setDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<Slot | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<Done | null>(null)

  // Orari liberi di 14 giorni per il servizio scelto
  useEffect(() => {
    if (!service) return
    let alive = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- caricamento degli orari del servizio scelto
    setLoading(true)
    tempusAvailability(props.slug, service.id, from).then((res) => {
      if (!alive) return
      setLoading(false)
      if (!res.success) return setDays([])
      setDays(res.days)
      setMore(res.more)
      setDay((current) => (current && res.days.some((d) => d.date === current && d.slots.length) ? current : (res.days.find((d) => d.slots.length)?.date ?? null)))
    })
    return () => {
      alive = false
    }
  }, [service, from, props.slug])

  if (done) return <BookingDone done={done} {...props} />

  if (!props.services.length) return <p className={`${card} text-[var(--muted)]`}>{t('noServicesPublic')}</p>

  // 1. Servizio
  if (!service)
    return (
      <div className={card}>
        <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('stepService')}</h2>
        <ul className="mt-4 space-y-2">
          {props.services.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setService(s)} className="flex w-full items-center justify-between gap-3 rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-left hover:border-[var(--gold)]">
                <span className="min-w-0">
                  <span className="block font-bold text-[var(--ink)]">{s.name}</span>
                  {s.description && <span className="mt-0.5 block text-sm text-[var(--muted)]">{s.description}</span>}
                </span>
                <span className="shrink-0 text-right text-sm text-[var(--muted)]">
                  <span className="flex items-center justify-end gap-1">
                    <Clock3 className="h-4 w-4" /> {formatDuration(s.duration_min)}
                  </span>
                  {props.showPrices && s.price_cents != null && <span className="block font-bold text-[var(--ink)]">{formatPrice(s.price_cents, locale)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    )

  const selectedDay = days?.find((d) => d.date === day)

  // 2. Giorno e ora — 3. Dati
  return (
    <div className="space-y-4">
      <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--gold)]">{t('yourChoice')}</p>
          <p className="font-extrabold text-[var(--ink)]">
            {service.name} · {formatDuration(service.duration_min)}
            {props.showPrices && service.price_cents != null ? ` · ${formatPrice(service.price_cents, locale)}` : ''}
          </p>
        </div>
        {props.services.length > 1 && (
          <button
            type="button"
            onClick={() => {
              setService(null)
              setSlot(null)
              setDays(null)
              setFrom(undefined)
            }}
            className={secondary}
          >
            <ArrowLeft className="h-4 w-4" /> {t('changeService')}
          </button>
        )}
      </div>

      {!slot ? (
        <div className={card}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('stepTime')}</h2>
            <div className="flex items-center gap-2">
              {loading && <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" />}
              <button type="button" onClick={() => setFrom(from ? addDays(from, -TEMPUS_DAYS_PER_PAGE) : undefined)} disabled={!from || loading} className={secondary} aria-label={t('earlier')}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => days?.length && setFrom(addDays(days[0].date, TEMPUS_DAYS_PER_PAGE))} disabled={!more || loading} className={secondary} aria-label={t('later')}>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
          {days && days.every((d) => !d.slots.length) && !loading ? (
            <p className="mt-4 text-sm text-[var(--muted)]">{more ? t('noSlotsTryLater') : t('noSlots')}</p>
          ) : (
            <>
              <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                {(days ?? []).map((d) => (
                  <button
                    key={d.date}
                    type="button"
                    disabled={!d.slots.length}
                    onClick={() => setDay(d.date)}
                    className={`flex min-w-16 shrink-0 flex-col items-center rounded-2xl border-2 px-3 py-2 text-sm ${
                      d.date === day ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : d.slots.length ? 'border-gray-200 bg-white text-[var(--ink)] hover:border-[var(--gold)]/60' : 'border-gray-100 bg-gray-50 text-gray-300'
                    }`}
                  >
                    <span className="text-xs font-semibold uppercase">{dayLabel(d.date, locale, { weekday: 'short' })}</span>
                    <span className="text-lg font-extrabold">{dayLabel(d.date, locale, { day: 'numeric' })}</span>
                    <span className="text-xs">{dayLabel(d.date, locale, { month: 'short' })}</span>
                  </button>
                ))}
              </div>
              {selectedDay && (
                <>
                  <p className="mt-4 font-bold first-letter:uppercase text-[var(--ink)]">{dayLabel(selectedDay.date, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">
                    {selectedDay.slots.map((s) => (
                      <button key={s.startsAt} type="button" onClick={() => setSlot(s)} className="min-h-12 rounded-xl border-2 border-gray-200 bg-white font-bold text-[var(--ink)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/10">
                        {s.time}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {timezone !== 'Europe/Rome' && <p className="mt-3 text-xs text-[var(--muted)]">{t('timezoneNote', { tz: timezone.replace('_', ' ') })}</p>}
        </div>
      ) : (
        <CustomerForm
          {...props}
          service={service}
          slot={slot}
          onBack={() => setSlot(null)}
          onTaken={() => {
            setSlot(null)
            setDays(null)
            setService({ ...service })
          }}
          onDone={setDone}
        />
      )}
    </div>
  )
}

function CustomerForm(props: {
  slug: string
  businessName: string
  timezone: string
  preview: boolean
  prefill: { name: string; email: string }
  locale: string
  service: TempusService
  slot: Slot
  onBack: () => void
  onTaken: () => void
  onDone: (d: Done) => void
}) {
  const t = useTranslations('tempus')
  const [name, setName] = useState(props.prefill.name)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState(props.prefill.email)
  const [note, setNote] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const res = await bookTempus({ slug: props.slug, serviceId: props.service.id, startsAt: props.slot.startsAt, name, phone, email, note, consent, website, locale: props.locale })
    setBusy(false)
    if (res.success) return props.onDone({ ...res, email: email.trim() })
    setError(t(`bookError_${res.reason}`))
    if (res.reason === 'slotTaken') setTimeout(props.onTaken, 1800)
  }

  return (
    <form onSubmit={submit} className={card}>
      <button type="button" onClick={props.onBack} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">
        <ArrowLeft className="h-4 w-4" /> {t('changeTime')}
      </button>
      <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('stepDetails')}</h2>
      <p className="mt-1 rounded-xl bg-[var(--gold-pale)] px-3 py-2 font-bold first-letter:uppercase text-[var(--ink)]">{formatWhen(props.slot.startsAt, props.timezone, props.locale)}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className={label}>
          {t('yourName')}
          <input required value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} className={field} autoComplete="name" />
        </label>
        <label className={label}>
          {t('yourPhone')}
          <input required type="tel" value={phone} onChange={(e) => setPhone(e.target.value.slice(0, 40))} className={field} autoComplete="tel" />
        </label>
        <label className={`${label} sm:col-span-2`}>
          {t('yourEmail')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value.slice(0, 160))} className={field} autoComplete="email" />
          <span className="mt-1 block text-xs font-normal text-[var(--muted)]">{t('emailHint')}</span>
        </label>
        <label className={`${label} sm:col-span-2`}>
          {t('yourNote')}
          <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 500))} rows={2} className={field} placeholder={t('yourNotePlaceholder')} />
        </label>
        {/* Campo trappola per i robot: le persone non lo vedono */}
        <input type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      </div>
      <label className="mt-4 flex items-start gap-2 text-sm text-[var(--ink)]">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]" />
        <span>
          {t('consent', { business: props.businessName })}{' '}
          <Link href="/privacy" target="_blank" className="font-semibold underline">
            {t('privacyLink')}
          </Link>
        </span>
      </label>
      {error && <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>}
      {props.preview && <p className="mt-3 text-sm font-semibold text-amber-800">{t('previewNoBooking')}</p>}
      <button type="submit" disabled={busy || !consent || props.preview || !name.trim() || phone.replace(/\D/g, '').length < 6} className={`${primary} mt-5 w-full`}>
        {busy && <LoaderCircle className="h-5 w-5 animate-spin" />}
        {t('confirmBooking')}
      </button>
    </form>
  )
}

function BookingDone({ done, businessName, address, timezone, cancelLimitHours, locale }: { done: Done; businessName: string; address: string; timezone: string; cancelLimitHours: number; locale: string }) {
  const t = useTranslations('tempus')
  const manage = `/prenota/disdici/${done.token}`

  const addToCalendar = () => {
    const ics = bookingIcs({ uid: done.token.slice(0, 24), startsAt: done.startsAt, endsAt: done.endsAt, title: `${done.serviceName} – ${businessName}`, location: address })
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'prenotazione.ics'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className={`${card} text-center`}>
      <CheckCircle2 className="mx-auto h-14 w-14 text-green-600" />
      <h2 className="mt-3 text-2xl font-extrabold text-[var(--ink)]">{t('doneTitle')}</h2>
      <p className="mt-2 text-[var(--muted)]">{t('doneText', { business: businessName })}</p>
      <p className="mx-auto mt-4 max-w-md rounded-2xl bg-[var(--gold-pale)] px-4 py-3 font-bold first-letter:uppercase text-[var(--ink)]">
        {done.serviceName}
        <br />
        {formatWhen(done.startsAt, timezone, locale)}
      </p>
      <p className="mt-4 text-sm text-[var(--muted)]">{done.email ? t('doneEmail', { email: done.email }) : t('doneNoEmail')}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={addToCalendar} className={secondary}>
          <CalendarPlus className="h-4 w-4" /> {t('addToCalendar')}
        </button>
        <Link href={manage} className={secondary}>
          {t('manageBooking')}
        </Link>
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">{cancelLimitHours ? t('cancelRulePublic', { hours: cancelLimitHours }) : t('cancelAnytimePublic')}</p>
    </div>
  )
}
