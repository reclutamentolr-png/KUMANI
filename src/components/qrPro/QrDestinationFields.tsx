'use client'

import { useTranslations } from 'next-intl'
import { WIFI_ENCRYPTIONS, type QrContentType, type WifiEncryption } from '@/lib/qrPro'

// Campi di un QR Code PRO secondo il tipo (sito, WhatsApp, telefono, SMS,
// email, Wi-Fi, scheda contatto): nel modulo di un QR e per ogni contatto di
// una pagina «Più contatti».
// inPage: contatto di una pagina «Più contatti» (la pagina si cambia quando si
// vuole: niente avviso del Wi-Fi scritto dentro il QR)
export default function QrDestinationFields({ type, d, set, inPage = false }: { type: QrContentType; d: Record<string, string>; set: (key: string, value: string) => void; inPage?: boolean }) {
  const t = useTranslations('qrCodePro')
  return (
    <>
        {type === 'link' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('urlLabel')}</label>
            <input
              type="text"
              value={d.url || ''}
              onChange={(e) => set('url', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
            />
          </div>
        )}

        {(type === 'whatsapp' || type === 'phone' || type === 'sms') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('phoneLabel')}</label>
            <input
              type="tel"
              value={d.phone || ''}
              onChange={(e) => set('phone', e.target.value)}
              placeholder="+39 333 1234567"
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
            />
          </div>
        )}

        {(type === 'whatsapp' || type === 'sms') && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('messageLabel')}</label>
            <textarea
              value={d.message || ''}
              onChange={(e) => set('message', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
            />
          </div>
        )}

        {type === 'email' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailLabel')}</label>
              <input
                type="email"
                value={d.email || ''}
                onChange={(e) => set('email', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('subjectLabel')}</label>
              <input
                type="text"
                value={d.subject || ''}
                onChange={(e) => set('subject', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('messageLabel')}</label>
              <textarea
                value={d.body || ''}
                onChange={(e) => set('body', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
              />
            </div>
          </>
        )}

        {type === 'wifi' && (
          <>
            {!inPage && <p className="text-xs text-[var(--muted)] bg-[var(--gold-pale)]/50 border border-[var(--gold)]/20 rounded-lg p-3">{t('wifiStaticNotice')}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('ssidLabel')}</label>
                <input
                  type="text"
                  value={d.ssid || ''}
                  onChange={(e) => set('ssid', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('encryptionLabel')}</label>
                <select
                  value={d.encryption || 'WPA'}
                  onChange={(e) => set('encryption', e.target.value as WifiEncryption)}
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
                  onChange={(e) => set('password', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
            )}
          </>
        )}

        {type === 'vcard' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('firstNameLabel')}</label>
                <input
                  type="text"
                  value={d.firstName || ''}
                  onChange={(e) => set('firstName', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('lastNameLabel')}</label>
                <input
                  type="text"
                  value={d.lastName || ''}
                  onChange={(e) => set('lastName', e.target.value)}
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
                  onChange={(e) => set('phone', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('mobileLabel')}</label>
                <input
                  type="tel"
                  value={d.mobile || ''}
                  onChange={(e) => set('mobile', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('emailLabel')}</label>
                <input
                  type="email"
                  value={d.email || ''}
                  onChange={(e) => set('email', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('websiteLabel')}</label>
                <input
                  type="text"
                  value={d.website || ''}
                  onChange={(e) => set('website', e.target.value)}
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
                onChange={(e) => set('company', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('jobTitleLabel')}</label>
                <input
                  type="text"
                  value={d.jobTitle || ''}
                  onChange={(e) => set('jobTitle', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('faxLabel')}</label>
                <input
                  type="text"
                  value={d.fax || ''}
                  onChange={(e) => set('fax', e.target.value)}
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
                onChange={(e) => set('address', e.target.value)}
                className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('cityLabel')}</label>
                <input
                  type="text"
                  value={d.city || ''}
                  onChange={(e) => set('city', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('postalCodeLabel')}</label>
                <input
                  type="text"
                  value={d.postalCode || ''}
                  onChange={(e) => set('postalCode', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('countryLabel')}</label>
                <input
                  type="text"
                  value={d.country || ''}
                  onChange={(e) => set('country', e.target.value)}
                  className="w-full px-3 py-2 border-2 border-[var(--gold)]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/30 focus:border-[var(--gold)] text-sm"
                />
              </div>
            </div>
          </>
        )}
    </>
  )
}
