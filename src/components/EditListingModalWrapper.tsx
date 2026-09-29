'use client'

import { useState, useEffect } from 'react'
import EditListingModal from '@/components/EditListingModal'
import type { Listing } from '@/lib/listings'

export default function EditListingModalWrapper({ citiesByCountry }: { citiesByCountry: Record<string, string[]> }) {
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

  return <EditListingModal isOpen={open} onClose={() => setOpen(false)} listing={listing} citiesByCountry={citiesByCountry} />
}
