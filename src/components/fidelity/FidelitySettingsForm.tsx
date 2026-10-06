'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { saveFidelityCard } from '@/app/actions/fidelity'
import {
  FIDELITY_DEFAULT_MIN_HOURS,
  FIDELITY_DEFAULT_STAMPS,
  FIDELITY_EXPIRY_OPTIONS,
  FIDELITY_DEFAULT_CLOSE_PERCENT,
  FIDELITY_MAX_CLOSE_PERCENT,
  FIDELITY_MIN_CLOSE_PERCENT,
  FIDELITY_MAX_MIN_HOURS,
  FIDELITY_MAX_STAMPS,
  FIDELITY_MIN_STAMPS,
  type FidelityCard,
} from '@/lib/fidelity'
import BusinessProfileImport from '@/components/businessProfile/BusinessProfileImport'
import { businessWebsiteUrl, type BusinessProfile } from '@/lib/businessProfile'

const inputClass = 'w-full rounded-lg border border-[var(--gold)]/30 p-2.5 focus:outline-none focus:ring-2 focus:ring-[var(--gold)]'

// Creazione (card = null) o modifica della tessera del negozio.
export default function FidelitySettingsForm({
  card,
  onDone,
  businessProfile = null,
}: {
  card: FidelityCard | null
  onDone?: () => void
  businessProfile?: BusinessProfile | null
}) {
  const t = useTranslations('fidelity')
  const router = useRouter()
  // Nuova tessera: si parte dai dati della Scheda attività
  const fromProfile = !card && businessProfile ? businessProfile : null
  const [businessName, setBusinessName] = useState(card?.business_name ?? (fromProfile?.companyName ?? '').slice(0, 80))
  const [prize, setPrize] = useState(card?.prize ?? '')
  const [stampsNeeded, setStampsNeeded] = useState(card?.stamps_needed ?? FIDELITY_DEFAULT_STAMPS)
  const [minHours, setMinHours] = useState(card?.min_hours_between_stamps ?? FIDELITY_DEFAULT_MIN_HOURS)
  const [expireDays, setExpireDays] = useState<number | null>(card?.stamps_expire_days ?? null)
  const [reviewUrl, setReviewUrl] = useState(card?.review_url ?? businessWebsiteUrl(fromProfile?.reviewUrl ?? ''))
  const [closePercent, setClosePercent] = useState(card?.close_to_prize_percent ?? FIDELITY_DEFAULT_CLOSE_PERCENT)
  const [pin, setPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // «Usa i dati della Scheda attività»: solo i campi che la Scheda ha
  const importBusinessProfile = (p: BusinessProfile) => {
    if (p.companyName) setBusinessName(p.companyName.slice(0, 80))
    if (p.reviewUrl) setReviewUrl(businessWebsiteUrl(p.reviewUrl))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const result = await saveFidelityCard({
      businessName,
      prize,
      stampsNeeded,
      minHoursBetweenStamps: minHours,
      stampsExpireDays: expireDays,
      reviewUrl,
      closeToPrizePercent: closePercent,
      pin,
    })
    setSaving(false)
    if (!result.success) {
      setError(t(`formError_${result.message}`))
      return
    }
    setPin('')
    router.refresh()
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <BusinessProfileImport profile={businessProfile} onImport={importBusinessProfile} />
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('businessNameField')}</label>
        <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={80} required className={inputClass} placeholder={t('businessNamePlaceholder')} />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('prizeField')}</label>
        <input value={prize} onChange={(e) => setPrize(e.target.value)} maxLength={120} required className={inputClass} placeholder={t('prizePlaceholder')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('stampsNeededField')}</label>
          <input
            type="number"
            min={FIDELITY_MIN_STAMPS}
            max={FIDELITY_MAX_STAMPS}
            value={stampsNeeded}
            onChange={(e) => setStampsNeeded(Number(e.target.value))}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('minHoursField')}</label>
          <input
            type="number"
            min={0}
            max={FIDELITY_MAX_MIN_HOURS}
            value={minHours}
            onChange={(e) => setMinHours(Number(e.target.value))}
            required
            className={inputClass}
          />
        </div>
      </div>
      <p className="-mt-2 text-xs text-[var(--muted)]">{t('minHoursHint')}</p>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('expiryField')}</label>
        <select
          value={expireDays ?? ''}
          onChange={(e) => setExpireDays(e.target.value ? Number(e.target.value) : null)}
          className={inputClass}
        >
          <option value="">{t('expiryNever')}</option>
          {FIDELITY_EXPIRY_OPTIONS.map((days) => (
            <option key={days} value={days}>
              {t('expiryMonths', { months: Math.round(days / 30) })}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--muted)]">{t('expiryHint')}</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('reviewUrlField')}</label>
        <input type="url" value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} className={inputClass} placeholder="https://g.page/r/..." />
        <p className="mt-1 text-xs text-[var(--muted)]">{t('reviewUrlHint')}</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{t('closePercentField')}</label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={FIDELITY_MIN_CLOSE_PERCENT}
            max={FIDELITY_MAX_CLOSE_PERCENT}
            step={5}
            value={closePercent}
            onChange={(e) => setClosePercent(Number(e.target.value))}
            className="w-24 rounded-lg border border-[var(--gold)]/30 p-2.5 text-center"
          />
          <span className="text-sm text-[var(--ink)]">%</span>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">{t('closePercentHint')}</p>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-[var(--ink)]">{card ? t('pinFieldChange') : t('pinField')}</label>
        <input
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required={!card}
          className={`${inputClass} tracking-[0.4em]`}
        />
        <p className="mt-1 text-xs text-[var(--muted)]">{t('pinHint')}</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 text-sm font-bold text-[var(--ink)] disabled:opacity-50"
        >
          {saving ? t('saving') : card ? t('saveChanges') : t('createCard')}
        </button>
        {card && onDone && (
          <button type="button" onClick={onDone} className="rounded-lg bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">
            {t('cancel')}
          </button>
        )}
      </div>
    </form>
  )
}
