'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { CheckCircle, LoaderCircle, XCircle, Link2, MessageCircle, Phone, MessageSquare, Mail, Wifi, Contact } from 'lucide-react'
import { createQrCode, updateQrCode } from '@/app/actions/qrPro'
import {
  QR_CONTENT_TYPES,
  WIFI_ENCRYPTIONS,
  emptyDestinationFor,
  type QrContentType,
  type QrCodeFormData,
  type QrDestination,
  type WifiEncryption,
} from '@/lib/qrPro'
import { STANDARD_COLORS, ALL_STANDARD_COLOR_KEYS } from '@/lib/standardColorPalette'
import BusinessProfileImport from '@/components/businessProfile/BusinessProfileImport'
import { businessWebsiteUrl, type BusinessProfile } from '@/lib/businessProfile'

type Props = (
  | { mode: 'create' }
  | { mode: 'edit'; id: string; initial: QrCodeFormData }
) & { business?: BusinessProfile | null }

// Tipi che si possono riempire con la Scheda attività
const IMPORT_TYPES: QrContentType[] = ['vcard', 'whatsapp', 'phone', 'email', 'link']

const TYPE_ICONS: Record<QrContentType, typeof Link2> = {
  link: Link2,
  whatsapp: MessageCircle,
  phone: Phone,
  sms: MessageSquare,
  email: Mail,
  wifi: Wifi,
  vcard: Contact,
}

function defaultForm(): QrCodeFormData {
  return {
    label: '',
    contentType: 'link',
    destination: emptyDestinationFor('link'),
    fgColor: '#171717',
    bgColor: '#ffffff',
  }
}

