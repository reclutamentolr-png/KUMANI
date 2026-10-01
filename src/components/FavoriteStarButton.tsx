'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { Star } from 'lucide-react'
import { addFavorite, removeFavorite } from '@/app/actions/favorites'

export default function FavoriteStarButton({
  toolName,
  initialIsFavorite,
  variant = 'dark',
  onToggle,
}: {
  toolName: string
  initialIsFavorite: boolean
  // 'dark' sits over a dark/image card header (MarketplaceCard); 'light'
  // sits directly on a paper-colored card (ToolTiers).
  variant?: 'dark' | 'light'
  onToggle?: (toolName: string, isFavorite: boolean) => void
}) {
  const t = useTranslations('marketplace')
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite)
  const [isPending, startTransition] = useTransition()

  const handleClick = (e: React.MouseEvent) => {
    // The star sits inside a card that's itself a link to the tool.
    e.preventDefault()
    e.stopPropagation()

    const next = !isFavorite
    setIsFavorite(next)
    onToggle?.(toolName, next)

    startTransition(async () => {
      const result = next ? await addFavorite(toolName) : await removeFavorite(toolName)
      if (!result.success) {
        // Revert the optimistic update if the write didn't actually land.
        setIsFavorite(!next)
        onToggle?.(toolName, !next)
      }
    })
  }

  const idleClass = variant === 'light' ? 'text-gray-300 hover:text-gray-400' : 'text-white/70 hover:text-white'
  const bgClass = variant === 'light' ? 'bg-white/80 hover:bg-white' : 'bg-black/25 hover:bg-black/40 backdrop-blur-sm'

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
      title={isFavorite ? t('removeFromFavorites') : t('addToFavorites')}
      className={`absolute right-3 top-3 z-20 rounded-full p-1.5 transition-colors ${bgClass}`}
    >
      <Star className={`h-4.5 w-4.5 ${isFavorite ? 'fill-[var(--gold)] text-[var(--gold)]' : `fill-none ${idleClass}`}`} />
    </button>
  )
}
