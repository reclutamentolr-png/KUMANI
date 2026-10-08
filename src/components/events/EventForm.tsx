'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Euro, Gift, LoaderCircle, Lock, Repeat, ShieldCheck, Stamp } from 'lucide-react'
import { saveEvent, type EventFormInput } from '@/app/actions/events'
import {
  EVENT_COUNTRIES,
  EVENT_LANGUAGES,
  EVENT_MAX_SERIES_DATES,
  EVENT_MODES,
  EVENT_REPEATS,
  EVENT_TIMEZONES,
  EVENT_TYPES,
  EVENT_TYPE_EMOJI,
  countryName,
  languageName,
  utcToZoned,
  type OrganizedEvent,
  type OrganizerStatus,
} from '@/lib/events'
import BusinessProfileImport from '@/components/businessProfile/BusinessProfileImport'
import type { BusinessProfile } from '@/lib/businessProfile'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'

const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'
const hint = 'mt-1 text-xs text-[var(--muted)]'

// Fuso proposto per un nuovo evento: quello del browser se è tra quelli
// previsti, altrimenti Europe/Rome.
function defaultTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if ((EVENT_TIMEZONES as readonly string[]).includes(tz)) return tz
  } catch {
    // fuso non disponibile: si usa quello italiano
  }
  return 'Europe/Rome'
}

// Evento esistente → valori del modulo (date e ore nel fuso dell'evento).
function fromEvent(event: OrganizedEvent): EventFormInput {
  const start = utcToZoned(event.starts_at, event.timezone)
  const end = event.ends_at ? utcToZoned(event.ends_at, event.timezone) : null
  return {
    title: event.title,
    description: event.description,
    type: event.type,
    mode: event.mode,
    date: start.date,
    time: start.time,
    endDate: end ? end.date : '',
    endTime: end ? end.time : '',
    timezone: event.timezone,
    venueName: event.venue_name ?? '',
    // Indirizzo e link sono privati: arrivano a parte da getEvent ("initial")
    address: '',
    city: event.city ?? '',
    countryCode: event.country_code ?? 'IT',
    mapLink: '',
    onlineLink: '',
    languages: event.languages,
    capacity: String(event.capacity),
    price: event.price > 0 ? String(event.price) : '',
    // Evento gratuito già salvato: la dichiarazione risulta già data
    free: !(event.price > 0),
    freeDeclared: !(event.price > 0),
    is18plus: event.is_18plus,
    kidsFriendly: event.kids_friendly,
    rulesAccepted: false,
    repeat: 'none',
    repeatCount: '4',
    fidelityStamp: !!event.fidelity_stamp,
    applyToSeries: false,
  }
}

function emptyForm(locale: string, hasCard: boolean): EventFormInput {
  return {
    title: '',
    description: '',
    type: 'meetup',
    mode: 'in_person',
    date: '',
    time: '',
    endDate: '',
    endTime: '',
    timezone: defaultTimezone(),
    venueName: '',
    address: '',
    city: '',
    countryCode: 'IT',
    mapLink: '',
    onlineLink: '',
    languages: (EVENT_LANGUAGES as readonly string[]).includes(locale) ? [locale] : ['it'],
    capacity: '20',
    price: '',
    free: true,
    freeDeclared: false,
    is18plus: false,
    kidsFriendly: false,
    rulesAccepted: false,
    repeat: 'none',
    repeatCount: '4',
    fidelityStamp: hasCard,
    applyToSeries: false,
  }
}

