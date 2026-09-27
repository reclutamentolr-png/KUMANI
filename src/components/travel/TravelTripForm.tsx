'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import { CHECKLIST_TEMPLATE, CURRENCIES, TRIP_EMOJIS } from '@/lib/travel'

const input = 'w-full rounded-xl border border-gray-300 px-3 py-2.5 text-[15px] focus:border-[var(--gold)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30'
const label = 'mb-1 block text-sm font-semibold text-gray-700'

export type TripFormValues = {
  title: string
  destination: string
  startsOn: string
  endsOn: string
  emoji: string
  membersCanEdit: boolean
  baseCurrency: string
}

// Dati del viaggio: creazione (con la checklist base facoltativa) e modifica
// (con l'opzione "tutti possono modificare").
export default function TravelTripForm({
  initial,
  mode,
  onSubmit,
  currencyLocked = false,
}: {
  initial?: Partial<TripFormValues>
  mode: 'create' | 'edit'
  currencyLocked?: boolean
  onSubmit: (values: TripFormValues, checklist: string[]) => Promise<string | null>
}) {
  const t = useTranslations('travel')
  const [values, setValues] = useState<TripFormValues>({
    title: initial?.title ?? '',
    destination: initial?.destination ?? '',
    startsOn: initial?.startsOn ?? '',
    endsOn: initial?.endsOn ?? '',
    emoji: initial?.emoji ?? '✈️',
    membersCanEdit: initial?.membersCanEdit ?? true,
    baseCurrency: initial?.baseCurrency ?? 'EUR',
  })
  const [withTemplate, setWithTemplate] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof TripFormValues>(key: K, value: TripFormValues[K]) => setValues((v) => ({ ...v, [key]: value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!values.title.trim()) return setError(t('error_invalid'))
    if (values.startsOn && values.endsOn && values.endsOn < values.startsOn) return setError(t('error_dates'))
    setBusy(true)
    setError(null)
    const checklist = mode === 'create' && withTemplate ? CHECKLIST_TEMPLATE.map((key) => t(`template_${key}`)) : []
    const problem = await onSubmit(values, checklist)
    setBusy(false)
    if (problem) setError(problem)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={label}>{t('fieldTitle')}</label>
        <input className={input} value={values.title} maxLength={80} onChange={(e) => set('title', e.target.value)} placeholder={t('fieldTitlePlaceholder')} autoFocus />
      </div>
      <div>
        <label className={label}>{t('fieldDestination')}</label>
        <input className={input} value={values.destination} maxLength={80} onChange={(e) => set('destination', e.target.value)} placeholder={t('fieldDestinationPlaceholder')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>{t('fieldStart')}</label>
          <input type="date" className={input} value={values.startsOn} onChange={(e) => set('startsOn', e.target.value)} />
        </div>
        <div>
          <label className={label}>{t('fieldEnd')}</label>
          <input type="date" className={input} value={values.endsOn} min={values.startsOn || undefined} onChange={(e) => set('endsOn', e.target.value)} />
        </div>
      </div>
      <div>
        <label className={label}>{t('fieldEmoji')}</label>
        <div className="flex flex-wrap gap-2">
          {TRIP_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => set('emoji', emoji)}
              className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xl ${values.emoji === emoji ? 'border-[var(--ink)] bg-[var(--gold-pale)]' : 'border-gray-200 bg-white'}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
      {mode === 'edit' && (
        <div>
          <label className={label}>{t('fieldCurrency')}</label>
          <select className={input} value={values.baseCurrency} disabled={currencyLocked} onChange={(e) => set('baseCurrency', e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-[var(--muted)]">{currencyLocked ? t('currencyLockedHint') : t('fieldCurrencyHint')}</p>
        </div>
      )}
      {mode === 'create' ? (
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--ink)]" checked={withTemplate} onChange={(e) => setWithTemplate(e.target.checked)} />
          <span>
            <strong className="block text-[var(--ink)]">{t('withTemplate')}</strong>
            {t('withTemplateHint')}
          </span>
        </label>
      ) : (
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--ink)]" checked={values.membersCanEdit} onChange={(e) => set('membersCanEdit', e.target.checked)} />
          <span>
            <strong className="block text-[var(--ink)]">{t('membersCanEdit')}</strong>
            {t('membersCanEditHint')}
          </span>
        </label>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-bold text-[var(--ink)] disabled:opacity-60"
      >
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {mode === 'create' ? t('createCta') : t('save')}
      </button>
    </form>
  )
}
