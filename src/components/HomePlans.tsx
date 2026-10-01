import { unstable_cache } from 'next/cache'
import { getLocale, getTranslations } from 'next-intl/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ArrowRight, Briefcase, Check, Ticket } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getPlanPrices } from '@/lib/planPrices'
import PlanDetails, { type PlanDetailsTool } from '@/components/PlanDetails'
import type { MarketplaceCategory } from '@/lib/marketplaceTools'

type ToolRow = { tool_name: string; is_enabled: boolean; required_plan: string | null; pass_enabled?: boolean | null; pass_price_cents?: number | null }

// Impostazioni pubbliche dei servizi (piano richiesto e pass), lette con la
// chiave di servizio e tenute in memoria 5 minuti.
const fetchToolRows = unstable_cache(
  async (): Promise<ToolRow[]> => {
    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const withPass = await service.from('marketplace_settings').select('tool_name, is_enabled, required_plan, pass_enabled, pass_price_cents')
    if (!withPass.error) return (withPass.data ?? []) as ToolRow[]
    const { data } = await service.from('marketplace_settings').select('tool_name, is_enabled, required_plan')
    return (data ?? []) as ToolRow[]
  },
  ['home-plans-tools'],
  { revalidate: 300 }
)

const PREVIEW = 6

// Homepage: scegli come usare KUMANI. Tre livelli (Gratis, Base, Pro), ognuno
// include il precedente, con i servizi reali di ogni piano, più la fascia
// del Pass per chi vuole un solo servizio.
export default async function HomePlans() {
  const [t, marketplaceT, locale, prices, rows] = await Promise.all([
    getTranslations('landingHome'),
    getTranslations('marketplace'),
    getLocale(),
    getPlanPrices(),
    fetchToolRows().catch(() => [] as ToolRow[]),
  ])
  const byName = new Map(rows.map((row) => [row.tool_name, row]))
  const tools = getMarketplaceTools((key) => marketplaceT(key)).filter((tool) => byName.get(tool.toolName)?.is_enabled !== false)
  const planOf = (name: string) => byName.get(name)?.required_plan ?? 'base'
  const eur = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value)
  const categoryLabel: Record<Exclude<MarketplaceCategory, 'community'>, string> = {
    marketing: marketplaceT('categoryMarketing'),
    security: marketplaceT('categorySecurity'),
    personal: marketplaceT('categoryPersonal'),
    wellness: marketplaceT('categoryWellness'),
    lavoro: marketplaceT('categoryLavoro'),
    svago: marketplaceT('categorySvago'),
  }
  // Servizi di un piano, con descrizione e argomento (per "Dettagli")
  const detailsOf = (plan: string): PlanDetailsTool[] =>
    tools
      .filter((tool) => planOf(tool.toolName) === plan)
      .map((tool) => {
        const row = byName.get(tool.toolName)
        return {
          toolName: tool.toolName,
          title: tool.title,
          description: tool.description,
          iconName: tool.iconName,
          categoryLabel: categoryLabel[tool.category],
          ...(row?.pass_enabled && plan !== 'free' ? { passPrice: eur((row.pass_price_cents ?? 1000) / 100) } : {}),
        }
      })
  const freeTools = detailsOf('free')
  const baseTools = detailsOf('base')
  const proTools = detailsOf('pro')
  const free = freeTools.map((tool) => tool.title)
  const base = baseTools.map((tool) => tool.title)
  const pro = proTools.map((tool) => tool.title)
  const passPrices = tools
    .map((tool) => byName.get(tool.toolName))
    .filter((row): row is ToolRow => !!row?.pass_enabled && row.required_plan !== 'free')
    .map((row) => row.pass_price_cents ?? 1000)

  const list = (items: string[], dark = false) => (
    <ul className="mt-3 flex-1 space-y-2">
      {items.slice(0, PREVIEW).map((name) => (
        <li key={name} className={`flex items-start gap-2 text-sm ${dark ? 'text-gray-200' : 'text-gray-300'}`}>
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold-bright)]" /> {name}
        </li>
      ))}
      {items.length > PREVIEW && <li className="pl-6 text-sm font-semibold text-[var(--gold-bright)]">{t('planMore', { count: items.length - PREVIEW })}</li>}
    </ul>
  )

  return (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3 sm:gap-6">
        {/* Gratis */}
        <div className="flex flex-col rounded-3xl border border-[var(--gold)]/20 bg-white/[0.03] p-6 sm:p-7">
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-white/80">{t('planFreeName')}</h3>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold text-white">{eur(0)}</span>
            <span className="text-gray-400">{t('planForever')}</span>
          </p>
          <p className="mt-2 min-h-[40px] text-sm text-gray-400">{t('planFreeDescription')}</p>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-[var(--gold-bright)]">{t('planFreeIncluded', { count: free.length })}</p>
          {list(free)}
          <PlanDetails planName={t('planFreeName')} price={`${eur(0)} · ${t('planForever')}`} intro={t('planDetailsIntroFree')} tools={freeTools} />
          <Link
            href="/register"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 px-6 py-3 font-bold text-white transition-all hover:bg-white/10"
          >
            {t('planFreeCta')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Base */}
        <div className="relative flex flex-col rounded-3xl border-2 border-[var(--gold)]/70 bg-[var(--gold)]/[0.08] p-6 sm:p-7">
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink)] shadow">
            {t('planRecommended')}
          </span>
          <h3 className="text-sm font-extrabold uppercase tracking-widest text-white/80">{t('planBaseName')}</h3>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold text-white">{eur(prices.base)}</span>
            <span className="text-gray-400">{t('planPerYear')}</span>
          </p>
          <p className="mt-2 min-h-[40px] text-sm text-gray-300">{t('planBaseDescription')}</p>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-[var(--gold-bright)]">{t('planBaseIncluded', { count: base.length })}</p>
          {list(base)}
          <PlanDetails
            planName={t('planBaseName')}
            price={`${eur(prices.base)} ${t('planPerYear')}`}
            intro={t('planDetailsIntroBase', { free: free.length, count: base.length })}
            tools={baseTools}
          />
          <Link
            href="/register"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-xl transition-all hover:brightness-110"
          >
            {t('planBaseCta')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Pro */}
        <div className="relative flex flex-col rounded-3xl border-2 border-[var(--gold)] bg-gradient-to-br from-[var(--gold)]/15 via-white/[0.04] to-transparent p-6 shadow-[0_18px_50px_rgba(199,154,59,0.2)] sm:p-7">
          <span className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink)] shadow">
            {t('planProBadge')}
          </span>
          <h3 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-widest text-white/80">
            <Briefcase className="h-4 w-4 text-[var(--gold-bright)]" /> {t('planProName')}
          </h3>
          <p className="mt-3 flex items-baseline gap-1.5">
            <span className="text-4xl font-bold text-[var(--gold-bright)]">{eur(prices.pro)}</span>
            <span className="text-gray-400">{t('planPerYear')}</span>
          </p>
          <p className="mt-2 min-h-[40px] text-sm text-gray-300">{t('planProDescription')}</p>
          <p className="mt-4 text-xs font-extrabold uppercase tracking-wide text-[var(--gold-bright)]">{t('planProIncluded', { count: pro.length })}</p>
          {list(pro, true)}
          <PlanDetails
            planName={t('planProName')}
            price={`${eur(prices.pro)} ${t('planPerYear')}`}
            intro={t('planDetailsIntroPro', { base: free.length + base.length, count: pro.length })}
            tools={proTools}
            dark
          />
          <Link
            href="/register?plan=pro"
            className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] shadow-xl transition-all hover:brightness-110"
          >
            {t('planProCta')} <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-3 text-center text-xs text-gray-400">{t('planProTrialNote')}</p>
        </div>
      </div>

      {/* Un solo servizio: il Pass */}
      {passPrices.length > 0 && (
        <div className="mt-6 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-[var(--gold)]/70 bg-white/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
              <Ticket className="h-6 w-6" />
            </span>
            <div>
              <p className="text-lg font-bold text-white">{t('passStripTitle')}</p>
              <p className="mt-1 text-sm text-gray-300">{t('passStripText', { price: eur(Math.min(...passPrices) / 100) })}</p>
            </div>
          </div>
          <Link
            href="/register"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--gold)]/60 px-5 py-3 text-sm font-bold text-[var(--gold-bright)] hover:bg-white/10"
          >
            {t('passStripCta')} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </>
  )
}
