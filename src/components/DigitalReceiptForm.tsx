'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import {
  CheckCircle,
  LoaderCircle,
  XCircle,
  Camera,
  Package,
  Handshake,
  Undo2,
  Banknote,
  Vault,
  Tag,
  KeyRound,
  FileText,
  Wrench,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createReceipt } from '@/app/actions/digitalReceipt'
import { todayKey } from '@/lib/agenda'
import { resizeImageFile } from '@/lib/resizeImage'
import {
  RECEIPT_TEMPLATES,
  validatePhotoFile,
  photoExtension,
  type ReceiptTemplate,
  type DigitalReceiptFormData,
} from '@/lib/digitalReceipt'
import { RECEIPT_VAT_MODES } from '@/lib/digitalReceipt'
import CancelButton, { cancelButtonLgClass } from '@/components/ui/CancelButton'

const TEMPLATE_ICONS: Record<ReceiptTemplate, typeof Package> = {
  delivery: Package,
  loan: Handshake,
  return: Undo2,
  declared_payment: Banknote,
  deposit: Vault,
  private_sale: Tag,
  keys: KeyRound,
  documents: FileText,
  company_equipment: Wrench,
}

function defaultForm(): DigitalReceiptFormData {
  return {
    template: 'delivery',
    objectName: '',
    serialNumber: '',
    recipientName: '',
    // Giorno di oggi in Italia (toISOString darebbe il giorno UTC)
    deliveryDate: todayKey(),
    reason: '',
    notes: '',
    quantity: null,
    declaredValue: null,
    vatMode: 'none',
    showIssuer: true,
    expectedReturnDate: '',
    addLifeCalendarReminder: true,
  }
}

