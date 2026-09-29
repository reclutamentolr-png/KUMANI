'use client'

import { useTranslations, useLocale } from 'next-intl'
import { X, Tag, User, Calendar, Sparkles, MapPin, Globe2 } from 'lucide-react'
import { countryName } from '@/lib/events'
import { CATEGORY_ICONS, CATEGORY_I18N_KEYS, type Listing, type ListingCategory } from '@/lib/listings'
import ContactListingButton from '@/components/ContactListingButton'
import ReportListingButton from '@/components/ReportListingButton'
import ListingShareButtons from '@/components/listings/ListingShareButtons'

type Props = {
  isOpen: boolean
  onClose: () => void
  listing: Listing
  authorName?: string
  isOwn: boolean
}

export default function ListingDetailModal({ isOpen, onClose, listing, authorName, isOwn }: Props) {
  const t = useTranslations('marketplace')
  const locale = useLocale()

  if (!isOpen || !listing) return null

  const isFeatured = listing.featured_until && new Date(listing.featured_until).getTime() > new Date().getTime()

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start p-6 border-b border-gray-100">
          <div>
            {isFeatured && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full mb-2">
                <Sparkles className="w-2.5 h-2.5" /> {t('showcaseBadge')}
              </span>
            )}
            <h3 className="text-xl font-bold text-gray-900">{listing.title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0 ml-4">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {listing.image_url && (
            <img
              src={listing.image_url}
              alt={listing.title}
              className="w-full max-h-80 object-contain rounded-lg bg-gray-50 border border-gray-100"
            />
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded">
              {CATEGORY_ICONS[listing.category as ListingCategory]} {t(CATEGORY_I18N_KEYS[listing.category as ListingCategory] || 'catServizi')}
            </span>
            {listing.price != null && listing.price !== '' && (
              <span className="rounded-lg bg-[var(--ink)] px-3 py-1 text-lg font-bold text-[var(--gold-bright)] shadow-sm">
                {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(listing.price))}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-700 whitespace-pre-wrap">{listing.description}</p>

          {(listing.city || listing.country_code || listing.is_remote) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-gray-700">
              {(listing.city || listing.country_code) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[var(--gold)]" />
                  {[listing.city, countryName(listing.country_code ?? null, locale)].filter(Boolean).join(', ')}
                </span>
              )}
              {listing.is_remote && (
                <span className="flex items-center gap-1.5">
                  <Globe2 className="h-4 w-4 text-[var(--gold)]" /> {t('listingRemoteShort')}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
            {authorName && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {authorName}
              </span>
            )}
            {listing.created_at && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" /> {t('postedOn', { date: new Date(listing.created_at).toLocaleDateString(locale, { timeZone: 'Europe/Rome' }) })}
              </span>
            )}
          </div>

          <ListingShareButtons listingId={listing.id} title={listing.title} />

          {isOwn ? (
            <div className="w-full py-2 bg-green-50 border border-green-200 text-green-700 text-sm font-semibold rounded-lg flex items-center justify-center gap-1.5">
              <Tag className="w-4 h-4" />
              {t('myListing')}
            </div>
          ) : (
            <div className="space-y-2">
              <ContactListingButton
                listingId={listing.id}
                listingTitle={listing.title}
                listingCategory={listing.category}
                listingPrice={listing.price}
                listingDescription={listing.description}
                receiverId={listing.user_id}
                authorName={authorName || ''}
              />
              <ReportListingButton listingId={listing.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
