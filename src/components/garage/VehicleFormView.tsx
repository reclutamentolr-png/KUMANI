'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { CarFront, KeyRound, LoaderCircle, Motorbike } from 'lucide-react'
import { createVehicle, updateVehicle } from '@/app/actions/garage'
import { todayKey } from '@/lib/agenda'
import { defaultLocale } from '../../../i18n'
import type { GarageVehicle, VehicleForm, VehicleKind, VehicleType } from '@/lib/garage'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'
import { limitTextOf } from '@/lib/limitText'

const input =
  'w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/20'
const label = 'mb-1 block text-sm font-semibold text-[var(--ink)]'

// Numero scritto all'italiana o all'inglese ("0,10" o "0.10"); vuoto → null
function parseNumber(value: string): number | null {
  const clean = value.trim().replace(/\s/g, '')
  if (!clean) return null
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}

const asText = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value))

export default function VehicleFormView({ vehicle, spendlyAvailable }: { vehicle?: GarageVehicle; spendlyAvailable: boolean }) {
  const t = useTranslations('garage')
  const router = useRouter()
  const locale = useLocale()
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [kind, setKind] = useState<VehicleKind>(vehicle?.kind ?? 'owned')
  const [vehicleType, setVehicleType] = useState<VehicleType>(vehicle?.vehicle_type ?? 'car')
  const [name, setName] = useState(vehicle?.name ?? '')
  const [model, setModel] = useState(vehicle?.model ?? '')
  const [plate, setPlate] = useState(vehicle?.plate ?? '')
  const [initialKm, setInitialKm] = useState(asText(vehicle?.initial_km ?? 0))
  const [start, setStart] = useState(vehicle?.rental_start ?? todayKey())
  const [months, setMonths] = useState(asText(vehicle?.rental_months ?? 48))
  const [kmIncluded, setKmIncluded] = useState(asText(vehicle?.rental_km_included))
  const [fee, setFee] = useState(asText(vehicle?.rental_monthly_fee))
  const [down, setDown] = useState(asText(vehicle?.rental_down_payment))
  const [extraKm, setExtraKm] = useState(asText(vehicle?.rental_extra_km_cost))
  const [refundKm, setRefundKm] = useState(asText(vehicle?.rental_unused_km_refund))
  const [includesTax, setIncludesTax] = useState(vehicle?.rental_includes_tax ?? true)
  const [includesInsurance, setIncludesInsurance] = useState(vehicle?.rental_includes_insurance ?? true)
  const [feeToSpendly, setFeeToSpendly] = useState(vehicle ? !!vehicle.spendly_fixed_id : spendlyAvailable)

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    const form: VehicleForm = {
      kind,
      vehicleType,
      name,
      model,
      plate,
      initialKm: parseNumber(initialKm) ?? 0,
      rentalStart: start,
      rentalMonths: parseNumber(months),
      rentalKmIncluded: parseNumber(kmIncluded),
      rentalMonthlyFee: parseNumber(fee),
      rentalDownPayment: parseNumber(down),
      rentalExtraKmCost: parseNumber(extraKm),
      rentalUnusedKmRefund: parseNumber(refundKm),
      rentalIncludesTax: includesTax,
      rentalIncludesInsurance: includesInsurance,
      addFeeToSpendly: feeToSpendly,
    }
    startTransition(async () => {
      const result = vehicle ? await updateVehicle(vehicle.id, form) : await createVehicle(form)
      if (!result.success) {
        setError(limitTextOf(result) ?? (t.has(`error_${result.message}`) ? t(`error_${result.message}`) : t('error_saveError')))
        return
      }
      const id = vehicle ? vehicle.id : (result.data as { id: string }).id
      router.push(`${prefix}/marketplace/garage/${id}`)
      router.refresh()
    })
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
        {/* Auto o moto */}
        <p className={label}>{t('typeQuestion')}</p>
        <div className="mb-5 grid grid-cols-2 gap-3">
          {(['car', 'motorbike'] as const).map((value) => {
            const Icon = value === 'motorbike' ? Motorbike : CarFront
            return (
              <button
                key={value}
                type="button"
                onClick={() => setVehicleType(value)}
                aria-pressed={vehicleType === value}
                className={`flex items-center gap-2 rounded-xl border-2 p-3.5 text-left font-bold text-[var(--ink)] transition-colors ${
                  vehicleType === value ? 'border-[var(--gold)] bg-[var(--gold-pale)]' : 'border-gray-200 hover:border-[var(--gold)]/50'
                }`}
              >
                <Icon className="h-5 w-5 text-[var(--gold)]" /> {t(`type_${value}`)}
              </button>
            )
          })}
        </div>
        <p className={label}>{t('kindQuestion')}</p>
        <div className="grid grid-cols-2 gap-3">
          {(['owned', 'rental'] as const).map((value) => {
            const Icon = value === 'rental' ? KeyRound : vehicleType === 'motorbike' ? Motorbike : CarFront
            return (
              <button
                key={value}
                type="button"
                onClick={() => setKind(value)}
                aria-pressed={kind === value}
                className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3.5 text-left transition-colors ${
                  kind === value ? 'border-[var(--gold)] bg-[var(--gold-pale)]' : 'border-gray-200 hover:border-[var(--gold)]/50'
                }`}
              >
                <Icon className="h-5 w-5 text-[var(--gold)]" />
                <span className="font-bold text-[var(--ink)]">{t(`kind_${value}`)}</span>
                <span className="text-xs text-[var(--muted)]">{t(`kindHint_${value}`)}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="g-name" className={label}>
              {t('name')} *
            </label>
            <input id="g-name" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder={vehicleType === 'motorbike' ? t('namePlaceholderMoto') : t('namePlaceholder')} className={input} />
          </div>
          <div>
            <label htmlFor="g-model" className={label}>
              {t('model')}
            </label>
            <input id="g-model" maxLength={80} value={model} onChange={(e) => setModel(e.target.value)} placeholder={vehicleType === 'motorbike' ? t('modelPlaceholderMoto') : t('modelPlaceholder')} className={input} />
          </div>
          <div>
            <label htmlFor="g-plate" className={label}>
              {t('plate')}
            </label>
            <input id="g-plate" maxLength={15} value={plate} onChange={(e) => setPlate(e.target.value)} className={`${input} uppercase`} />
          </div>
          <div>
            <label htmlFor="g-initial" className={label}>
              {kind === 'rental' ? t('initialKmRental') : t('initialKm')}
            </label>
            <input id="g-initial" inputMode="numeric" value={initialKm} onChange={(e) => setInitialKm(e.target.value)} className={input} />
          </div>
        </div>
      </section>

      {kind === 'rental' && (
        <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-[var(--ink)]">{t('contractTitle')}</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{t('contractHint')}</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="g-start" className={label}>
                {t('rentalStart')} *
              </label>
              <input id="g-start" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="g-months" className={label}>
                {t('rentalMonths')} *
              </label>
              <input id="g-months" inputMode="numeric" required value={months} onChange={(e) => setMonths(e.target.value)} className={input} />
            </div>
            <div>
              <label htmlFor="g-km" className={label}>
                {t('rentalKmIncluded')} *
              </label>
              <input id="g-km" inputMode="numeric" required value={kmIncluded} onChange={(e) => setKmIncluded(e.target.value)} placeholder="40000" className={input} />
            </div>
            <div>
              <label htmlFor="g-fee" className={label}>
                {t('rentalMonthlyFee')}
              </label>
              <input id="g-fee" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="0,00" className={input} />
            </div>
            <div>
              <label htmlFor="g-down" className={label}>
                {t('rentalDownPayment')}
              </label>
              <input id="g-down" inputMode="decimal" value={down} onChange={(e) => setDown(e.target.value)} placeholder="0,00" className={input} />
            </div>
            <div>
              <label htmlFor="g-extra" className={label}>
                {t('rentalExtraKmCost')}
              </label>
              <input id="g-extra" inputMode="decimal" value={extraKm} onChange={(e) => setExtraKm(e.target.value)} placeholder="0,10" className={input} />
            </div>
            <div>
              <label htmlFor="g-refund" className={label}>
                {t('rentalUnusedKmRefund')}
              </label>
              <input id="g-refund" inputMode="decimal" value={refundKm} onChange={(e) => setRefundKm(e.target.value)} placeholder="0,05" className={input} />
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            <label className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
              <input type="checkbox" checked={includesTax} onChange={(e) => setIncludesTax(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
              {t('rentalIncludesTax')}
            </label>
            <label className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
              <input type="checkbox" checked={includesInsurance} onChange={(e) => setIncludesInsurance(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
              {t('rentalIncludesInsurance')}
            </label>
            {spendlyAvailable && (
              <label className="flex items-start gap-2.5 text-sm text-[var(--ink)]">
                <input type="checkbox" checked={feeToSpendly} onChange={(e) => setFeeToSpendly(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
                {t('feeToSpendly')}
              </label>
            )}
          </div>
        </section>
      )}

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

      <div className="flex gap-2">
        <CancelButton className={cancelButtonLgClass} fallbackHref="/marketplace/garage" />
        <button
          type="submit"
          disabled={isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3.5 font-bold text-white hover:bg-[var(--ink-soft)] disabled:opacity-60"
        >
          {isPending && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {vehicle ? t('saveChanges') : t('saveVehicle')}
        </button>
      </div>
    </form>
  )
}