export default function DigitalReceiptForm({
  initialData,
  savedClients = [],
}: {
  // Campi già compilati (es. dal preventivo); gli altri restano quelli di default
  initialData?: Partial<DigitalReceiptFormData>
  // Nomi dei clienti salvati nei Preventivi, suggeriti nel campo destinatario
  savedClients?: string[]
} = {}) {
  const t = useTranslations('digitalReceipt')
  const te = useTranslations('ecosystem')
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [receiptId] = useState(() => crypto.randomUUID())
  const [form, setForm] = useState<DigitalReceiptFormData>(() => ({ ...defaultForm(), ...initialData }))
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isValid = form.objectName.trim().length > 0 && form.recipientName.trim().length > 0 && form.deliveryDate.length > 0

  const handlePhotoSelect = async (picked: File) => {
    // Scontrino ridotto a 2000 px con qualità alta: il testo resta leggibile
    const file = (await resizeImageFile(picked, 2000, 0.86)) ?? picked
    const validationError = validatePhotoFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    setUploadingPhoto(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUploadingPhoto(false)
      return
    }

    const path = `${user.id}/${receiptId}.${photoExtension(file)}`
    const { error: uploadError } = await supabase.storage.from('receipt-photos-v2').upload(path, file, { upsert: true })
    setUploadingPhoto(false)

    // Foto scelta prima e sostituita (altro formato): non resta nello spazio file
    if (!uploadError && photoPath && photoPath !== path) {
      await supabase.storage.from('receipt-photos-v2').remove([photoPath])
    }

    if (uploadError) {
      console.error('[DigitalReceipt] photo upload failed:', uploadError)
      setError('photoUploadError')
      return
    }

    setPhotoPath(path)
    setPhotoUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await createReceipt(form, photoPath)
      if (!result.success) {
        setError(result.message)
        return
      }
      router.push(`/marketplace/digital-receipt/${result.data.id}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div data-cancel-scope className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('templateLabel')}</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {RECEIPT_TEMPLATES.map((template) => {
            const Icon = TEMPLATE_ICONS[template]
            return (
              <button
                key={template}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, template }))}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg text-xs font-medium border-2 transition-all ${
                  form.template === template
                    ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)]'
                    : 'border-[var(--gold)]/20 text-gray-600 hover:border-[var(--gold)]/50'
                }`}
              >
                <Icon className="w-5 h-5" />
                {t(`template_${template}`)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-24 h-24 rounded-xl border-2 border-dashed border-[var(--gold)]/40 flex items-center justify-center cursor-pointer hover:border-[var(--gold)] transition-all overflow-hidden bg-[var(--gold-pale)]/40"
        >
          {uploadingPhoto ? (
            <LoaderCircle className="w-6 h-6 text-gray-400 animate-spin" />
          ) : photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Camera className="w-7 h-7 text-gray-300" />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handlePhotoSelect(file)
            e.target.value = ''
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm font-medium text-[var(--gold)] hover:underline">
          {photoUrl ? t('changePhoto') : t('addPhoto')}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('objectField')}</label>
          <input
            type="text"
            value={form.objectName}
            onChange={(e) => setForm((prev) => ({ ...prev, objectName: e.target.value }))}
            placeholder={t('objectPlaceholder')}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('serialField')}</label>
          <input
            type="text"
            value={form.serialNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, serialNumber: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t(form.template === 'declared_payment' ? 'recipientField_declared_payment' : 'recipientField')}</label>
          <input
            type="text"
            value={form.recipientName}
            onChange={(e) => setForm((prev) => ({ ...prev, recipientName: e.target.value }))}
            placeholder={t('recipientPlaceholder')}
            list={savedClients.length > 0 ? 'receipt-saved-clients' : undefined}
            title={savedClients.length > 0 ? te('receiptSavedClients') : undefined}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
          {savedClients.length > 0 && (
            <datalist id="receipt-saved-clients" aria-label={te('receiptSavedClients')}>
              {savedClients.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('dateField')}</label>
          <input
            type="date"
            value={form.deliveryDate}
            onChange={(e) => setForm((prev) => ({ ...prev, deliveryDate: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('reasonField')}</label>
        <input
          type="text"
          value={form.reason}
          onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
          placeholder={t('reasonPlaceholder')}
          className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('quantityField')}</label>
          <input
            type="number"
            min={0}
            value={form.quantity ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value ? Number(e.target.value) : null }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t(form.template === 'declared_payment' ? 'valueField_declared_payment' : 'valueField')}</label>
          <input
            type="number"
            min={0}
            step="0.01"
            value={form.declaredValue ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, declaredValue: e.target.value ? Number(e.target.value) : null }))}
            placeholder="€"
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
          {form.declaredValue !== null && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {RECEIPT_VAT_MODES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, vatMode: m }))}
                  aria-pressed={form.vatMode === m}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold ${form.vatMode === m ? 'border-[var(--gold)] bg-[var(--ink)] text-[var(--gold-bright)]' : 'border-gray-200 text-gray-600'}`}
                >
                  {t(`vatMode_${m}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm text-gray-800">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--gold)]" checked={form.showIssuer} onChange={(e) => setForm((prev) => ({ ...prev, showIssuer: e.target.checked }))} />
        <span>
          {t('showIssuerField')}
          <span className="block text-xs text-gray-500">{t('showIssuerHint')}</span>
        </span>
      </label>

      {form.template === 'loan' && (
        <div className="bg-[var(--gold-pale)] border border-[var(--gold)]/30 rounded-xl p-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('expectedReturnField')}</label>
            <input
              type="date"
              value={form.expectedReturnDate}
              onChange={(e) => setForm((prev) => ({ ...prev, expectedReturnDate: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm bg-white"
            />
          </div>
          {form.expectedReturnDate && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.addLifeCalendarReminder}
                onChange={(e) => setForm((prev) => ({ ...prev, addLifeCalendarReminder: e.target.checked }))}
                className="rounded text-[var(--gold)] focus:ring-[var(--gold)]"
              />
              {t('addLifeCalendarReminder')}
            </label>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('notesField')}</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          rows={3}
          className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-800 text-sm">
          <XCircle className="w-5 h-5 shrink-0" />
          {t(error)}
        </div>
      )}

      <div className="flex gap-2">
        <CancelButton className={cancelButtonLgClass} fallbackHref="/marketplace/digital-receipt" />
        <button
          onClick={handleSubmit}
          disabled={!isValid || saving || uploadingPhoto}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all disabled:opacity-50"
        >
          {saving ? (
            <>
              <LoaderCircle className="w-5 h-5 animate-spin" />
              {t('saving')}
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              {t('create')}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
