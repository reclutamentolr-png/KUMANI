import { ArrowLeftRight, Bike, Building2, Car, Gift, HandHeart, House, PawPrint, Shirt, Smartphone, Sofa, Sprout, Wrench, type LucideIcon } from 'lucide-react'
import type { ListingCategory } from '@/lib/listings'

// Icone delle categorie della Bacheca nello stile KUMANI (linee al posto
// delle emoji). Nei menu a tendina resta solo il nome: lì le icone non si
// possono mostrare.
export const LISTING_CATEGORY_ICON: Record<ListingCategory, LucideIcon> = {
  veicoli: Car,
  immobili: House,
  elettronica: Smartphone,
  moda: Shirt,
  casa_persona: Sofa,
  tempo_libero: Bike,
  colf_badanti: HandHeart,
  agricoltura: Sprout,
  animali: PawPrint,
  impresa: Building2,
  servizi: Wrench,
  regalo: Gift,
  baratto: ArrowLeftRight,
}

export default function ListingCategoryIcon({ category, className = 'h-3.5 w-3.5' }: { category: string; className?: string }) {
  const Icon = LISTING_CATEGORY_ICON[category as ListingCategory] ?? Wrench
  return <Icon className={className} aria-hidden />
}

// Grande, oro su nero: per le schede senza foto
export function ListingCategoryBadge({ category }: { category: string }) {
  return (
    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ink)] shadow-lg ring-2 ring-[var(--gold)]/70 transition-transform duration-300 group-hover:scale-110">
      <ListingCategoryIcon category={category} className="h-8 w-8 text-[var(--gold-bright)]" />
    </span>
  )
}
