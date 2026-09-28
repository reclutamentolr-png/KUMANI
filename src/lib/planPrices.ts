import { unstable_cache } from 'next/cache'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getStripe } from '@/lib/stripe'

// Prezzi dei piani mostrati sul sito: letti direttamente da Stripe (i prezzi
// STRIPE_PRICE_ID / STRIPE_PRICE_ID_PRO usati dal checkout), così non possono
// essere diversi da quelli che l'utente paga davvero. Cache di un'ora; se
// Stripe non risponde si usano gli ultimi valori salvati in system_settings
// (subscription_price_eur / pro_price_eur).
export type PlanPrices = { base: number; pro: number; source: 'stripe' | 'settings' }

async function priceFromStripe(priceId: string | undefined): Promise<number | null> {
  if (!priceId || !process.env.STRIPE_SECRET_KEY) return null
  try {
    const price = await getStripe().prices.retrieve(priceId)
    return typeof price.unit_amount === 'number' ? price.unit_amount / 100 : null
  } catch (err) {
    console.error('[planPrices] Stripe price read failed:', err instanceof Error ? err.message : err)
    return null
  }
}

async function priceFromSettings(key: string, fallback: number): Promise<number> {
  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data } = await service.from('system_settings').select('value').eq('key', key).maybeSingle()
  const value = Number(String(data?.value ?? '').replace(/"/g, ''))
  return Number.isFinite(value) && value > 0 ? value : fallback
}

const fetchPlanPrices = unstable_cache(
  async (): Promise<PlanPrices> => {
    const [base, pro] = await Promise.all([priceFromStripe(process.env.STRIPE_PRICE_ID), priceFromStripe(process.env.STRIPE_PRICE_ID_PRO)])
    if (base !== null && pro !== null) return { base, pro, source: 'stripe' }
    return {
      base: base ?? (await priceFromSettings('subscription_price_eur', 49)),
      pro: pro ?? (await priceFromSettings('pro_price_eur', 149)),
      source: 'settings',
    }
  },
  ['plan-prices'],
  { revalidate: 3600 },
)

export function getPlanPrices(): Promise<PlanPrices> {
  return fetchPlanPrices()
}
