'use client'

import { Pencil } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { Listing } from '@/lib/listings'

export default function EditListingButton({ listing }: { listing: Listing }) {
  const t = useTranslations('marketplace')

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent('openEditListing', { detail: { listing } }))
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-[var(--gold)] hover:text-[var(--ink)] text-xs font-bold flex items-center gap-1"
    >
      <Pencil className="w-3 h-3" /> {t('editListing')}
    </button>
  )
}
