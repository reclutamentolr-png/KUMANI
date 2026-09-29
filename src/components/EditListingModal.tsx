'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { X, AlertCircle, CheckCircle2 } from 'lucide-react'
import { updateListingAction } from '@/app/actions/listings'
import { type ListingCategory, CATEGORY_ICONS, CATEGORY_I18N_KEYS, ALL_LISTING_CATEGORIES } from '@/lib/listings'
import ListingLocationFields, { type ListingLocationValue } from '@/components/listings/ListingLocationFields'

type Props = {
  isOpen: boolean
  onClose: () => void
  listing: any
  citiesByCountry: Record<string, string[]>
}

export default function EditListingModal({ isOpen, onClose, listing, citiesByCountry }: Props) {
  const t = useTranslations('marketplace')
  const commonT = useTranslations('common')
  const router = useRouter()

  const [formData, setFormData] = useState({
    title: listing?.title || '',
    description: listing?.description || '',
    category: (listing?.category || 'servizi') as ListingCategory,
    price: listing?.price != null ? String(listing.price) : '',
    imageUrl: listing?.image_url || '',
  })
  const [location, setLocation] = useState<ListingLocationValue>({
    countryCode: listing?.country_code || '',
    city: listing?.city || '',
    isRemote: Boolean(listing?.is_remote),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen || !listing) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const result = await updateListingAction(listing.id, {
      title: formData.title,
      description: formData.description,
      category: formData.category,
      price: formData.price ? parseFloat(formData.price) : undefined,
      imageUrl: formData.imageUrl || undefined,
      countryCode: location.countryCode,
      city: location.city || undefined,
      isRemote: location.isRemote,
    })

    setSaving(false)
    if (!result.success) {
      setError(result.message ?? t('editListingError'))
      return
    }

    setSuccess(true)
    router.refresh()
    setTimeout(() => {
      onClose()
      setSuccess(false)
    }, 1200)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-900">{t('editListingTitle')}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4" /> {t('editListingSuccess')}
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('listingTitle')} *</label>
              <input
                type="text"
                required
                maxLength={100}
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('listingCategory')} *</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as ListingCategory })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)]"
              >
                {ALL_LISTING_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {t(CATEGORY_I18N_KEYS[cat])}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('listingDescription')} *</label>
              <textarea
                required
                maxLength={1000}
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)]"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('listingPrice')}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('listingImageUrl')}</label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--gold)]"
                />
              </div>
            </div>

            <ListingLocationFields value={location} onChange={setLocation} citiesByCountry={citiesByCountry} />

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
              <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-2">
                {commonT('cancel')}
              </button>
              <button
                type="submit"
                disabled={saving}
                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md disabled:opacity-50"
              >
                {saving ? commonT('loading') : commonT('save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
