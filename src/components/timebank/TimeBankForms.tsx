'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import { proposeTimebankExchange, saveTimebankPost, saveTimebankProfile } from '@/app/actions/timebank'
import {
  TIMEBANK_CATEGORIES,
  TIMEBANK_CATEGORY_EMOJI,
  TIMEBANK_LANGUAGES,
  type TimebankPost,
  type TimebankProfileData,
} from '@/lib/timebank'
import { EVENT_COUNTRIES, countryName, languageName } from '@/lib/events'

export const inputClass =
  'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const labelClass = 'mb-1 block text-sm font-semibold text-gray-700'
const hintClass = 'mt-1 text-xs text-[var(--muted)]'
const primary =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-60'

function Chips<T extends string>({ values, selected, onToggle, label }: { values: readonly T[]; selected: T[]; onToggle: (v: T) => void; label: (v: T) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => onToggle(value)}
          className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
            selected.includes(value) ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-gray-200 bg-white text-gray-700'
          }`}
        >
          {label(value)}
        </button>
      ))}
    </div>
  )
}

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

// Profilo della banca: cosa offro, cosa cerco, dove e quando
export function ProfileForm({ initial, onSaved }: { initial: TimebankProfileData | null; onSaved: () => void }) {
  const t = useTranslations('timebank')
  const locale = useLocale()
  const [offers, setOffers] = useState<string[]>(initial?.offers ?? [])
  const [seeks, setSeeks] = useState<string[]>(initial?.seeks ?? [])
  const [bio, setBio] = useState(initial?.bio ?? '')
  const [city, setCity] = useState(initial?.city ?? '')
  const [countryCode, setCountryCode] = useState(initial?.country_code ?? 'IT')
  const [inPerson, setInPerson] = useState(initial?.in_person ?? true)
  const [online, setOnline] = useState(initial?.online ?? true)
  const [languages, setLanguages] = useState<string[]>(initial?.languages?.length ? initial.languages : [locale])
  const [availability, setAvailability] = useState(initial?.availability ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const catLabel = (c: string) => `${TIMEBANK_CATEGORY_EMOJI[c as keyof typeof TIMEBANK_CATEGORY_EMOJI] ?? ''} ${t(`cat_${c}`)}`

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (offers.length === 0) return setError(t('error_offers'))
    setBusy(true)
    setError(null)
    const result = await saveTimebankProfile({ offers, seeks, bio, city, countryCode, inPerson, online, languages, availability })
    setBusy(false)
    if (result !== 'ok') return setError(t.has(`error_${result}`) ? t(`error_${result}`) : t('error_saveError'))
    onSaved()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={labelClass}>{t('fieldOffers')}</label>
        <Chips values={TIMEBANK_CATEGORIES} selected={offers as never[]} onToggle={(v) => setOffers((l) => toggle(l, v))} label={catLabel} />
      </div>
      <div>
        <label className={labelClass}>{t('fieldSeeks')}</label>
        <Chips values={TIMEBANK_CATEGORIES} selected={seeks as never[]} onToggle={(v) => setSeeks((l) => toggle(l, v))} label={catLabel} />
      </div>
      <div>
        <label className={labelClass}>{t('fieldBio')}</label>
        <textarea className={inputClass} rows={3} maxLength={500} value={bio} placeholder={t('fieldBioPlaceholder')} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t('fieldCity')}</label>
          <input className={inputClass} maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>{t('fieldCountry')}</label>
          <select className={inputClass} value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
            {EVENT_COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {countryName(code, locale)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-gray-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={inPerson} onChange={(e) => setInPerson(e.target.checked)} /> {t('mode_in_person')}
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={online} onChange={(e) => setOnline(e.target.checked)} /> {t('mode_online')}
        </label>
      </div>
      <div>
        <label className={labelClass}>{t('fieldLanguages')}</label>
        <Chips values={TIMEBANK_LANGUAGES} selected={languages as never[]} onToggle={(v) => setLanguages((l) => toggle(l, v))} label={(l) => languageName(l, locale)} />
      </div>
      <div>
        <label className={labelClass}>{t('fieldAvailability')}</label>
        <input className={inputClass} maxLength={120} value={availability} placeholder={t('fieldAvailabilityPlaceholder')} onChange={(e) => setAvailability(e.target.value)} />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className={primary}>
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {initial ? t('saveProfile') : t('joinCta')}
      </button>
    </form>
  )
}

// Nuova richiesta o offerta in bacheca
export function PostForm({ kind, defaults, onSaved }: { kind: 'request' | 'offer'; defaults: TimebankProfileData | null; onSaved: () => void }) {
  const t = useTranslations('timebank')
  const locale = useLocale()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<string>(kind === 'offer' ? defaults?.offers?.[0] ?? 'other' : defaults?.seeks?.[0] ?? 'other')
  const [hours, setHours] = useState('1')
  const [mode, setMode] = useState<'in_person' | 'online' | 'both'>('in_person')
  const [city, setCity] = useState(defaults?.city ?? '')
  const [languages, setLanguages] = useState<string[]>(defaults?.languages?.length ? defaults.languages : [locale])
  const [whenText, setWhenText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await saveTimebankPost(null, {
      kind,
      title,
      description,
      category,
      hours,
      mode,
      city,
      countryCode: defaults?.country_code ?? '',
      languages,
      whenText,
    })
    setBusy(false)
    if (result.error || !result.id) {
      const code = result.error ?? 'saveError'
      return setError(t.has(`error_${code}`) ? t(`error_${code}`) : t('error_saveError'))
    }
    onSaved()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="rounded-xl bg-[var(--gold-pale)]/50 px-3 py-2 text-xs leading-5 text-gray-700">{kind === 'request' ? t('requestIntro') : t('offerIntro')}</p>
      <div>
        <label className={labelClass}>{t('fieldTitle')}</label>
        <input
          className={inputClass}
          required
          minLength={3}
          maxLength={100}
          value={title}
          placeholder={kind === 'request' ? t('requestTitlePlaceholder') : t('offerTitlePlaceholder')}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div>
        <label className={labelClass}>{t('fieldDescription')}</label>
        <textarea className={inputClass} rows={4} required minLength={10} maxLength={1500} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t('fieldCategory')}</label>
          <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {TIMEBANK_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {TIMEBANK_CATEGORY_EMOJI[c]} {t(`cat_${c}`)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('fieldHours')}</label>
          <select className={inputClass} value={hours} onChange={(e) => setHours(e.target.value)}>
            {['0.5', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '8'].map((h) => (
              <option key={h} value={h}>
                {t('hoursValue', { hours: Number(h) })}
              </option>
            ))}
          </select>
        </div>
      </div>
      {category === 'family' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{t('familyNotice')}</p>}
      <div>
        <label className={labelClass}>{t('fieldMode')}</label>
        <div className="grid grid-cols-3 gap-2">
          {(['in_person', 'online', 'both'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-xl border px-2 py-2 text-sm font-semibold ${mode === m ? 'border-[var(--ink)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-gray-200 bg-white text-gray-600'}`}
            >
              {t(`mode_${m}`)}
            </button>
          ))}
        </div>
      </div>
      {mode !== 'online' && (
        <div>
          <label className={labelClass}>{t('fieldCity')}</label>
          <input className={inputClass} required maxLength={80} value={city} onChange={(e) => setCity(e.target.value)} />
          <p className={hintClass}>{t('cityHint')}</p>
        </div>
      )}
      <div>
        <label className={labelClass}>{t('fieldLanguages')}</label>
        <Chips values={TIMEBANK_LANGUAGES} selected={languages as never[]} onToggle={(v) => setLanguages((l) => toggle(l, v))} label={(l) => languageName(l, locale)} />
      </div>
      <div>
        <label className={labelClass}>{t('fieldWhen')}</label>
        <input className={inputClass} maxLength={120} value={whenText} placeholder={t('fieldWhenPlaceholder')} onChange={(e) => setWhenText(e.target.value)} />
      </div>
      <p className={hintClass}>{t('excludedNotice')}</p>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className={primary}>
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {kind === 'request' ? t('publishRequest') : t('publishOffer')}
      </button>
    </form>
  )
}

