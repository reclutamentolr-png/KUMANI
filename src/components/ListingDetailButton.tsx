'use client'

import type { Listing } from '@/lib/listings'

export default function ListingDetailButton({
  listing,
  authorName,
  isOwn,
  className,
  children,
}: {
  listing: Listing
  authorName?: string
  isOwn: boolean
  className?: string
  children: React.ReactNode
}) {
  const handleClick = () => {
    window.dispatchEvent(
      new CustomEvent('openListingDetail', { detail: { listing, authorName, isOwn } })
    )
  }

  return (
    <button type="button" onClick={handleClick} className={className}>
      {children}
    </button>
  )
}
