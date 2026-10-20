'use client'

import { useState, useEffect } from 'react'
import EditListingModal from '@/components/EditListingModal'
import type { Listing } from '@/lib/listings'

export default function EditListingModalWrapper({ citiesByCountry, maxPhotos = 6 }: { citiesByCountry: Record<string, string[]>; maxPhotos?: number }) {
  const [open, setOpen] = useState(false)
  const [listing, setListing] = useState<Listing | null>(null)

  useEffect(() => {
    const handleOpen = (event: CustomEvent) => {
      setListing(event.detail.listing)
      setOpen(true)
    }
    window.addEventListener('openEditListing', handleOpen as EventListener)
    return () => window.removeEventListener('openEditListing', handleOpen as EventListener)
  }, [])

  if (!open || !listing) return null

  return <EditListingModal isOpen={open} onClose={() => setOpen(false)} listing={listing} citiesByCountry={citiesByCountry} maxPhotos={maxPhotos} />
}
