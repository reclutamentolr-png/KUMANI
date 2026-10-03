import { getLocale } from 'next-intl/server'
import { getPlanPrices } from '@/lib/planPrices'
import { CANONICAL_ORIGIN, localizedUrl } from '@/lib/seo'
import JsonLd from '@/components/seo/JsonLd'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'

type Inviter = { first_name: string; last_name: string; referral_code: string }

// Pagina pubblica di uno strumento, quella che i Kumani condividono dal
// pulsante "Condividi" dentro ogni strumento (?ref=CODICE). Chi arriva qui
// si iscrive con il codice invito di chi ha condiviso già inserito.
export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const { tool: toolName } = await params
  const tm = await getTranslations('marketplace')
  const tool = getMarketplaceTools(tm).find((item) => item.toolName === toolName)
  if (!tool) return {}
  // Indirizzo canonico senza ?ref: tutte le condivisioni contano come una pagina
  return pageMetadata(`/strumenti/${tool.toolName}`, { title: tool.title, description: tool.description }, { ownImage: true })
}

export default async function ToolSharePage({
  params,
  searchParams,
}: {
  params: Promise<{ tool: string }>
  searchParams: Promise<{ ref?: string }>
}) {
  const { tool: toolName } = await params
  const { ref } = await searchParams
  const tm = await getTranslations('marketplace')
  const t = await getTranslations('toolShare')

  const tool = getMarketplaceTools(tm).find((item) => item.toolName === toolName)
  if (!tool) notFound()

  // Piano richiesto dallo strumento (deciso dall'admin): Gratis / Base / Pro.
  const { data: setting } = await createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
    .from('marketplace_settings')
    .select('required_plan')
    .eq('tool_name', tool.toolName)
    .maybeSingle()
  const requiredPlan = (setting?.required_plan as string | undefined) ?? (tool.requiresSubscription ? 'base' : 'free')
  const Icon = marketplaceIconMap[tool.iconName]

  // Chi ha condiviso: solo nome e codice, tramite la funzione pubblica.
  let inviter: Inviter | null = null
  const code = typeof ref === 'string' ? ref.trim().toUpperCase() : ''
  if (/^[A-Z0-9-]{3,32}$/.test(code)) {
    const supabase = await createClient()
    const { data } = await supabase.rpc('get_public_profile_by_referral', { p_referral_code: code })
    inviter = ((data as Inviter[] | null) ?? [])[0] ?? null
  }
  const registerHref = inviter ? `/register?sponsor=${encodeURIComponent(inviter.referral_code)}` : '/register'

  const prices = await getPlanPrices()
  const APP_CATEGORY: Record<string, string> = { security: 'SecurityApplication', svago: 'GameApplication', personal: 'LifestyleApplication', wellness: 'HealthApplication' }
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.title,
    description: tool.description,
    url: localizedUrl(await getLocale(), `/strumenti/${tool.toolName}`),
    applicationCategory: APP_CATEGORY[tool.category] ?? 'BusinessApplication',
    operatingSystem: 'Web, Android, iOS',
    publisher: { '@type': 'Organization', name: 'KUMANI', url: CANONICAL_ORIGIN },
    offers: {
      '@type': 'Offer',
      price: requiredPlan === 'free' ? 0 : requiredPlan === 'pro' ? prices.pro : prices.base,
      priceCurrency: 'EUR',
      ...(requiredPlan === 'free' ? {} : { description: requiredPlan === 'pro' ? 'KUMANI Pro' : 'KUMANI Base' }),
    },
  }

  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-10 text-white">
      <JsonLd data={ld} />
      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <Logo size={44} className="h-11 w-11" />
          <span className="text-lg font-bold tracking-[0.3em] text-[var(--gold-bright)]">KUMANI</span>
        </Link>

        <div className="rounded-3xl border border-[var(--gold)]/25 bg-white/[0.04] p-6 text-center sm:p-8">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--gold-bright)]">
            <Sparkles className="h-3.5 w-3.5" /> {t('eyebrow')}
          </p>
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)]">
            {Icon && <Icon className="h-8 w-8 text-[var(--ink)]" />}
          </div>
          <h1 className="text-3xl font-bold">{tool.title}</h1>
          <p className="mt-3 leading-relaxed text-gray-300">{tool.description}</p>
          <p className="mt-4 text-sm text-gray-400">{requiredPlan === 'pro' ? t('includedPro') : requiredPlan === 'base' ? t('includedPaid') : t('includedFree')}</p>

          {inviter && (
            <p className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-sm text-gray-200">
              {t('invitedBy', { name: inviter.first_name.trim() })}
            </p>
          )}

          <Link
            href={registerHref}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
          >
            {t('ctaRegister')} <ArrowRight className="h-5 w-5" />
          </Link>
          <Link href="/" className="mt-4 inline-block text-sm font-semibold text-[var(--gold-bright)] hover:text-white">
            {t('ctaDiscover')}
          </Link>
        </div>
      </div>
    </div>
  )
}
