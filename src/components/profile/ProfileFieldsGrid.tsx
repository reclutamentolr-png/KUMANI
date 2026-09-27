'use client'

import { useTranslations } from 'next-intl'
import { User, Phone, MapPin, Calendar, Briefcase, Home, Building2, MapPinned, Hash, Lock, AlertTriangle, ShieldAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  FORM_PROFILE_FIELDS,
  PROFILE_FIELD_LABELS,
  REQUIRED_PROFILE_FIELDS,
  type FormProfileField,
  type LockableProfileField,
  type ProfileFormValues,
} from '@/lib/profileFields'

const FIELD_ICONS: Record<FormProfileField, LucideIcon> = {
  first_name: User,
  last_name: User,
  phone: Phone,
  date_of_birth: Calendar,
  occupation: Briefcase,
  country_code: MapPin,
  address: Home,
  city: Building2,
  province: MapPinned,
  postal_code: Hash,
}

const REQUIRED = new Set<string>(REQUIRED_PROFILE_FIELDS)

// Etichetta di un campo del profilo (chiavi esistenti di "dashboard" dove ci sono).
export function useProfileFieldLabel() {
  const dashboardT = useTranslations('dashboard')
  const lockT = useTranslations('profileLock')
  return (field: LockableProfileField) => {
    const label = PROFILE_FIELD_LABELS[field]
    return label.ns === 'dashboard' ? dashboardT(label.key) : lockT(label.key)
  }
}

type ProfileFieldsGridProps = {
  values: ProfileFormValues
  onChange?: (field: FormProfileField, value: string) => void
  // Profilo completato: campi in sola lettura con il lucchetto.
  locked?: boolean
  // Campi obbligatori mancanti da evidenziare.
  missing?: readonly string[]
  accent?: 'indigo' | 'amber'
}

export default function ProfileFieldsGrid({ values, onChange, locked = false, missing = [], accent = 'indigo' }: ProfileFieldsGridProps) {
  const t = useTranslations('dashboard')
  const lockT = useTranslations('profileLock')
  const label = useProfileFieldLabel()
  const ring = accent === 'amber' ? 'focus:ring-amber-500' : 'focus:ring-indigo-500'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {FORM_PROFILE_FIELDS.map((field) => {
        const Icon = FIELD_ICONS[field]
        const isMissing = !locked && missing.includes(field)
        const required = !locked && REQUIRED.has(field)
        return (
          <div key={field} className={field === 'address' ? 'col-span-2 sm:col-span-3' : undefined}>
            <label className="block text-xs font-medium text-gray-700 mb-1 flex items-center gap-1">
              <Icon className="w-3.5 h-3.5" /> {label(field)}
              {required && <span className="text-red-500">*</span>}
            </label>
            <div className="relative">
              <input
                type={field === 'date_of_birth' ? 'date' : field === 'phone' ? 'tel' : 'text'}
                value={values[field]}
                onChange={(e) => onChange?.(field, e.target.value)}
                disabled={locked}
                required={required}
                title={locked ? lockT('lockedField') : undefined}
                placeholder={field === 'country_code' ? t('countryShort') : field === 'address' ? t('addressPlaceholder') : undefined}
                className={`w-full p-2 text-sm border rounded-lg focus:ring-2 ${ring} focus:outline-none ${
                  locked ? 'bg-gray-50 text-gray-600 border-gray-200 pr-8 cursor-not-allowed' : isMissing ? 'border-red-400 bg-red-50/40' : 'border-gray-300'
                }`}
              />
              {locked && <Lock className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Box "completa tutti i dati" con l'elenco dei campi mancanti.
export function MissingFieldsBox({ missing }: { missing: readonly LockableProfileField[] }) {
  const lockT = useTranslations('profileLock')
  const label = useProfileFieldLabel()
  if (missing.length === 0) return null
  return (
    <div role="alert" className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
      <p className="font-semibold flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0" /> {lockT('requiredTitle')}
      </p>
      <p className="mt-1 text-red-700">{lockT('missingFields')}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {missing.map((field) => (
          <span key={field} className="rounded-full bg-white border border-red-200 px-2 py-0.5 text-xs font-medium">
            {label(field)}
          </span>
        ))}
      </div>
    </div>
  )
}

// Ultimo passaggio prima del salvataggio che blocca i dati.
export function ConfirmLockBox({ saving, onConfirm, onBack }: { saving: boolean; onConfirm: () => void; onBack: () => void }) {
  const lockT = useTranslations('profileLock')
  return (
    <div role="alert" className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 rounded-lg text-sm">
      <p className="font-semibold flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 shrink-0" /> {lockT('confirmTitle')}
      </p>
      <p className="mt-1">{lockT('confirmText')}</p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onBack} disabled={saving} className="px-3 py-1.5 rounded-lg font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50">
          {lockT('confirmBack')}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg font-semibold bg-[var(--ink,#111)] text-[var(--gold-bright,#f5d27a)] hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
        >
          <Lock className="w-3.5 h-3.5" />
          {saving ? lockT('saving') : lockT('confirmSave')}
        </button>
      </div>
    </div>
  )
}
