import { getTranslations } from 'next-intl/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { ArrowLeft, ArrowRight, CheckCircle2, Crown } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import UpgradeToProButton from '@/components/UpgradeToProButton'
import CheckoutForm from '@/components/billing/CheckoutForm'
import StartProTrialButton from '@/components/StartProTrialButton'
import { createClient } from '@/lib/supabase/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import type { UserPlan } from '@/lib/plans'
import { getPlanPrices } from '@/lib/planPrices'

// Pagina "KUMANI Pro": strumenti del piano Pro (decisi dall'admin in
// Admin → Marketplace), prezzo e pulsante adatto alla situazione:
// non iscritto → registrazione; Base con carta → passaggio a Pro (Stripe
// calcola la differenza); altrimenti → checkout Pro.
export default async function ProPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ tool?: string; error?: string }>
}) {
  const { locale } = await params
  const { tool: highlightTool, error } = await searchParams
  const t = await getTranslations('plans')
  const tm = await getTranslations('marketplace')
  const tw = await getTranslations('withdrawal')

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const [{ data: settings }, planPrices, { data: trialDaysRow }] = await Promise.all([
    service.from('marketplace_settings').select('tool_name, is_enabled, required_plan'),
    // Prezzo vero, letto da Stripe
    getPlanPrices(),
    service.from('system_settings').select('value').eq('key', 'pro_trial_days').maybeSingle(),
  ])
  const proToolNames = new Set(
    (settings ?? []).filter((s: { is_enabled: boolean; required_plan?: string }) => s.is_enabled && s.required_plan === 'pro').map((s: { tool_name: string }) => s.tool_name)
  )
  const proTools = getMarketplaceTools(tm).filter((tool) => proToolNames.has(tool.toolName))
  const price = planPrices.pro
  const highlighted = proTools.find((tool) => tool.toolName === highlightTool)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let plan: UserPlan = 'none'
  let hasStripeSubscription = false
  let paidPro = false
  let trialEndsAt: string | null = null
  let trialUsed = false
  if (user) {
    const [{ data: myPlan }, { data: profile }] = await Promise.all([
      supabase.rpc('my_plan'),
      supabase
        .from('profiles')
        .select('subscription_status, subscription_source, subscription_plan, pro_trial_ends_at')
        .eq('id', user.id)
        .maybeSingle(),
    ])
    plan = (typeof myPlan === 'string' ? myPlan : 'none') as UserPlan
    hasStripeSubscription = profile?.subscription_status === 'active' && profile?.subscription_source === 'stripe'
    paidPro = profile?.subscription_status === 'active' && profile?.subscription_plan === 'pro'
    trialUsed = !!profile?.pro_trial_ends_at
    // In prova: Pro attivo ma non pagato → si mostra la scadenza e il pulsante per attivarlo.
    if (plan === 'pro' && !paidPro && profile?.pro_trial_ends_at) {
      trialEndsAt = new Date(profile.pro_trial_ends_at).toLocaleDateString(locale)
    }
  }
  const trialDays = Number(String(trialDaysRow?.value ?? '15').replace(/"/g, '')) || 15
  const proAvailable = !!process.env.STRIPE_PRICE_ID_PRO

  return (
    <div className="min-h-screen bg-[var(--ink)] px-4 py-8 text-white">
      <div className="mx-auto max-w-2xl">
        <Link href={user ? '/dashboard' : '/'} className="mb-6 inline-flex items-center gap-2 text-sm text-white/70 hover:text-[var(--gold-bright)]">
          <ArrowLeft className="h-4 w-4" /> {user ? t('backToDashboard') : t('backToHome')}
        </Link>

        <div className="text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <Logo size={48} className="h-12 w-12" />
            <span className="rounded-full bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-3 py-1 text-sm font-extrabold tracking-[0.2em] text-[var(--ink)]">
              PRO
            </span>
          </div>
          <h1 className="text-3xl font-bold sm:text-4xl">{t('proTitle')}</h1>
          <p className="mx-auto mt-3 max-w-xl text-gray-300">{t('proSubtitle')}</p>
          {highlighted && (
            <p className="mx-auto mt-5 max-w-xl rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 px-4 py-3 text-sm text-[var(--gold-bright)]">
              {t('toolIsPro', { tool: highlighted.title })}
            </p>
          )}
        </div>

        <div className="mt-8 rounded-3xl border border-[var(--gold)]/30 bg-white/[0.04] p-6 sm:p-8">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.15em] text-[var(--gold-bright)]">{t('proIncludes')}</p>
          <ul className="space-y-4">
            {proTools.map((tool) => {
              const Icon = marketplaceIconMap[tool.iconName]
              return (
                <li key={tool.toolName} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)]">
                    {Icon && <Icon className="h-5 w-5 text-[var(--ink)]" />}
                  </span>
                  <span>
                    <span className="block font-semibold">{tool.title}</span>
                    <span className="block text-sm text-gray-400">{tool.description}</span>
                  </span>
                </li>
              )
            })}
            <li className="flex items-center gap-3 border-t border-white/10 pt-4 text-sm text-gray-200">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-[var(--gold-bright)]" /> {t('proIncludesBase')}
            </li>
          </ul>

          <div className="mt-8 text-center">
            <p className="text-4xl font-bold">
              {price} € <span className="text-base font-medium text-gray-400">{t('perYear')}</span>
            </p>
            {error === 'unavailable' && <p className="mt-3 text-sm text-amber-300">{t('proUnavailable')}</p>}
            {(error === 'consent' || error === 'business' || error === 'vat') && (
              <p className="mt-3 text-sm text-amber-300">
                {error === 'consent' ? tw('consentRequired') : error === 'vat' ? tw('vatInvalid') : tw('businessRequired')}
              </p>
            )}

            <div className="mt-6">
              {!user ? (
                <>
                  <Link
                    href="/register?plan=pro"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
                  >
                    <Crown className="h-5 w-5" /> {t('ctaRegister')}
                  </Link>
                  <p className="mt-2 text-sm text-[var(--gold-bright)]">{t('trialNote', { days: trialDays })}</p>
                </>
              ) : plan === 'pro' && !trialEndsAt ? (
                <div className="space-y-3">
                  <p className="rounded-xl bg-green-500/10 px-4 py-3 font-semibold text-green-300">{t('alreadyPro')}</p>
                  <Link
                    href="/dashboard"
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
                  >
                    {t('goToProArea')} <ArrowRight className="h-5 w-5" />
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {trialEndsAt && (
                    <p className="rounded-xl bg-[var(--gold)]/10 px-4 py-3 text-sm font-semibold text-[var(--gold-bright)]">
                      {t('trialActiveUntil', { date: trialEndsAt })}
                    </p>
                  )}
                  {!proAvailable ? (
                    <p className="rounded-xl bg-white/5 px-4 py-3 text-sm text-gray-300">{t('proUnavailable')}</p>
                  ) : hasStripeSubscription ? (
                    <UpgradeToProButton label={t('ctaUpgrade')} note={t('upgradeNote')} />
                  ) : (
                    <CheckoutForm
                      action="/api/checkout?plan=pro"
                      dark
                      texts={{
                        asConsumer: tw('asConsumer'),
                        asBusiness: tw('asBusiness'),
                        consentLabel: tw('consentLabel'),
                        consentHint: tw('consentHint'),
                        businessName: tw('businessName'),
                        vatNumber: tw('vatNumber'),
                        vatHint: tw('vatHint'),
                        businessDeclaration: tw('businessDeclaration'),
                      }}
                    >
                      <button
                        type="submit"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]"
                      >
                        <Crown className="h-5 w-5" /> {t('ctaSubscribePro', { price })}
                      </button>
                    </CheckoutForm>
                  )}
                  {!trialUsed && plan !== 'pro' && <StartProTrialButton label={t('ctaStartTrial', { days: trialDays })} />}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
