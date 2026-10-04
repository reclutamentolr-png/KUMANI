import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { CANONICAL_ORIGIN as SITE_URL } from '@/lib/seo'
import { getEnabledLocales } from '@/lib/enabledLocales'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { PUBLIC_GUIDES } from '@/lib/guides/content'

// Pagine pubbliche nelle lingue attive (italiano senza prefisso): le lingue
// spente dall'Admin non compaiono per Google. Oltre alle pagine fisse: le
// pagine pubbliche dei servizi, le guide pubbliche e gli eventi in arrivo.
const PAGES = ['', '/chi-siamo', '/pro', '/events', '/spotlight', '/register', '/login', '/terms', '/privacy', '/contact', '/donazioni', '/guida', '/manuale-antitruffa']

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const LOCALES = await getEnabledLocales()
  const url = (locale: string, page: string) => `${SITE_URL}${locale === 'it' ? '' : `/${locale}`}${page}` || SITE_URL
  const entry = (page: string, priority: number, changeFrequency: 'daily' | 'weekly' | 'monthly' = 'monthly', lastModified?: string) => ({
    url: url('it', page),
    ...(lastModified ? { lastModified } : {}),
    changeFrequency,
    priority,
    alternates: { languages: Object.fromEntries(LOCALES.map((l) => [l, url(l, page)])) },
  })

  // Servizi (solo quelli accesi) ed eventi pubblicati in arrivo
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [{ data: settings }, { data: events }, { data: landings }] = await Promise.all([
    db.from('marketplace_settings').select('tool_name, is_enabled, updated_at'),
    db.from('events').select('id, updated_at').eq('status', 'published').gte('starts_at', new Date().toISOString()).limit(500),
    // Landing Page pubblicate dagli utenti Pro (una lingua sola, niente alternative)
    db.rpc('list_public_landings'),
  ])
  const off = new Set((settings ?? []).filter((s) => s.is_enabled === false).map((s) => s.tool_name as string))
  const updated = new Map((settings ?? []).filter((s) => s.updated_at).map((s) => [s.tool_name as string, new Date(s.updated_at as string).toISOString()]))
  const tools = getMarketplaceTools((key) => key).filter((tool) => !off.has(tool.toolName))

  return [
    ...PAGES.map((page) => entry(page, page === '' ? 1 : 0.6, page === '' ? 'weekly' : 'monthly')),
    // Data dell'ultima modifica dall'Admin (es. servizio riacceso): Google rilegge la pagina
    ...tools.map((tool) => entry(`/strumenti/${tool.toolName}`, 0.7, 'monthly', updated.get(tool.toolName))),
    ...PUBLIC_GUIDES.map((slug) => entry(`/guida/${slug}`, 0.5)),
    ...(events ?? []).map((e) => entry(`/events/${e.id}`, 0.5, 'weekly', e.updated_at as string | undefined)),
    ...((landings as { slug: string; updated_at: string }[] | null) ?? []).map((l) => ({
      url: `${SITE_URL}/p/${l.slug}`,
      lastModified: l.updated_at,
      changeFrequency: 'weekly' as const,
      priority: 0.4,
    })),
  ]
}
