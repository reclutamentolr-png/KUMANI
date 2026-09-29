'use client'

import { MessageCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'


export default function ContactListingButton({
  listingId,
  listingTitle,
  listingCategory,
  listingPrice,
  listingDescription,
  receiverId,
  authorName,
  compact = false,
}: {
  listingId: string
  listingTitle: string
  listingCategory: string
  listingPrice?: number
  listingDescription: string
  receiverId: string
  authorName: string
  // Narrower cards (the dashboard's community preview) need a smaller,
  // non-wrapping label so this button stays the same height as the
  // sibling "Il tuo annuncio" badge instead of wrapping to two lines.
  compact?: boolean
}) {
  const t = useTranslations('dashboard')
  const handleClick = () => {
    const listing = {
      id: listingId,
      title: listingTitle,
      category: listingCategory,
      price: listingPrice,
      description: listingDescription,
      user_id: receiverId,
      profiles: {
        first_name: authorName.split(' ')[0],
        last_name: authorName.split(' ')[1] || ''
      }
    }
    
    window.dispatchEvent(new CustomEvent('openChat', { 
      detail: { listing, receiverId, otherName: authorName.split(' ')[0] } 
    }))
  }

  return (
    <button
      onClick={handleClick}
      className={`w-full py-2 bg-[var(--gold-pale)] border border-[var(--gold)]/40 hover:bg-[var(--gold)] text-[var(--ink)] hover:text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 whitespace-nowrap ${compact ? 'text-xs' : 'text-sm'}`}
    >
      <MessageCircle className="w-4 h-4 shrink-0" />
      {t('contactAuthor')}
    </button>
  )
}