export default function QrProForm(props: Props) {
  const t = useTranslations('qrCodePro')
  const router = useRouter()
  const [form, setForm] = useState<QrCodeFormData>(props.mode === 'edit' ? props.initial : defaultForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setDestField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, destination: { ...prev.destination, [key]: value } as QrDestination }))
  }

  const setType = (type: QrContentType) => {
    setForm((prev) => ({ ...prev, contentType: type, destination: emptyDestinationFor(type) }))
  }

  // «Usa i dati della Scheda attività»: riempie solo i campi che la Scheda ha
  const importBusiness = (p: BusinessProfile) => {
    setForm((prev) => {
      const next: Record<string, string> = { ...(prev.destination as unknown as Record<string, string>) }
      const put = (key: string, value: string) => {
        if (value.trim()) next[key] = value.trim()
      }
      if (prev.contentType === 'vcard') {
        put('company', p.companyName)
        put('phone', p.phone)
        put('mobile', p.whatsapp)
        put('email', p.email)
        put('website', businessWebsiteUrl(p.website))
        put('address', p.address)
        put('city', p.city)
        put('postalCode', p.postalCode)
      } else if (prev.contentType === 'whatsapp') {
        put('phone', p.whatsapp || p.phone)
      } else if (prev.contentType === 'phone') {
        put('phone', p.phone)
      } else if (prev.contentType === 'email') {
        put('email', p.email)
      } else if (prev.contentType === 'link') {
        put('url', businessWebsiteUrl(p.website))
      }
      // Colore del marchio solo se abbastanza scuro: un QR chiaro su fondo
      // bianco non si legge
      const hex = /^#[0-9a-f]{6}$/i.test(p.accent.trim()) ? p.accent.trim().toLowerCase() : ''
      const luminance = hex ? (0.299 * parseInt(hex.slice(1, 3), 16) + 0.587 * parseInt(hex.slice(3, 5), 16) + 0.114 * parseInt(hex.slice(5, 7), 16)) / 255 : 1
      const accent = luminance < 0.6 ? hex : ''
      return { ...prev, destination: next as unknown as QrDestination, fgColor: accent || prev.fgColor }
    })
  }

  const isValid = (() => {
    if (!form.label.trim()) return false
    const d = form.destination as unknown as Record<string, string>
    if (form.contentType === 'link') return !!d.url?.trim()
    if (form.contentType === 'whatsapp') return !!d.phone?.trim()
    if (form.contentType === 'phone') return !!d.phone?.trim()
    if (form.contentType === 'sms') return !!d.phone?.trim()
    if (form.contentType === 'email') return !!d.email?.trim()
    if (form.contentType === 'wifi') return !!d.ssid?.trim()
    if (form.contentType === 'vcard') return !!d.firstName?.trim() || !!d.lastName?.trim()
    return false
  })()

  const handleSubmit = async () => {
    setSaving(true)
    setError(null)
    try {
      if (props.mode === 'create') {
        const result = await createQrCode(form)
        if (!result.success) {
          setError(result.message)
          return
        }
        // Back to the list, not the new code's own detail page — creating
        // should close this view, not open another one.
        router.push('/marketplace/qr-code-pro')
      } else {
        const result = await updateQrCode(props.id, form)
        if (!result.success) {
          setError(result.message)
          return
        }
        router.push(`/marketplace/qr-code-pro/${props.id}`)
      }
    } finally {
      setSaving(false)
    }
  }

  const d = form.destination as unknown as Record<string, string>

  return (
    <div className="bg-white rounded-2xl shadow-[0_14px_40px_rgba(23,23,23,0.08)] border border-[var(--gold)]/25 p-6 sm:p-8 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('labelField')}</label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
          placeholder={t('labelPlaceholder')}
          className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('contentTypeLabel')}</label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {QR_CONTENT_TYPES.map((type) => {
            const Icon = TYPE_ICONS[type]
            return (
              <button
                key={type}
                type="button"
                onClick={() => setType(type)}
                className={`flex flex-col items-center gap-1 px-2 py-3 rounded-lg text-xs font-medium border-2 transition-all ${
                  form.contentType === type
                    ? 'border-[var(--ink)] bg-[var(--gold-pale)] text-[var(--ink)]'
                    : 'border-[var(--gold)]/20 text-gray-600 hover:border-[var(--gold)]/60'
                }`}
              >
                <Icon className="w-5 h-5" />
                {t(`type_${type}`)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-3">
        {IMPORT_TYPES.includes(form.contentType) && (
          <BusinessProfileImport key={form.contentType} profile={props.business ?? null} onImport={importBusiness} />
        )}

        {form.contentType === 'link' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('urlLabel')}</label>
            <input
              type="text"
              value={d.url || ''}
              onChange={(e) => setDestField('url', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
            />
          </div>
        )}

        {(form.contentType === 'whatsapp' || form.contentType === 'phone' || form.contentType === 'sms') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('phoneLabel')}</label>
            <input
              type="tel"
              value={d.phone || ''}
              onChange={(e) => setDestField('phone', e.target.value)}
              placeholder="+39 333 1234567"
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
            />
          </div>
        )}

        {(form.contentType === 'whatsapp' || form.contentType === 'sms') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('messageLabel')}</label>
            <textarea
              value={d.message || ''}
              onChange={(e) => setDestField('message', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
            />
          </div>
        )}

        {form.contentType === 'email' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailLabel')}</label>
              <input
                type="email"
                value={d.email || ''}
                onChange={(e) => setDestField('email', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('subjectLabel')}</label>
              <input
                type="text"
                value={d.subject || ''}
                onChange={(e) => setDestField('subject', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('messageLabel')}</label>
              <textarea
                value={d.body || ''}
                onChange={(e) => setDestField('body', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
              />
            </div>
          </>
        )}

        {form.contentType === 'wifi' && (
          <>
            <p className="text-xs text-[var(--muted)] bg-[var(--gold-pale)]/50 border border-[var(--gold)]/20 rounded-lg p-3">{t('wifiStaticNotice')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('ssidLabel')}</label>
                <input
                  type="text"
                  value={d.ssid || ''}
                  onChange={(e) => setDestField('ssid', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('encryptionLabel')}</label>
                <select
                  value={d.encryption || 'WPA'}
                  onChange={(e) => setDestField('encryption', e.target.value as WifiEncryption)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm bg-white"
                >
                  {WIFI_ENCRYPTIONS.map((enc) => (
                    <option key={enc} value={enc}>
                      {t(`encryption_${enc}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {d.encryption !== 'nopass' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('wifiPasswordLabel')}</label>
                <input
                  type="text"
                  value={d.password || ''}
                  onChange={(e) => setDestField('password', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
            )}
          </>
        )}

        {form.contentType === 'vcard' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('firstNameLabel')}</label>
                <input
                  type="text"
                  value={d.firstName || ''}
                  onChange={(e) => setDestField('firstName', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('lastNameLabel')}</label>
                <input
                  type="text"
                  value={d.lastName || ''}
                  onChange={(e) => setDestField('lastName', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
            </div>

            <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wide pt-2">{t('contactInfoSection')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('vcardPhoneLabel')}</label>
                <input
                  type="tel"
                  value={d.phone || ''}
                  onChange={(e) => setDestField('phone', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('mobileLabel')}</label>
                <input
                  type="tel"
                  value={d.mobile || ''}
                  onChange={(e) => setDestField('mobile', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailLabel')}</label>
                <input
                  type="email"
                  value={d.email || ''}
                  onChange={(e) => setDestField('email', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('websiteLabel')}</label>
                <input
                  type="text"
                  value={d.website || ''}
                  onChange={(e) => setDestField('website', e.target.value)}
                  placeholder="https://..."
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
            </div>

            <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wide pt-2">{t('companyInfoSection')}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('companyLabel')}</label>
              <input
                type="text"
                value={d.company || ''}
                onChange={(e) => setDestField('company', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('jobTitleLabel')}</label>
                <input
                  type="text"
                  value={d.jobTitle || ''}
                  onChange={(e) => setDestField('jobTitle', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('faxLabel')}</label>
                <input
                  type="text"
                  value={d.fax || ''}
                  onChange={(e) => setDestField('fax', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
            </div>

            <p className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wide pt-2">{t('positionSection')}</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('addressLabel')}</label>
              <input
                type="text"
                value={d.address || ''}
                onChange={(e) => setDestField('address', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('cityLabel')}</label>
                <input
                  type="text"
                  value={d.city || ''}
                  onChange={(e) => setDestField('city', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('postalCodeLabel')}</label>
                <input
                  type="text"
                  value={d.postalCode || ''}
                  onChange={(e) => setDestField('postalCode', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('countryLabel')}</label>
                <input
                  type="text"
                  value={d.country || ''}
                  onChange={(e) => setDestField('country', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
            </div>
          </>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{t('quickColorsLabel')}</label>
        <div className="flex flex-wrap gap-2">
          {ALL_STANDARD_COLOR_KEYS.map((key) => {
            const preset = STANDARD_COLORS[key]
            // Nero/Bianco/Giallo work as the QR's dark side normally, but a
            // light color (Bianco, Giallo) used as the foreground on a white
            // background would be unreadable — pair those with an ink
            // background instead so every swatch stays scannable.
            const nextFg = preset.isLight ? '#171717' : preset.hex
            const nextBg = preset.isLight ? preset.hex : '#ffffff'
            const selected = form.fgColor.toLowerCase() === nextFg.toLowerCase() && form.bgColor.toLowerCase() === nextBg.toLowerCase()
            return (
              <button
                key={key}
                type="button"
                title={preset.label}
                onClick={() => setForm((prev) => ({ ...prev, fgColor: nextFg, bgColor: nextBg }))}
                className={`w-8 h-8 rounded-full border-2 shadow ring-1 ring-gray-200 transition-transform hover:scale-110 ${
                  selected ? 'border-[var(--gold)]' : 'border-white'
                }`}
                style={{ backgroundColor: preset.hex }}
              />
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('fgColorLabel')}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.fgColor}
              onChange={(e) => setForm((prev) => ({ ...prev, fgColor: e.target.value }))}
              className="h-9 w-12 rounded cursor-pointer border border-gray-300"
            />
            <span className="text-xs font-mono text-gray-500 uppercase">{form.fgColor}</span>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">{t('bgColorLabel')}</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.bgColor}
              onChange={(e) => setForm((prev) => ({ ...prev, bgColor: e.target.value }))}
              className="h-9 w-12 rounded cursor-pointer border border-gray-300"
            />
            <span className="text-xs font-mono text-gray-500 uppercase">{form.bgColor}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-2 text-red-800 text-sm">
          <XCircle className="w-5 h-5 shrink-0" />
          {t(error)}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!isValid || saving}
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
            {props.mode === 'create' ? t('create') : t('saveChanges')}
          </>
        )}
      </button>
    </div>
  )
}