// Proposta di scambio su un annuncio: ore, giorno (facoltativo), messaggio
export function ProposeForm({ post, onSent }: { post: TimebankPost; onSent: () => void }) {
  const t = useTranslations('timebank')
  const [hours, setHours] = useState(String(post.hours))
  const [day, setDay] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await proposeTimebankExchange(post.id, hours, note, day)
    setBusy(false)
    if (result.error || !result.id) {
      const code = result.error ?? 'saveError'
      return setError(t.has(`error_${code}`) ? t(`error_${code}`) : t('error_saveError'))
    }
    onSent()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-700">{post.kind === 'request' ? t('proposeGiveIntro', { name: post.author_name }) : t('proposeReceiveIntro', { name: post.author_name })}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t('fieldHours')}</label>
          <select className={inputClass} value={hours} onChange={(e) => setHours(e.target.value)}>
            {['0.5', '1', '1.5', '2', '2.5', '3', '4', '5', '6', '8'].map((h) => (
              <option key={h} value={h}>
                {t('hoursValue', { hours: Number(h) })}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{t('fieldDay')}</label>
          <input type="date" className={inputClass} value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
      </div>
      <div>
        <label className={labelClass}>{t('fieldMessage')}</label>
        <textarea className={inputClass} rows={3} maxLength={500} value={note} placeholder={t('fieldMessagePlaceholder')} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className={primary}>
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('sendProposal')}
      </button>
    </form>
  )
}
