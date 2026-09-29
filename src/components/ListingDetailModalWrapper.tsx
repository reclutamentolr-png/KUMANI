'use client'

import { useState, useEffect } from 'react'
import ListingDetailModal from '@/components/ListingDetailModal'
import type { Listing } from '@/lib/listings'

// `initial`: annuncio da aprire subito (link condiviso ?listing=...)
export default function ListingDetailModalWrapper({
  initial,
}: {
  initial?: { listing: Listing; authorName?: string; isOwn: boolean }
}) {
  const [open, setOpen] = useState(Boolean(initial))
  const [listing, setListing] = useState<Listing | null>(initial?.listing ?? null)
  const [authorName, setAuthorName] = useState<string | undefined>(initial?.authorName)
  const [isOwn, setIsOwn] = useState(initial?.isOwn ?? false)

  useEffect(() => {
    const handleOpen = (event: CustomEvent) => {
      setListing(event.detail.listing)
      setAuthorName(event.detail.authorName)
      setIsOwn(event.detail.isOwn)
      setOpen(true)
    }
    // "Contatta l'autore" inside this popup opens the chat modal via its own
    // openChat event — without this, both overlays stacked and the chat was
    // unreachable until this one was closed manually.
    const handleOpenChat = () => setOpen(false)

    window.addEventListener('openListingDetail', handleOpen as EventListener)
    window.addEventListener('openChat', handleOpenChat)
    return () => {
      window.removeEventListener('openListingDetail', handleOpen as EventListener)
      window.removeEventListener('openChat', handleOpenChat)
    }
  }, [])

  if (!open || !listing) return null

  return (
    <ListingDetailModal
      isOpen={open}
      onClose={() => {
        setOpen(false)
        // Aperto da un link condiviso: via ?listing= così ricaricando non si riapre
        const url = new URL(window.location.href)
        if (url.searchParams.has('listing')) {
          url.searchParams.delete('listing')
          window.history.replaceState(null, '', url.pathname + url.search)
        }
      }}
      listing={listing}
      authorName={authorName}
      isOwn={isOwn}
    />
  )
}
