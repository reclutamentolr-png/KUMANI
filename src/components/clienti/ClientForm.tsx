'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import { CLIENT_LIMITS, type ClientFormData } from '@/lib/clienti'

export const inputClass =
  'mt-1 block min-h-11 w-full rounded-xl border border-[var(--gold)]/35 bg-white px-3 text-base text-[var(--ink)] outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30'
const labelClass = 'block text-sm font-semibold text-[var(--muted)]'

type FieldKey = keyof ClientFormData
const FIELDS: { key: FieldKey; max: number; type?: string; autoComplete?: string; inputMode?: 'tel' | 'email'; wide?: boolean }[] = [
  { key: 'name', max: CLIENT_LIMITS.name, wide: true, autoComplete: 'off' },
  { key: 'contactName', max: CLIENT_LIMITS.contactName, autoComplete: 'off' },
  { key: 'phone', max: CLIENT_LIMITS.phone, type: 'tel', inputMode: 'tel', autoComplete: 'off' },
  { key: 'email', max: CLIENT_LIMITS.email, type: 'email', inputMode: 'email', autoComplete: 'off' },
  { key: 'vat', max: CLIENT_LIMITS.vat, autoComplete: 'off' },
  { key: 'address', max: CLIENT_LIMITS.address, wide: true, autoComplete: 'off' },
  { key: 'city', max: CLIENT_LIMITS.city, autoComplete: 'off' },
  { key: 'postalCode', max: CLIENT_LIMITS.postalCode, autoComplete: 'off' },
  { key: 'pec', max: CLIENT_LIMITS.pec, type: 'email', inputMode: 'email', autoComplete: 'off', wide: true },
]

// Dati del cliente (nuovo o da modificare)
export default function ClientForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ClientFormData
  submitLabel: string
  onSubmit: (form: ClientFormData) => Promise<string | null>
  onCancel: () => void
}) {
  const t = useTranslations('clienti')
  const [form, setForm] = useState<ClientFormData>(initial)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) {
      setError(t('errors.nameRequired'))
      return
    }
    setSaving(true)
    setError(null)
    const message = await onSubmit(form)
    setSaving(false)
    if (message) setError(message)
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.key} className={`${labelClass} ${f.wide ? 'sm:col-span-2' : ''}`}>
            {t(`fields.${f.key}`)}
            {f.key === 'name' && <span aria-hidden="true"> *</span>}
            <input
              type={f.type ?? 'text'}
              inputMode={f.inputMode}
              autoComplete={f.autoComplete}
              maxLength={f.max}
              required={f.key === 'name'}
              value={form[f.key]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              className={inputClass}
            />
          </label>
        ))}
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 text-sm font-bold text-[var(--gold-bright)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl border border-[var(--gold)]/40 bg-white px-5 text-sm font-semibold text-[var(--ink)] hover:bg-[var(--gold-pale)]"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  )
}
