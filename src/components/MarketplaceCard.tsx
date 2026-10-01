'use client'

import Link from '@/components/LocalizedLink' // ✅ Sostituisci 'next/link'
import { useTranslations } from 'next-intl'
import { Smartphone } from 'lucide-react'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import FavoriteStarButton from '@/components/FavoriteStarButton'

type MarketplaceCardProps = {
  toolName: string
  isEnabled: boolean
  href: string
  gradient: string
  iconName: string
  title: string
  description: string
  color: string
  disabledReason?: 'offline' | 'subscription' | 'pro'
  // Strumento del piano Pro: badge "PRO" sulla scheda.
  isPro?: boolean
  // Acquistabile anche da solo (pass): la scheda bloccata porta alla sua pagina
  hasPass?: boolean
  isFavorite?: boolean
  onFavoriteToggle?: (toolName: string, isFavorite: boolean) => void
}

export default function MarketplaceCard({
  toolName,
  isEnabled,
   href,
   iconName,
   title,
   description,
   disabledReason,
   isPro = false,
   hasPass = false,
   isFavorite = false,
   onFavoriteToggle,
}: MarketplaceCardProps) {
  const t = useTranslations('marketplace')
  const Icon = marketplaceIconMap[iconName] || Smartphone
  
  // Strumento Pro senza piano Pro: la scheda porta a "Passa a Pro".
  const upgradeHref =
    disabledReason && disabledReason !== 'offline' && hasPass ? `/pass/${toolName}` : disabledReason === 'pro' ? `/pro?tool=${toolName}` : null

  const handleClick = (e: React.MouseEvent) => {
    if (!isEnabled && !upgradeHref) {
      e.preventDefault()
      alert(t('toolUnavailable', { title }))
    }
  }

  return (
    <Link
      href={isEnabled ? href : upgradeHref ?? '#'}
      onClick={handleClick}
      className={`group flex h-full min-h-[356px] flex-col rounded-xl border transition-all duration-300 overflow-hidden ${
        isEnabled
          ? 'border-[var(--gold)]/45 bg-[var(--paper)] shadow-[0_12px_35px_rgba(23,23,23,0.08)] hover:-translate-y-1 hover:border-[var(--gold-bright)] hover:shadow-[0_18px_45px_rgba(23,23,23,0.16)] cursor-pointer'
          : upgradeHref
            ? 'border-[var(--gold)]/45 bg-[var(--paper)] opacity-80 hover:opacity-100 cursor-pointer'
            : 'border-stone-300 bg-stone-100 cursor-not-allowed opacity-70'
      }`}
    >
      <div
        className={`relative flex h-40 items-center justify-center overflow-hidden border-b border-[var(--gold)]/35 ${
          isEnabled ? 'bg-[var(--ink)]' : 'bg-gradient-to-br from-gray-400 to-gray-500'
        }`}
      >
        {isEnabled && <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(231,197,106,0.2),transparent_55%)]" />}
        {isEnabled && <FavoriteStarButton toolName={toolName} initialIsFavorite={isFavorite} variant="dark" onToggle={onFavoriteToggle} />}
        <Icon className="relative z-10 h-16 w-16 text-[var(--gold-bright)] transition-transform duration-300 group-hover:scale-110" strokeWidth={1.4} />
      </div>
      <div className="relative flex flex-1 flex-col p-6">
        {isPro && (
          <div className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-2 py-0.5 text-[10px] font-extrabold tracking-wider text-[var(--ink)]">
            PRO
          </div>
        )}
        {!isEnabled && (
          <div className={`absolute right-4 top-4 rounded-full px-2 py-1 text-xs font-bold ${upgradeHref ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-red-500 text-white'}`}>
            {disabledReason === 'pro' ? t('proRequired') : disabledReason === 'subscription' ? t('subscriptionRequired') : t('notAvailable')}
          </div>
        )}
        <div className="flex justify-between items-start mb-2">
          <h3
            className={`text-xl font-bold ${
              isEnabled ? 'text-[var(--ink)] group-hover:text-[var(--gold)]' : 'text-gray-500'
            }`}
          >
            {title}
          </h3>
        </div>
        <p className={`mb-4 text-sm leading-6 ${isEnabled ? 'text-[var(--muted)]' : 'text-gray-400'}`}>
          {description}
        </p>
        {isEnabled ? (
          <span className="mt-auto text-sm font-semibold text-[var(--gold)] group-hover:text-[var(--ink)]">
            {t('useTool')} →
          </span>
        ) : (
          <span className="text-gray-400 font-semibold text-sm">
            {disabledReason === 'subscription' ? t('subscriptionRequired') : t('temporarilyOffline')}
          </span>
        )}
      </div>
    </Link>
  )
}