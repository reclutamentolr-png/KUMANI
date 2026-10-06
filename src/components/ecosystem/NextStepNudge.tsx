import { getLocale, getTranslations } from 'next-intl/server'
import { ArrowRight, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { getToolPassOffer } from '@/lib/toolPasses'
import { getPlanPrices } from '@/lib/planPrices'

// Passaggio tra abbonamenti al momento giusto: dentro un servizio, il
// servizio successivo che serve davvero (es. da Verifica IBAN a CheckMail,
// dal Link in bio alla Landing page). Si vede solo a chi ha fatto l'accesso
// e non ha ancora quel servizio; porta alla sua pagina, dove si sceglie tra
// Pass del solo servizio e abbonamento.
export default async function NextStepNudge({ tool, name, reason, className = '' }: { tool: string; name: string; reason: string; className?: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const [{ data: access }, offer, prices, t, locale] = await Promise.all([
    supabase.rpc('can_use_tool', { p_tool: tool }).maybeSingle<{ allowed: boolean; required_plan: string }>(),
    getToolPassOffer(supabase, tool),
    getPlanPrices(),
    getTranslations('ecosystem'),
    getLocale(),
  ])
  if (!access || access.allowed || !offer.known) return null

  const planPrice = offer.requiredPlan === 'pro' ? prices.pro : prices.base
  const from = offer.enabled ? Math.min(offer.priceCents / 100, planPrice) : planPrice
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(from)

  return (
    <Link
      href={`/strumenti/${tool}`}
      className={`group flex items-center gap-4 rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-br from-[var(--gold-pale)] to-white p-4 shadow-sm transition hover:border-[var(--gold)] ${className}`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
        <Sparkles className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-[var(--ink)]">{t(reason)}</span>
        <span className="mt-1 block text-xs font-semibold text-[var(--gold)]">{t('nudgePriceFrom', { price: money })}</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-[var(--ink)]">
        <span className="hidden sm:inline">{t('nudgeCta', { name })}</span>
        <ArrowRight className="h-5 w-5 text-[var(--gold)] transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
