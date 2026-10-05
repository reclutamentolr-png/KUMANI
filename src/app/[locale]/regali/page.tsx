import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, CheckCircle2, Gift, Send, UserPlus } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import GiftBuyForm, { type GiftOption } from '@/components/gifts/GiftBuyForm'
import GiftOrdersList from '@/components/gifts/GiftOrdersList'
import { getCheckoutTexts } from '@/lib/checkoutTexts'
import { createClient } from '@/lib/supabase/server'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getPlanPrices } from '@/lib/planPrices'
import { SITE_URL } from '@/lib/siteUrl'
import { getMyGiftOrders } from '@/app/actions/gifts'
import { confirmGiftSession, giftItemName } from '@/lib/giftsServer'
import { defaultLocale } from '../../../../i18n'

const ERRORS = ['quantity', 'item', 'unavailable', 'business', 'vat', 'terms', 'payment'] as const

// Regala KUMANI: codici per un anno di Base/Pro o per il Pass di un servizio,
// da mandare a chi si vuole; sotto, i regali già comprati con lo stato.
export default async function GiftsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ success?: string; canceled?: string; session_id?: string; error?: string; tool?: string; plan?: string }>
}) {
  const { locale } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent('/regali')}`)

  const t = await getTranslations('gifts')
  const tm = await getTranslations('marketplace')

  // Ritorno dal pagamento: i codici si creano anche senza webhook
  const confirmed = sp.success && sp.session_id ? await confirmGiftSession(sp.session_id, user.id) : null

  const [prices, { data: passRows }, orders, checkoutTexts] = await Promise.all([
    getPlanPrices(),
    supabase.from('marketplace_settings').select('tool_name, pass_price_cents').eq('pass_enabled', true).neq('is_enabled', false).neq('required_plan', 'free'),
    getMyGiftOrders(),
    getCheckoutTexts(locale),
  ])
  const tools = getMarketplaceTools((key) => tm(key))
  const options: GiftOption[] = [
    { value: 'plan:base', label: t('itemBase'), priceCents: Math.round(prices.base * 100), group: 'plan' },
    { value: 'plan:pro', label: t('itemPro'), priceCents: Math.round(prices.pro * 100), group: 'plan' },
    ...(passRows ?? [])
      .map((row) => ({ row, info: tools.find((tool) => tool.toolName === row.tool_name) }))
      .filter((entry) => entry.info)
      .map(({ row, info }) => ({ value: `pass:${row.tool_name}`, label: t('itemPass', { service: info!.title }), priceCents: row.pass_price_cents ?? 1000, group: 'pass' as const }))
      .sort((a, b) => a.label.localeCompare(b.label, locale)),
  ]
  const initial = sp.tool ? `pass:${sp.tool}` : sp.plan === 'pro' ? 'plan:pro' : 'plan:base'
  const names: Record<string, string> = {}
  for (const order of orders) names[order.id] = await giftItemName(locale, order.kind, order.tool, order.plan)
  const baseUrl = `${SITE_URL}${locale === defaultLocale ? '' : `/${locale}`}`
  const error = ERRORS.find((key) => key === sp.error)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/wallet" className="flex items-center gap-2 text-sm font-semibold text-[var(--gold-bright)] hover:text-white">
            <ArrowLeft className="h-4 w-4" /> {t('back')}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--ink)] text-[var(--gold-bright)] shadow-md">
            <Gift className="h-7 w-7" strokeWidth={1.6} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold text-[var(--ink)] sm:text-3xl">{t('pageTitle')}</h1>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('pageIntro')}</p>
          </div>
        </div>

        {sp.success && (
          <p className={`flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${confirmed || orders.length ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {confirmed ? t('paymentDone') : t('paymentPending')}
          </p>
        )}
        {sp.canceled && <p className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-[var(--muted)]">{t('canceled')}</p>}
        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{t(`error_${error}`)}</p>}

        {/* Come funziona */}
        <ol className="grid gap-3 sm:grid-cols-3">
          {[
            { Icon: Gift, text: t('step1') },
            { Icon: Send, text: t('step2') },
            { Icon: UserPlus, text: t('step3') },
          ].map(({ Icon, text }, index) => (
            <li key={text} className="flex items-start gap-3 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 text-sm text-[var(--ink)] shadow-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-pale)] text-[var(--gold)]">
                <Icon className="h-4 w-4" />
              </span>
              <span>
                <span className="font-bold">{index + 1}. </span>
                {text}
              </span>
            </li>
          ))}
        </ol>

        <section className="relative overflow-hidden rounded-2xl border border-[var(--gold)]/45 bg-[var(--paper)] p-6 shadow-sm">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-[var(--gold)] via-[var(--gold-bright)] to-[var(--gold)]" />
          <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t('buyTitle')}</h2>
          <GiftBuyForm
            options={options}
            initial={initial}
            texts={{
              asConsumer: checkoutTexts.asConsumer,
              asBusiness: checkoutTexts.asBusiness,
              businessName: checkoutTexts.businessName,
              vatNumber: checkoutTexts.vatNumber,
              vatHint: checkoutTexts.vatHint,
              businessDeclaration: checkoutTexts.businessDeclaration,
              termsLabel: checkoutTexts.termsLabel,
            }}
          />
        </section>

        <section id="i-miei-regali">
          <h2 className="mb-3 text-lg font-bold text-[var(--ink)]">{t('ordersTitle')}</h2>
          <GiftOrdersList orders={orders} names={names} baseUrl={baseUrl} />
        </section>
      </main>
    </div>
  )
}