// Modulo di creazione / modifica di un evento. Le regole vere (posti massimi,
// approvazione, commissioni) le applica event_save: qui solo aiuti e messaggi.
export default function EventForm({
  event,
  initial,
  maxCapacity,
  feePercent,
  freeFee = 0,
  fidelityCard,
  businessProfile = null,
  onSaved,
}: {
  event?: OrganizedEvent | null
  // Dati privati (indirizzo e link) letti con getEvent per la modifica
  initial?: Partial<Pick<EventFormInput, 'address' | 'mapLink' | 'onlineLink'>>
  maxCapacity: number
  feePercent: number
  // Quota fissa KUMANI per iscritto sugli eventi gratuiti (0 = nessuna commissione)
  freeFee?: number
  // Kumi Card attiva dell'organizzatore: abilita il timbro a chi entra
  fidelityCard?: OrganizerStatus['fidelity_card']
  // Scheda attività: per un nuovo evento il luogo si può riprendere da lì
  businessProfile?: BusinessProfile | null
  onSaved: (result: { id: string; status: string; dates?: number }) => void
}) {
  const t = useTranslations('eventsOrganizer')
  const te = useTranslations('events')
  const locale = useLocale()
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(value)
  const [form, setForm] = useState<EventFormInput>(() => (event ? { ...fromEvent(event), ...initial } : emptyForm(locale, !!fidelityCard)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof EventFormInput>(key: K, value: EventFormInput[K]) => setForm((f) => ({ ...f, [key]: value }))
  const priceLocked = !!event && event.people > 0
  const needsPlace = form.mode !== 'online'
  const needsLink = form.mode !== 'in_person'

  // «Usa i dati della Scheda attività» (solo a richiesta: il luogo può essere un altro)
  const importBusinessProfile = (p: BusinessProfile) => {
    const address = [p.address, p.postalCode].filter(Boolean).join(', ')
    setForm((f) => ({
      ...f,
      venueName: p.companyName ? p.companyName.slice(0, 120) : f.venueName,
      address: address ? address.slice(0, 200) : f.address,
      city: p.city ? p.city.slice(0, 80) : f.city,
    }))
  }

  const toggleLanguage = (code: string) =>
    setForm((f) => ({ ...f, languages: f.languages.includes(code) ? f.languages.filter((l) => l !== code) : [...f.languages, code] }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.languages.length === 0) return setError(t('error_languages'))
    if (!form.rulesAccepted) return setError(t('error_rules'))
    if (needsLink && !form.onlineLink.trim()) return setError(t('error_online_link'))
    if (!priceLocked && form.free && !form.freeDeclared) return setError(t('error_free_declaration'))
    setBusy(true)
    setError(null)
    const result = await saveEvent(event?.id ?? null, form)
    setBusy(false)
    if (result.error || !result.id) {
      const code = result.error ?? 'saveError'
      setError(code === 'capacity' ? t('error_capacity', { max: result.max ?? maxCapacity }) : t.has(`error_${code}`) ? t(`error_${code}`) : t('error_saveError'))
      return
    }
    onSaved({ id: result.id, status: result.status ?? 'pending', dates: result.dates })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={label}>{t('fieldTitle')}</label>
        <input className={input} value={form.title} minLength={3} maxLength={100} required placeholder={t('fieldTitlePlaceholder')} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div>
        <label className={label}>{t('fieldDescription')}</label>
        <textarea
          className={input}
          rows={5}
          value={form.description}
          minLength={10}
          maxLength={3000}
          required
          placeholder={t('fieldDescriptionPlaceholder')}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>

      <div>
        <label className={label}>{t('fieldType')}</label>
        <div className="flex flex-wrap gap-2">
          {EVENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => set('type', type)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
                form.type === type ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              {EVENT_TYPE_EMOJI[type]} {te(`type_${type}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={label}>{t('fieldMode')}</label>
        <div className="grid grid-cols-3 gap-2">
          {EVENT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => set('mode', mode)}
              className={`rounded-xl border px-2 py-2 text-sm font-semibold ${
                form.mode === mode ? 'border-[var(--ink)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {te(`mode_${mode}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t('fieldDate')}</label>
          <input type="date" className={input} value={form.date} required onChange={(e) => set('date', e.target.value)} />
        </div>
        <div>
          <label className={label}>{t('fieldTime')}</label>
          <input type="time" className={input} value={form.time} required onChange={(e) => set('time', e.target.value)} />
        </div>
        <div>
          <label className={label}>{t('fieldEndDate')}</label>
          <input type="date" className={input} value={form.endDate} min={form.date || undefined} onChange={(e) => set('endDate', e.target.value)} />
        </div>
        <div>
          <label className={label}>{t('fieldEndTime')}</label>
          <input type="time" className={input} value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
        </div>
      </div>
      <p className={hint}>{t('fieldEndHint')}</p>

      {/* Date ripetute: solo alla creazione, ogni data è poi un evento a sé */}
      {!event && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <label className={`${label} flex items-center gap-1.5`}>
            <Repeat className="h-4 w-4 text-[var(--gold)]" /> {t('fieldRepeat')}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {EVENT_REPEATS.map((repeat) => (
              <button
                key={repeat}
                type="button"
                onClick={() => set('repeat', repeat)}
                className={`rounded-xl border px-2 py-2 text-sm font-semibold ${
                  form.repeat === repeat ? 'border-[var(--ink)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-gray-200 bg-white text-gray-600'
                }`}
              >
                {t(`repeat_${repeat}`)}
              </button>
            ))}
          </div>
          {form.repeat !== 'none' && (
            <div className="mt-3">
              <label className={label}>{t('fieldRepeatCount')}</label>
              <input
                type="number"
                inputMode="numeric"
                className={input}
                min={2}
                max={EVENT_MAX_SERIES_DATES}
                required
                value={form.repeatCount}
                onChange={(e) => set('repeatCount', e.target.value)}
              />
              <p className={hint}>{t('fieldRepeatHint', { max: EVENT_MAX_SERIES_DATES })}</p>
            </div>
          )}
        </div>
      )}

      <div>
        <label className={label}>{t('fieldTimezone')}</label>
        <select className={input} value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
          {!(EVENT_TIMEZONES as readonly string[]).includes(form.timezone) && <option value={form.timezone}>{form.timezone}</option>}
          {EVENT_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        <p className={hint}>{t('fieldTimezoneHint')}</p>
      </div>

      {needsPlace && (
        <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          {!event && <BusinessProfileImport profile={businessProfile} onImport={importBusinessProfile} />}
          <div>
            <label className={label}>{t('fieldVenue')}</label>
            <input className={input} value={form.venueName} maxLength={120} placeholder={t('fieldVenuePlaceholder')} onChange={(e) => set('venueName', e.target.value)} />
          </div>
          <div>
            <label className={label}>{t('fieldAddress')}</label>
            <input className={input} value={form.address} maxLength={200} onChange={(e) => set('address', e.target.value)} />
            <p className={`${hint} flex items-center gap-1`}>
              <Lock className="h-3 w-3" /> {t('fieldAddressHint')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>{t('fieldCity')}</label>
              <input className={input} value={form.city} maxLength={80} required onChange={(e) => set('city', e.target.value)} />
            </div>
            <div>
              <label className={label}>{t('fieldCountry')}</label>
              <select className={input} value={form.countryCode} onChange={(e) => set('countryCode', e.target.value)}>
                {EVENT_COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {countryName(code, locale)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={label}>{t('fieldMapLink')}</label>
            <input className={input} value={form.mapLink} maxLength={500} placeholder="https://maps.google.com/…" onChange={(e) => set('mapLink', e.target.value)} />
          </div>
        </div>
      )}

      {needsLink && (
        <div>
          <label className={label}>{t('fieldOnlineLink')}</label>
          <input className={input} value={form.onlineLink} maxLength={500} required placeholder="https://meet…" onChange={(e) => set('onlineLink', e.target.value)} />
          <p className={`${hint} flex items-center gap-1`}>
            <Lock className="h-3 w-3" /> {t('fieldOnlineLinkHint')}
          </p>
        </div>
      )}

      <div>
        <label className={label}>{t('fieldLanguages')}</label>
        <div className="flex flex-wrap gap-2">
          {EVENT_LANGUAGES.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => toggleLanguage(code)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold capitalize ${
                form.languages.includes(code) ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              {languageName(code, locale)}
            </button>
          ))}
        </div>
        <p className={hint}>{t('fieldLanguagesHint')}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className={label}>{t('fieldCapacity')}</label>
          <input type="number" inputMode="numeric" className={input} min={1} max={maxCapacity} required value={form.capacity} onChange={(e) => set('capacity', e.target.value)} />
          <p className={hint}>{t('fieldCapacityHint', { max: maxCapacity })}</p>
        </div>
      </div>

      {/* Gratuito / a pagamento: dopo le prime iscrizioni non si cambia più */}
      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
        <label className={`${label} flex items-center gap-1.5`}>
          <Euro className="h-4 w-4 text-[var(--gold)]" /> {t('fieldPriceMode')}
        </label>
        <div role="radiogroup" aria-label={t('fieldPriceMode')} className="grid grid-cols-2 gap-1 rounded-xl bg-gray-200/70 p-1">
          {([true, false] as const).map((free) => (
            <button
              key={String(free)}
              type="button"
              role="radio"
              aria-checked={form.free === free}
              disabled={priceLocked}
              onClick={() => set('free', free)}
              className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed ${
                form.free === free
                  ? free
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-[var(--ink)] text-white shadow-sm'
                  : 'text-gray-600 hover:bg-white/70 disabled:hover:bg-transparent'
              }`}
            >
              {free ? <Gift className="h-4 w-4" /> : <Euro className="h-4 w-4" />} {free ? t('priceModeFree') : t('priceModePaid')}
            </button>
          ))}
        </div>
        {priceLocked && (
          <p className={`${hint} flex items-center gap-1`}>
            <Lock className="h-3 w-3" /> {t('fieldPriceLocked')}
          </p>
        )}

        {form.free ? (
          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-white p-3 text-sm text-gray-800">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-emerald-600"
                checked={form.freeDeclared}
                disabled={priceLocked}
                required={!priceLocked}
                onChange={(e) => set('freeDeclared', e.target.checked)}
              />
              <span className="font-semibold">{t('freeDeclaration')}</span>
            </label>
            <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold leading-5 text-emerald-800">
              {freeFee > 0 ? t('freeFeeNotice', { fee: money(freeFee) }) : t('freeNoFee')}
            </p>
          </div>
        ) : (
          <div className="mt-3">
            <label className={label}>{t('fieldPrice')}</label>
            <input
              inputMode="decimal"
              className={input}
              value={form.price}
              disabled={priceLocked}
              required={!priceLocked}
              maxLength={8}
              placeholder="10"
              onChange={(e) => set('price', e.target.value.replace(/[^0-9.,]/g, ''))}
            />
            <p className={hint}>{t('fieldPricePaidHint')}</p>
            <p className="mt-2 rounded-xl bg-[var(--gold-pale)]/50 px-3 py-2 text-xs leading-5 text-gray-700">{t('priceExplain', { percent: feePercent })}</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--ink)]" checked={form.is18plus} onChange={(e) => set('is18plus', e.target.checked)} />
          <span>
            <strong className="block text-[var(--ink)]">{t('field18plus')}</strong>
            {t('field18plusHint')}
          </span>
        </label>
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--ink)]" checked={form.kidsFriendly} onChange={(e) => set('kidsFriendly', e.target.checked)} />
          <span>
            <strong className="block text-[var(--ink)]">{t('fieldKids')}</strong>
            {t('fieldKidsHint')}
          </span>
        </label>
      </div>

      {(fidelityCard || form.fidelityStamp) && (
        <label className="flex items-start gap-3 rounded-xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 p-4 text-sm text-gray-700">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--ink)]"
            checked={form.fidelityStamp}
            disabled={!fidelityCard}
            onChange={(e) => set('fidelityStamp', e.target.checked)}
          />
          <span>
            <strong className="flex items-center gap-1.5 text-[var(--ink)]">
              <Stamp className="h-4 w-4 text-[var(--gold)]" /> {t('fieldFidelity')}
            </strong>
            {fidelityCard
              ? t('fieldFidelityHint', { business: fidelityCard.business_name, prize: fidelityCard.prize, stamps: fidelityCard.stamps_needed })
              : t('fieldFidelityInactive')}
          </span>
        </label>
      )}

      {event?.series_id && (
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/60 p-4 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--ink)]" checked={form.applyToSeries} onChange={(e) => set('applyToSeries', e.target.checked)} />
          <span>
            <strong className="block text-[var(--ink)]">{t('fieldApplyToSeries')}</strong>
            {t('fieldApplyToSeriesHint')}
          </span>
        </label>
      )}

      <div className="rounded-xl border border-[var(--gold)]/30 bg-white p-4 text-xs leading-5 text-gray-600">
        <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-gray-800">
          <ShieldCheck className="h-4 w-4 text-[var(--gold)]" /> {t('conductTitle')}
        </p>
        <ul className="list-disc space-y-1 pl-4">
          <li>{t('conduct1')}</li>
          <li>{t('conduct2')}</li>
          <li>{t('conduct3')}</li>
          <li>{t('conduct4')}</li>
          <li>{t('conduct5')}</li>
          <li>{t('conduct6')}</li>
        </ul>
        <label className="mt-3 flex items-start gap-2 text-sm font-semibold text-gray-800">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--gold)]" checked={form.rulesAccepted} onChange={(e) => set('rulesAccepted', e.target.checked)} />
          {t('conductAccept')}
        </label>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <div className="flex gap-2">
        <CancelButton className={cancelButtonLgClass} />
        <button
          type="submit"
          disabled={busy || !form.rulesAccepted}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-60"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {event ? t('saveChanges') : form.repeat !== 'none' ? t('createSeriesCta', { count: Number.parseInt(form.repeatCount, 10) || 0 }) : t('createCta')}
        </button>
      </div>
      {!event && <p className="text-center text-xs text-[var(--muted)]">{maxCapacity <= 20 ? t('createNoteNew') : t('createNoteTrusted')}</p>}
    </form>
  )
}
