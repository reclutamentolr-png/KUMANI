import type { SupabaseClient } from '@supabase/supabase-js'
import { hasActiveToolAccess } from '@/lib/subscriptionGate'
import type { QuoteInventoryProduct } from '@/lib/quotes'

export function hasActivePreventiviAccess(supabase: SupabaseClient, userId: string): Promise<boolean> {
  return hasActiveToolAccess(supabase, userId, 'preventivi')
}

// Prodotti attivi del Magazzino da proporre nelle righe del preventivo:
// null se il piano non comprende il Magazzino (il pulsante non si mostra)
export async function loadQuoteInventoryProducts(
  supabase: SupabaseClient,
  userId: string
): Promise<QuoteInventoryProduct[] | null> {
  if (!(await hasActiveToolAccess(supabase, userId, 'magazzino'))) return null
  const { data } = await supabase
    .from('inventory_products')
    .select('id, name, sku, unit, sale_price, stock')
    .eq('owner_id', userId)
    .eq('is_active', true)
    .order('name')
    .limit(500)
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku ?? null,
    unit: p.unit,
    sale_price: p.sale_price === null ? null : Number(p.sale_price),
    stock: Number(p.stock) || 0,
  }))
}
