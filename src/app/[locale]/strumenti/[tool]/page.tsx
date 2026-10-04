import { getLocale } from 'next-intl/server'
import { getToolSeo } from '@/lib/toolSeo'
import { getGuidesContent } from '@/lib/guides/content'
import { getPlanPrices } from '@/lib/planPrices'
import { CANONICAL_ORIGIN, localizedUrl } from '@/lib/seo'
import JsonLd from '@/components/seo/JsonLd'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowRight, CheckCircle2, ChevronDown, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'

type Inviter = { first_name: string; last_name: string; referral_code: string }

// Impostazioni del servizio decise dall'Admin (piano e acceso/spento)
async function toolSetting(toolName: string) {
  const { data } = await createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
    .from('marketplace_settings')
    .select('required_plan, is_enabled')
    .eq('tool_name', toolName)
    .maybeSingle()
  return data as { required_plan: string | null; is_enabled: boolean | null } | null
}

// Pagina pubblica di uno strumento, quella che i Kumani condividono dal
// pulsante "Condividi" dentro ogni strumento (?ref=CODICE). Chi arriva qui
// si iscrive con il codice invito di chi ha condiviso già inserito.
export async function generateMetadata({ params }: { params: Promise<{ tool: string }> }): Promise<Metadata> {
  const { tool: toolName } = await params
  const tm = await getTranslations('marketplace')
  const tool = getMarketplaceTools(tm).find((item) => item.toolName === toolName)
  if (!tool) return {}
  // Titolo e descrizione pensati per le ricerche, se ci sono in questa lingua
  const [seo, setting] = await Promise.all([getToolSeo(await getLocale(), tool.toolName), toolSetting(tool.toolName)])
  // Servizio spento dall'Admin: la pagina resta ma Google non la mostra
  // finché non viene riacceso (poi torna nella sitemap e viene riletta)
  const off = setting?.is_enabled === false
  // Indirizzo canonico senza ?ref: tutte le condivisioni contano come una pagina
  return pageMetadata(
    `/strumenti/${tool.toolName}`,
    {
      title: seo ? { absolute: seo.title } : tool.title,
      description: seo?.description ?? tool.description,
      ...(off ? { robots: { index: false, follow: true } } : {}),
    },
    { ownImage: true }
  )
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
  const setting = await toolSetting(tool.toolName)
  const off = setting?.is_enabled === false
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

  const locale = await getLocale()
  const [prices, seo, guides, ts] = await Promise.all([
    getPlanPrices(),
    getToolSeo(locale, tool.toolName),
    getGuidesContent(locale),
    getTranslations('toolSeo.common'),
  ])
  const steps = guides.guides.find((g) => g.slug === tool.toolName)?.steps ?? []
  const APP_CATEGORY: Record<string, string> = { security: 'SecurityApplication', svago: 'GameApplication', personal: 'LifestyleApplication', wellness: 'HealthApplication' }
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: tool.title,
    description: tool.description,
    url: localizedUrl(locale, `/strumenti/${tool.toolName}`),
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
      <JsonLd
        data={
          seo
            ? [ld, { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: seo.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }]
            : ld
        }
      />
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
          {off ? (
            <p className="mt-4 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-200" role="status">
              {t('unavailable')}
            </p>
          ) : (
            <p className="mt-4 text-sm text-gray-400">{requiredPlan === 'pro' ? t('includedPro') : requiredPlan === 'base' ? t('includedPaid') : t('includedFree')}</p>
          )}

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

        {/* Approfondimento per chi arriva da Google: a cosa serve, come si usa, domande */}
        {seo && (
          <div className="mt-10 space-y-8">
            <section>
              <h2 className="text-2xl font-bold">{seo.heading}</h2>
              <p className="mt-3 leading-relaxed text-gray-300">{seo.intro}</p>
            </section>

            <section>
              <h2 className="text-lg font-bold text-[var(--gold-bright)]">{ts('pointsTitle')}</h2>
              <ul className="mt-3 space-y-2.5">
                {seo.points.map((point) => (
                  <li key={point} className="flex gap-2.5 leading-relaxed text-gray-200">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold-bright)]" />
                    {point}
                  </li>
                ))}
              </ul>
            </section>

            {steps.length > 0 && (
              <section>
                <h2 className="text-lg font-bold text-[var(--gold-bright)]">{ts('stepsTitle')}</h2>
                <ol className="mt-3 space-y-4">
                  {steps.map((step, i) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--gold)]/20 text-sm font-bold text-[var(--gold-bright)]">{i + 1}</span>
                      <div>
                        <h3 className="font-semibold">{step.title}</h3>
                        <p className="mt-1 leading-relaxed text-gray-300">{step.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            <section>
              <h2 className="text-lg font-bold text-[var(--gold-bright)]">{ts('faqTitle')}</h2>
              <div className="mt-3 space-y-2">
                {seo.faq.map((f) => (
                  <details key={f.q} className="group rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold">
                      <h3>{f.q}</h3>
                      <ChevronDown className="h-5 w-5 shrink-0 text-gray-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-2 leading-relaxed text-gray-300">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-[var(--gold)]/25 bg-white/[0.04] p-6 text-center">
              <h2 className="text-xl font-bold">{ts('ctaTitle')}</h2>
              <p className="mt-2 leading-relaxed text-gray-300">{ts('ctaText')}</p>
              <Link
                href={registerHref}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] shadow-lg transition-all hover:brightness-110"
              >
                {t('ctaRegister')} <ArrowRight className="h-5 w-5" />
              </Link>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
