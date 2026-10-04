import { unstable_cache } from 'next/cache'
import { getMessages, getTranslations } from 'next-intl/server'
import { createClient } from '@supabase/supabase-js'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { SERVICE_GROUPS, serviceGroupOf } from '@/lib/serviceGroups'
import { toolGuideFor } from '@/lib/guides/toolGuides'
import { getPlanPrices } from '@/lib/planPrices'

// Catalogo dei servizi (pagina /catalogo e PDF): per ogni servizio acceso
// solo l'essenziale, preso dai testi che esistono già — a cosa serve e i 3
// punti forti (volantini), come si usa (passi della guida) — nella lingua
// della pagina. Diviso per bisogno, come la pagina Servizi, più la Community.

export type CatalogItem = {
  toolName: string
  title: string
  iconName: string
  plan: 'free' | 'base' | 'pro'
  passPrice: string | null
  purpose: string
  points: { title: string; text: string }[]
  steps: { title: string; text: string }[]
  openHref: string
  guideHref: string | null
}

export type CatalogGroup = { key: string; label: string; items: CatalogItem[] }
export type Catalog = { groups: CatalogGroup[]; total: number; basePrice: string; proPrice: string }

type Setting = { tool_name: string; is_enabled: boolean; required_plan: string | null; pass_enabled: boolean | null; pass_price_cents: number | null }

// Impostazioni dei servizi (acceso/spento, piano, Pass): uguali per tutti
const fetchSettings = unstable_cache(
  async (): Promise<Setting[]> => {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data } = await db.from('marketplace_settings').select('tool_name, is_enabled, required_plan, pass_enabled, pass_price_cents')
    return (data ?? []) as Setting[]
  },
  ['catalog-settings'],
  { revalidate: 600 }
)

// Sezioni della Community (non sono nell'elenco dei servizi del Marketplace)
const COMMUNITY = [
  { toolName: 'listings', href: '/marketplace/listings', iconName: 'Tag', titleKey: 'listings' },
  { toolName: 'convivio', href: '/marketplace/convivio', iconName: 'HandPlatter', titleKey: 'convivio' },
  { toolName: 'events', href: '/events', iconName: 'PartyPopper', titleKey: 'events' },
  { toolName: 'timebank', href: '/marketplace/timebank', iconName: 'Hourglass', titleKey: 'timebank' },
  { toolName: 'spotlight', href: '/marketplace/spotlight', iconName: 'Star', titleKey: 'kumanoDelGiorno' },
]

type Texts = Record<string, Record<string, unknown>>

// Prima frase di un testo (i passi della guida restano brevi)
function firstSentence(text: string): string {
  const match = text.match(/^.*?[.!?](\s|$)/)
  return (match ? match[0] : text).trim()
}

export async function getCatalog(locale: string): Promise<Catalog> {
  const [messages, tm, th, tc, settings, prices] = await Promise.all([
    getMessages() as Promise<Record<string, unknown>>,
    getTranslations('marketplace'),
    getTranslations('hub'),
    getTranslations('catalog'),
    fetchSettings(),
    getPlanPrices(),
  ])
  const flyers = ((messages.flyers as Texts | undefined)?.tools ?? {}) as Texts
  const guides = (messages.guideTexts ?? {}) as Texts
  const seo = (messages.toolSeo ?? {}) as Texts
  const extraSteps = ((messages.catalog as Texts | undefined)?.extraSteps ?? {}) as Texts
  const byName = new Map(settings.map((row) => [row.tool_name, row]))
  const eur = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value)
  const key = (name: string) => name.replace(/-/g, '_')

  const build = (toolName: string, title: string, description: string, iconName: string, href: string, openHref: string): CatalogItem | null => {
    const setting = byName.get(toolName)
    if (setting && setting.is_enabled === false) return null
    const plan = (setting?.required_plan === 'pro' || setting?.required_plan === 'base' ? setting.required_plan : 'free') as CatalogItem['plan']
    const flyer = flyers[key(toolName)] as Record<string, string> | undefined
    const seoText = seo[key(toolName)] as { points?: string[] } | undefined
    const points = flyer?.p1
      ? [1, 2, 3].map((n) => ({ title: flyer[`p${n}`], text: flyer[`p${n}d`] ?? '' })).filter((p) => p.title)
      : (seoText?.points ?? []).slice(0, 3).map((title) => ({ title, text: '' }))
    const slug = toolGuideFor(href)
    const guide = slug ? (guides[key(slug)] as Record<string, string> | undefined) : undefined
    const steps: CatalogItem['steps'] = []
    const source = guide ?? (extraSteps[key(toolName)] as Record<string, string> | undefined)
    for (let n = 1; n <= 4 && source?.[`step${n}Title`]; n++) {
      steps.push({ title: source[`step${n}Title`], text: firstSentence(source[`step${n}Text`] ?? '') })
    }
    return {
      toolName,
      title,
      iconName,
      plan,
      passPrice: setting?.pass_enabled && plan !== 'free' ? eur((setting.pass_price_cents ?? 0) / 100) : null,
      purpose: flyer?.tagline || description,
      points,
      steps,
      openHref,
      guideHref: slug ? `/guida/${slug}` : null,
    }
  }

  const tools = getMarketplaceTools(tm)
  const groups: CatalogGroup[] = SERVICE_GROUPS.map((group) => ({
    key: group,
    label: th(`group_${group}`),
    items: tools
      .filter((tool) => serviceGroupOf(tool.toolName) === group)
      .map((tool) => build(tool.toolName, tool.title, tool.description, tool.iconName, tool.href, `/strumenti/${tool.toolName}`))
      .filter((item): item is CatalogItem => item !== null),
  }))
  groups.push({
    key: 'community',
    label: tc('groupCommunity'),
    items: COMMUNITY.map((c) => build(c.toolName, tm(c.titleKey), tm(`${c.titleKey}Description`), c.iconName, c.href, c.href)).filter(
      (item): item is CatalogItem => item !== null
    ),
  })

  const visible = groups.filter((group) => group.items.length > 0)
  return {
    groups: visible,
    total: visible.reduce((sum, group) => sum + group.items.length, 0),
    basePrice: eur(prices.base),
    proPrice: eur(prices.pro),
  }
}
