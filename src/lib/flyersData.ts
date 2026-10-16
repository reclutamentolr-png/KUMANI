import type { SupabaseClient } from '@supabase/supabase-js'
import { getTranslations } from 'next-intl/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getPlanPrices } from '@/lib/planPrices'
import { getToolPassOffer } from '@/lib/toolPasses'
import { FLYERS, type FlyerPlan } from '@/lib/flyers'
import { getSurprisePrices } from '@/lib/surpriseServer'
import { hubTabKey, TOOL_HUB } from '@/lib/serviceHubs'

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
  titles.sorprese = `KUMANI ${(await getTranslations('surprise'))('title')}`
  // Gestione attività: come nella barra («Magazzino», non «Magazzino PRO»)
  const tsh = await getTranslations('serviceHubs')
  for (const tool of Object.keys(TOOL_HUB).filter((name) => TOOL_HUB[name] === 'gestione')) titles[tool] = tsh(`gestione.tab_${hubTabKey(tool)}`)
  return titles
}

// Servizio unito di ogni strumento (lib/serviceHubs), nella lingua: «Speculum»…
export async function getFlyerHubNames(): Promise<Record<string, string>> {
  const tsh = await getTranslations('serviceHubs')
  return Object.fromEntries(Object.entries(TOOL_HUB).map(([tool, hub]) => [tool, tsh(`${hub}.title`)]))
}

export async function getFlyerPlan(supabase: SupabaseClient, tool: string): Promise<FlyerPlan> {
  // KUMANI Sorpresa: per tutti, si paga ogni sorpresa (dal prezzo più basso)
  if (tool === 'sorprese') {
    const prices = await getSurprisePrices()
    return { plan: 'surprise', planPrice: Math.min(...Object.values(prices)) / 100, passPrice: null }
  }
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
