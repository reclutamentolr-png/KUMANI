'use client'

import { useState } from 'react'
import MarketplaceCard from '@/components/MarketplaceCard'

type FavoriteTool = {
  toolName: string
  isEnabled: boolean
  href: string
  gradient: string
  iconName: string
  title: string
  description: string
  color: string
  disabledReason?: 'offline' | 'subscription' | 'pro'
  hasPass?: boolean
  isPro?: boolean
}

// Client wrapper so un-starring a tool here removes its card immediately,
// instead of leaving a stale "favorited" card until the next page load.
export default function FavoritesGrid({ initialTools }: { initialTools: FavoriteTool[] }) {
  const [tools, setTools] = useState(initialTools)

  const handleToggle = (toolName: string, isFavorite: boolean) => {
    if (!isFavorite) {
      setTools((prev) => prev.filter((tool) => tool.toolName !== toolName))
    }
  }

  if (tools.length === 0) return null

  return (
    <div className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <MarketplaceCard key={tool.toolName} {...tool} isFavorite onFavoriteToggle={handleToggle} />
      ))}
    </div>
  )
}
