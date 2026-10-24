'use client'

import { useTranslations, useLocale } from 'next-intl'
import { X, Tag, User, Calendar, Sparkles, MapPin, Globe2, ShieldCheck, ShieldAlert } from 'lucide-react'
import { countryName } from '@/lib/events'
import { CATEGORY_I18N_KEYS, type Listing, type ListingCategory } from '@/lib/listings'
import ListingCategoryIcon from '@/components/listings/ListingCategoryIcon'
import ListingGallery from '@/components/listings/ListingGallery'
import Link from '@/components/LocalizedLink'
import { detectMessageSafety } from '@/lib/messageSafety'
import ContactListingButton from '@/components/ContactListingButton'
import VerifiedBadge from '@/components/verification/VerifiedBadge'
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
  // Link e IBAN scritti nell'annuncio: per chi compra, da controllare con KUMANI
  const safety = detectMessageSafety(`${listing.title}\n${listing.description}`)
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
          {/* Tutte le foto, da scorrere (la prima è la copertina) */}
          <ListingGallery images={listing.images?.length ? listing.images : listing.image_url ? [listing.image_url] : []} alt={listing.title} />

          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded">
              <ListingCategoryIcon category={listing.category} /> {t(CATEGORY_I18N_KEYS[listing.category as ListingCategory] || 'catServizi')}
            </span>
            {listing.price != null && listing.price !== '' && (
              <span className="rounded-lg bg-[var(--ink)] px-3 py-1 text-lg font-bold text-[var(--gold-bright)] shadow-sm">
                {new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(Number(listing.price))}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-700 whitespace-pre-wrap">{listing.description}</p>

          {/* Fiducia: controllato dallo Staff; per chi compra, avvisi su link e IBAN */}
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="h-4 w-4 shrink-0" /> {t('trustReviewed')}
            </p>
            {!isOwn && <p className="text-xs leading-5 text-emerald-800">{t('trustTips')}</p>}
            {!isOwn && safety.iban && (
              <Link href={`/app/verifica-iban?iban=${encodeURIComponent(safety.iban.normalized)}`} className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {t('trustIban')}
              </Link>
            )}
            {!isOwn && safety.url && (
              <Link href={`/controlla?q=${encodeURIComponent(safety.url)}`} className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-2.5 py-1.5 text-xs font-semibold text-amber-900">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> {t('trustLink')}
              </Link>
            )}
          </div>

          {(listing.city || listing.region || listing.country_code || listing.is_remote) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-medium text-gray-700">
              {(listing.city || listing.region || listing.country_code) && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-[var(--gold)]" />
                  {[listing.city, listing.region, countryName(listing.country_code ?? null, locale)].filter(Boolean).join(', ')}
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
                <User className="w-3 h-3" /> {authorName} <VerifiedBadge userId={listing.user_id} />
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
