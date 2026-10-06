import { cache } from 'react'
import { getToolSeo } from '@/lib/toolSeo'
import { getGuidesContent } from '@/lib/guides/content'
import { getPlanPrices } from '@/lib/planPrices'
import { CANONICAL_ORIGIN, localizedUrl } from '@/lib/seo'
import JsonLd from '@/components/seo/JsonLd'
import type { Metadata } from 'next'
import { pageMetadata } from '@/lib/seo'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { CheckCircle2, ChevronDown, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ToolReviews from '@/components/reviews/ToolReviews'
import Logo from '@/components/Logo'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import ToolShareActions from '@/components/strumenti/ToolShareActions'

// Impostazioni del servizio decise dall'Admin (piano e acceso/spento): una
// sola lettura per richiesta (servono sia ai metadati sia alla pagina)
const toolSetting = cache(async (toolName: string) => {
  const { data } = await createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
    .from('marketplace_settings')
    .select('required_plan, is_enabled')
    .eq('tool_name', toolName)
    .maybeSingle()
  return data as { required_plan: string | null; is_enabled: boolean | null } | null
})

// Pagina pubblica di uno strumento, quella che i Kumani condividono dal
// pulsante "Condividi" dentro ogni strumento (?ref=CODICE). Chi arriva qui
// si iscrive con il codice invito di chi ha condiviso già inserito.
// Pagina uguale per tutti: preparata in anticipo per ogni lingua e servizio e
// rifatta in background al massimo ogni 5 minuti (piano e acceso/spento
// decisi dall'Admin compaiono entro 5 minuti, come nella Home). Le parti
// personali (chi ha condiviso con ?ref, pulsanti per chi è già iscritto) le
// completa il browser: components/strumenti/ToolShareActions.
export const revalidate = 300

export function generateStaticParams() {
  return getMarketplaceTools((key) => key).map(({ toolName }) => ({ tool: toolName }))
}

type Props = { params: Promise<{ locale: string; tool: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, tool: toolName } = await params
  setRequestLocale(locale)
  const tm = await getTranslations('marketplace')
  const tool = getMarketplaceTools(tm).find((item) => item.toolName === toolName)
  if (!tool) return {}
  // Titolo e descrizione pensati per le ricerche, se ci sono in questa lingua
  const [seo, setting] = await Promise.all([getToolSeo(locale, tool.toolName), toolSetting(tool.toolName)])
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

export default async function ToolSharePage({ params }: Props) {
  const { locale, tool: toolName } = await params
  setRequestLocale(locale)
  const tm = await getTranslations('marketplace')
  const t = await getTranslations('toolShare')

  const tool = getMarketplaceTools(tm).find((item) => item.toolName === toolName)
  if (!tool) notFound()

  // Piano richiesto dallo strumento (deciso dall'admin): Gratis / Base / Pro.
  const setting = await toolSetting(tool.toolName)
  const off = setting?.is_enabled === false
  const requiredPlan = ((setting?.required_plan as string | undefined) ?? (tool.requiresSubscription ? 'base' : 'free')) as 'free' | 'base' | 'pro'
  const Icon = marketplaceIconMap[tool.iconName]

  const [prices, seo, guides, ts] = await Promise.all([
    getPlanPrices(),
    getToolSeo(locale, tool.toolName),
    getGuidesContent(locale),
    getTranslations('toolSeo.common'),
  ])
  // Pulsanti: chi ha condiviso (?ref) e chi è già iscritto li vede dal
  // browser (Apri, Pass del solo servizio o abbonamento); qui la versione
  // per chi arriva da Google, uguale per tutti
  const actions = { toolName: tool.toolName, toolTitle: tool.title, toolHref: tool.href, requiredPlan, off, prices: { base: prices.base, pro: prices.pro } }
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

          <ToolShareActions variant="hero" {...actions} />
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

            <ToolShareActions variant="footer" {...actions} ctaTitle={ts('ctaTitle')} ctaText={ts('ctaText')} />
          </div>
        )}

        {/* Recensioni verificate di chi ha acquistato il servizio */}
        {!off && <ToolReviews subject={tool.toolName} />}
      </div>
    </div>
  )
}
