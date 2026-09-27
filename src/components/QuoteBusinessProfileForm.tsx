'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckCircle, LoaderCircle, XCircle, ImagePlus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { saveIssuerProfile } from '@/app/actions/quotes'
import { validateLogoFile, logoExtension, type IssuerProfileFormData } from '@/lib/quotes'

type Props = {
  initialProfile: IssuerProfileFormData
  initialLogoUrl: string | null
}

export default function QuoteBusinessProfileForm({ initialProfile, initialLogoUrl }: Props) {
  const t = useTranslations('preventivi')
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<IssuerProfileFormData>(initialProfile)
  const [logoUrl, setLogoUrl] = useState<string | null>(initialLogoUrl)
  const [logoPath, setLogoPath] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const isValid = form.companyName.trim().length > 0

  const handleLogoSelect = async (file: File) => {
    const validationError = validateLogoFile(file)
    if (validationError) {
      setError(validationError)
      setErrorDetail(null)
      return
    }
    setError(null)
    setErrorDetail(null)
    setUploadingLogo(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setUploadingLogo(false)
      return
    }

    const path = `${user.id}/logo.${logoExtension(file)}`
    const { error: uploadError } = await supabase.storage.from('quote-logos-v2').upload(path, file, { upsert: true })
    setUploadingLogo(false)

    if (uploadError) {
      console.error('[Quotes] logo upload failed:', uploadError)
      setError('logoUploadError')
      // Surfaced alongside the generic message so a real cause (missing
      // bucket/policy, size limit, etc.) is visible without opening devtools.
      setErrorDetail(uploadError.message || null)
      return
    }

    setLogoPath(path)
    setLogoUrl(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    setErrorDetail(null)
    setSaved(false)
    try {
      const result = await saveIssuerProfile(form, logoPath)
      if (!result.success) {
        setError(result.message)
        return
      }
      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-[var(--gold)]/25 p-6 sm:p-8 space-y-6">
      <div className="flex flex-col items-center gap-3">
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-28 h-28 rounded-xl border-2 border-dashed border-[var(--gold)]/40 flex items-center justify-center cursor-pointer hover:border-[var(--gold)] transition-all overflow-hidden bg-[var(--gold-pale)]/40"
        >
          {uploadingLogo ? (
            <LoaderCircle className="w-6 h-6 text-gray-400 animate-spin" />
          ) : logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="w-full h-full object-contain p-2" />
          ) : (
            <ImagePlus className="w-8 h-8 text-gray-300" />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleLogoSelect(file)
            e.target.value = ''
          }}
        />
        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm font-medium text-[var(--gold)] hover:underline">
          {logoUrl ? t('changeLogo') : t('addLogo')}
        </button>
        <p className="text-xs text-gray-400">{t('logoFormatHint')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyNameField')}</label>
          <input
            type="text"
            value={form.companyName}
            onChange={(e) => setForm((prev) => ({ ...prev, companyName: e.target.value }))}
            placeholder={t('companyNamePlaceholder')}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('vatNumberField')}</label>
          <input
            type="text"
            value={form.vatNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, vatNumber: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('addressField')}</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('cityField')}</label>
          <input
            type="text"
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('postalCodeField')}</label>
          <input
            type="text"
            value={form.postalCode}
            onChange={(e) => setForm((prev) => ({ ...prev, postalCode: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('provinceField')}</label>
          <input
            type="text"
            value={form.province}
            onChange={(e) => setForm((prev) => ({ ...prev, province: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailField')}</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('pecField')}</label>
          <input
            type="email"
            value={form.pec}
            onChange={(e) => setForm((prev) => ({ ...prev, pec: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('phoneField')}</label>
          <input
            type="text"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[var(--gold)]/30 text-sm"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-2 text-red-800 text-sm">
          <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p>{t(error)}</p>
            {errorDetail && <p className="text-xs text-red-600/80 mt-1">{errorDetail}</p>}
          </div>
        </div>
      )}

      {saved && !error && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2 text-green-800 text-sm">
          <CheckCircle className="w-5 h-5 shrink-0" />
          {t('profileSaved')}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isValid || saving || uploadingLogo}
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
            {t('saveProfile')}
          </>
        )}
      </button>
    </div>
  )
}
