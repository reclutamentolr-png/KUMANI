import type { SupabaseClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getPlanPrices } from '@/lib/planPrices'
import { getToolPassOffer } from '@/lib/toolPasses'
import { FLYERS, type FlyerPlan } from '@/lib/flyers'

// Dati dei volantini letti dal server: nomi dei servizi nella lingua
// dell'utente, piano e prezzi attuali, volantini attivati in Admin.

export async function getFlyerTitles(): Promise<Record<string, string>> {
  const mt = await getTranslations('marketplace')
  const st = await getTranslations('spotlight')
  const titles: Record<string, string> = {}
  for (const tool of getMarketplaceTools((key) => mt(key))) titles[tool.toolName] = tool.title.split(/\s[-–—]\s/)[0]
  titles.listings = mt('listings')
  titles.convivio = mt('convivio')
  titles.timebank = mt('timebank')
  titles.events = mt('events')
  titles.spotlight = st('title')
  return titles
}

export async function getFlyerPlan(supabase: SupabaseClient, tool: string): Promise<FlyerPlan> {
  const [offer, prices] = await Promise.all([getToolPassOffer(supabase, tool), getPlanPrices()])
  const plan = offer.requiredPlan === 'pro' ? 'pro' : offer.requiredPlan === 'free' ? 'free' : 'base'
  return {
    plan,
    planPrice: plan === 'pro' ? prices.pro : plan === 'base' ? prices.base : 0,
    // "Vendibile da solo" (Admin): il Pass compare per i servizi Base e Pro
    passPrice: plan !== 'free' && offer.enabled ? offer.priceCents / 100 : null,
  }
}

export async function listPublishedFlyers(supabase: SupabaseClient): Promise<Set<string>> {
  const { data, error } = await supabase.from('flyer_settings').select('tool_name').eq('is_published', true)
  if (error) return new Set()
  const known = new Set(FLYERS.map((f) => f.tool))
  return new Set((data ?? []).map((r) => r.tool_name as string).filter((t) => known.has(t)))
}
