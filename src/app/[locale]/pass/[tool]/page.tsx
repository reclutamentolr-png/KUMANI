import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, CheckCircle2, Crown, Sparkles, Ticket } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import CheckoutForm from '@/components/billing/CheckoutForm'
import PassCodeForm from '@/components/pass/PassCodeForm'
import { createClient } from '@/lib/supabase/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { marketplaceIconMap } from '@/lib/marketplaceIcons'
import { getPlanPrices } from '@/lib/planPrices'
import { confirmToolPassSession, getMyToolPasses, getToolPassOffer } from '@/lib/toolPasses'

const ERRORS = ['unavailable', 'already', 'business', 'vat', 'consent', 'payment'] as const

// Pass di un singolo servizio: acquisto con carta (1 anno, pagamento unico),
// attivazione con codice, oppure abbonamento Base/Pro per avere tutto.
export default async function ToolPassPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; tool: string }>
  searchParams: Promise<{ success?: string; canceled?: string; session_id?: string; error?: string }>
}) {
  const { locale, tool } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/pass/${tool}`)}`)

  const marketplaceT = await getTranslations('marketplace')
  const info = getMarketplaceTools((key) => marketplaceT(key)).find((item) => item.toolName === tool)
  if (!info) notFound()
  const t = await getTranslations('toolPass')
  const tw = await getTranslations('withdrawal')

  // Ritorno dal pagamento: il pass si conferma anche senza webhook
  const confirmed = sp.success && sp.session_id ? await confirmToolPassSession(sp.session_id, user.id) : null

  const [offer, passes, accessResult, prices] = await Promise.all([
    getToolPassOffer(supabase, tool),
    getMyToolPasses(supabase),
    supabase.rpc('can_use_tool', { p_tool: tool }).maybeSingle<{ allowed: boolean; required_plan: string }>(),
    getPlanPrices(),
  ])
  const passExpiry = confirmed ?? passes.get(tool) ?? null
  const includedInPlan = accessResult.data?.allowed === true && !passExpiry
  const requiredPlan = accessResult.data?.required_plan ?? offer.requiredPlan

  const fmtPrice = (eur: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(eur)
  const price = fmtPrice(offer.priceCents / 100)
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const Icon = marketplaceIconMap[info.iconName] || Ticket
  const error = ERRORS.find((key) => key === sp.error)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {t('backToDashboard')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--ink)] text-[var(--gold-bright)] shadow-md">
            <Icon className="h-7 w-7" strokeWidth={1.6} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">{t('pageTitle', { service: info.title })}</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{info.description}</p>
          </div>
        </div>

        {/* Esito e stato */}
        {sp.success && !passExpiry && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{t('paymentPending')}</p>
        )}
        {sp.canceled && <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[var(--muted)]">{t('canceled')}</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t(`error_${error}`)}</p>}

        {(passExpiry || includedInPlan) && (
          <div className="flex flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm font-semibold text-emerald-900">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              {includedInPlan
                ? t('includedInPlan', { service: info.title })
                : sp.success
                  ? t('paymentDone', { service: info.title, date: date(passExpiry!) })
                  : t('activeUntil', { service: info.title, date: date(passExpiry!) })}
            </p>
            <Link href={info.href} className="shrink-0 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-center text-sm font-bold text-[var(--gold-bright)]">
              {t('openService')}
            </Link>
          </div>
        )}

        {/* Acquisto del pass */}
        {!includedInPlan &&
          (offer.enabled ? (
            <section className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/45 bg-[var(--paper)] p-6 shadow-sm">
              <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)]" />
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[var(--gold)]">
                <Ticket className="h-4 w-4" /> {t('passLabel')}
              </p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-4xl font-extrabold text-[var(--ink)]">{price}</span>
                <span className="pb-1 text-sm text-[var(--muted)]">{t('priceLabel')}</span>
              </div>
              <ul className="mt-4 space-y-1.5 text-sm text-[var(--ink)]">
                {[t('point1', { service: info.title }), t('point2'), t('point3')].map((line) => (
                  <li key={line} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {line}
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                <CheckoutForm
                  action={`/api/checkout/pass?tool=${encodeURIComponent(tool)}`}
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
                    <Sparkles className="h-5 w-5" />
                    {passExpiry ? t('renewButton', { price }) : t('buyButton', { service: info.title, price })}
                  </button>
                </CheckoutForm>
              </div>
            </section>
          ) : (
            !passExpiry && <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[var(--muted)]">{t('notForSale')}</p>
          ))}

        {/* Codice pass */}
        {!includedInPlan && (
          <section className="rounded-2xl border border-[var(--gold)]/30 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--ink)]">{t('codeTitle')}</h2>
            <p className="mb-3 mt-1 text-sm text-[var(--muted)]">{t('codeHint')}</p>
            <PassCodeForm tool={tool} />
          </section>
        )}

        {/* Abbonamenti: prezzo pieno, il pass non lo cambia */}
        {!includedInPlan && (
          <section className="rounded-2xl bg-[var(--ink)] p-6 text-white shadow-md">
            <h2 className="flex items-center gap-2 text-lg font-bold text-[var(--gold-bright)]">
              <Crown className="h-5 w-5" /> {t('plansTitle')}
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-300">{t('plansText', { base: fmtPrice(prices.base), pro: fmtPrice(prices.pro) })}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              {requiredPlan !== 'pro' && (
                <Link href="/billing" className="flex-1 rounded-xl border border-[var(--gold)]/50 px-4 py-2.5 text-center text-sm font-bold text-[var(--gold-bright)] hover:bg-white/5">
                  {t('planBaseCta', { price: fmtPrice(prices.base) })}
                </Link>
              )}
              <Link
                href={`/pro?tool=${encodeURIComponent(tool)}`}
                className="flex-1 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-center text-sm font-bold text-[var(--ink)]"
              >
                {t('planProCta', { price: fmtPrice(prices.pro) })}
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
