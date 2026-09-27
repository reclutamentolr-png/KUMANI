'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { X, CheckCircle, LoaderCircle, XCircle } from 'lucide-react'
import { updateSavedClient } from '@/app/actions/quotes'
import type { SavedClientRow, SavedClientFormData } from '@/lib/quotes'

type Props = {
  client: SavedClientRow
  onClose: () => void
  onSaved: (updated: SavedClientRow) => void
}

const inputClass =
  'w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1'

export default function QuoteClientQuickEditModal({ client, onClose, onSaved }: Props) {
  const t = useTranslations('preventivi')

  const [form, setForm] = useState<SavedClientFormData>({
    name: client.name,
    vat: client.vat || '',
    pec: client.pec || '',
    address: client.address || '',
    city: client.city || '',
    postalCode: client.postal_code || '',
    email: client.email || '',
    phone: client.phone || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    setError(null)
    const result = await updateSavedClient(client.id, form)
    setSaving(false)
    if (!result.success) {
      setError(result.message)
      return
    }
    onSaved({
      ...client,
      name: form.name.trim(),
      vat: form.vat || null,
      pec: form.pec || null,
      address: form.address || null,
      city: form.city || null,
      postal_code: form.postalCode || null,
      email: form.email || null,
      phone: form.phone || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-[var(--gold)]/25 bg-white p-6 shadow-2xl">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 text-gray-400 hover:text-gray-600">
          <X className="h-5 w-5" />
        </button>

        <h3 className="font-bold text-[var(--ink)] mb-4">{t('editSavedClientTitle')}</h3>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>{t('clientNameField')}</label>
            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('clientVatField')}</label>
              <input type="text" value={form.vat} onChange={(e) => setForm((p) => ({ ...p, vat: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('clientPecField')}</label>
              <input type="email" value={form.pec} onChange={(e) => setForm((p) => ({ ...p, pec: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('clientAddressField')}</label>
            <input type="text" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('clientCityField')}</label>
              <input type="text" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('clientPostalCodeField')}</label>
              <input type="text" value={form.postalCode} onChange={(e) => setForm((p) => ({ ...p, postalCode: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>{t('clientEmailField')}</label>
              <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>{t('clientPhoneField')}</label>
              <input type="text" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} className={inputClass} />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-800 text-sm">
            <XCircle className="w-4 h-4 shrink-0" />
            {t(error)}
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl font-medium text-sm border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)] transition-all"
          >
            {t('cancelAction')}
          </button>
          <button
            onClick={handleSave}
            disabled={!form.name.trim() || saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
          >
            {saving ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {t('saveChangesAction')}
          </button>
        </div>
      </div>
    </div>
  )
}
