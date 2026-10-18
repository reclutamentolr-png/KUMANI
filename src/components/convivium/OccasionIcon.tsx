import { Coffee, Martini, PartyPopper, Pizza, Salad, Sparkles, UtensilsCrossed, Volleyball, type LucideIcon } from 'lucide-react'
import type { ConviviumOccasion } from '@/lib/convivium'

// Icone stilizzate delle occasioni, nello stile KUMANI (oro su nero). Le emoji
// restano solo nei testi (WhatsApp, notifiche, calendario).
export const OCCASION_ICON: Record<ConviviumOccasion, LucideIcon> = {
  aperitivo: Martini,
  pizza: Pizza,
  cena: UtensilsCrossed,
  pranzo: Salad,
  colazione: Coffee,
  festa: PartyPopper,
  sport: Volleyball,
  altro: Sparkles,
}

const SIZE = {
  sm: { box: 'h-12 w-12 rounded-xl', icon: 'h-6 w-6' },
  md: { box: 'h-14 w-14 rounded-2xl', icon: 'h-7 w-7' },
  lg: { box: 'h-24 w-24 rounded-full', icon: 'h-11 w-11' },
}

// Riquadro nero con bordo e icona oro
export function OccasionTile({ occasion, size = 'sm', className = '' }: { occasion: ConviviumOccasion; size?: keyof typeof SIZE; className?: string }) {
  const Icon = OCCASION_ICON[occasion] ?? Sparkles
  const s = SIZE[size]
  return (
    <span className={`flex shrink-0 items-center justify-center bg-[var(--ink)] ring-1 ring-[var(--gold)]/50 shadow-[0_8px_22px_-12px_rgba(201,162,77,0.7)] ${s.box} ${className}`} aria-hidden>
      <Icon className={`${s.icon} text-[var(--gold-bright)]`} strokeWidth={1.75} />
    </span>
  )
}
