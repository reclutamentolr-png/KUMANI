import { createClient as createServiceClient } from '@supabase/supabase-js'
import { recordConsent } from '@/lib/withdrawal'
import { SITE_URL } from '@/lib/siteUrl'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { getStripe, managedPayments, MANAGED_PAYMENTS_ON } from '@/lib/stripe'
import { parseVatInput } from '@/lib/vat'
import { getToolPassOffer } from '@/lib/toolPasses'
import { getPlanPrices } from '@/lib/planPrices'
import { GIFT_MAX_QUANTITY, GIFT_MESSAGE_MAX, GIFT_TYPE } from '@/lib/gifts'
import { giftItemName } from '@/lib/giftsServer'
import { locales, defaultLocale } from '../../../../../i18n'

// Acquisto di regali (pagamento una tantum): 1–10 codici per il Pass di un
// servizio o per un anno di Base/Pro. Il servizio non parte con il pagamento
// ma quando chi riceve attiva il codice: al privato niente consenso
// all'avvio immediato (il recesso vale per i codici non attivati); per
// l'azienda P.IVA e dichiarazione B2B. Termini e Privacy per tutti.
export async function POST(request: Request) {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const back = (error: string) => NextResponse.redirect(new URL(`${prefix}/regali?error=${error}`, SITE_URL), 303)

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL(`${prefix}/login?next=${encodeURIComponent('/regali')}`, SITE_URL), 303)

    const form = await request.formData().catch(() => null)
    // Cosa si regala: "plan:base", "plan:pro" oppure "pass:<servizio>"
    const [kind, value] = String(form?.get('item') ?? '').split(':')
    const quantity = Math.floor(Number(form?.get('quantity')))
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > GIFT_MAX_QUANTITY) return back('quantity')
    const message = String(form?.get('message') ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, GIFT_MESSAGE_MAX)

    let unitCents: number
    let tool = ''
    let plan = ''
    if (kind === 'plan' && (value === 'base' || value === 'pro')) {
      const prices = await getPlanPrices()
      unitCents = Math.round((value === 'pro' ? prices.pro : prices.base) * 100)
      plan = value
    } else if (kind === 'pass' && value) {
      const offer = await getToolPassOffer(supabase, value)
      if (!offer.enabled) return back('unavailable')
      unitCents = offer.priceCents
      tool = value
    } else {
      return back('item')
    }
    if (!(unitCents > 0)) return back('unavailable')

    const isBusiness = form?.get('buyer_type') === 'business'
    let business: { name: string; vat: string } | null = null
    if (isBusiness) {
      const name = String(form?.get('business_name') ?? '').trim().slice(0, 200)
      const vat = parseVatInput(String(form?.get('vat_number') ?? ''))
      if (!name || form?.get('business_declaration') !== '1') return back('business')
      if (!vat?.ok) return back('vat')
      business = { name, vat: vat.normalized }
    }
    if (form?.get('accept_terms') !== '1') return back('terms')

    const item = await giftItemName(locale, kind, tool, plan)
    const now = new Date().toISOString()
    const meta: Record<string, string> = {
      type: GIFT_TYPE,
      // buyerId e non userId: il pagamento non deve mai essere letto come abbonamento
      buyerId: user.id,
      kind,
      tool,
      plan,
      quantity: String(quantity),
      message,
      locale,
      terms_accepted: now,
      ...(business
        ? { buyer_type: 'business', business_name: business.name, vat_number: business.vat, business_declaration: now }
        : { buyer_type: 'consumer' }),
    }

    const stripe = getStripe()
    let customerId: string | null = null
    if (business) {
      const customer = await stripe.customers
        .create({ email: user.email, name: business.name, tax_id_data: [{ type: 'eu_vat', value: business.vat }], metadata: { userId: user.id } })
        .catch(() => stripe.customers.create({ email: user.email, name: business.name, metadata: { userId: user.id, vat_number: business.vat } }))
      customerId = customer.id
    }

    // Stripe Managed Payments: acceso solo con STRIPE_MANAGED_PAYMENTS=on
    const managed = managedPayments()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ...(MANAGED_PAYMENTS_ON ? managed.params : { payment_method_types: ['card'] }),
      line_items: [{ quantity, price_data: { currency: 'eur', unit_amount: unitCents, product_data: { name: item, ...(managed.productTaxCode ? { tax_code: managed.productTaxCode } : {}) }, ...(MANAGED_PAYMENTS_ON ? { tax_behavior: 'inclusive' as const } : {}) } }],
      metadata: meta,
      payment_intent_data: { metadata: meta },
      // Ricevuta/fattura a chi compra (non è una fattura di abbonamento:
      // niente KU Points, provvigioni o donazioni)
      invoice_creation: { enabled: true, invoice_data: { metadata: meta, description: item } },
      success_url: `${SITE_URL}${prefix}/regali?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}${prefix}/regali?canceled=1`,
      ...(customerId ? { customer: customerId } : { customer_email: user.email, customer_creation: 'always' as const }),
    }, managed.options)
    if (!session.url) throw new Error('URL di pagamento mancante')
    const db = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await recordConsent(db, { userId: user.id, kind: 'gift', plan: plan ? (plan as 'base' | 'pro') : null, tool: tool || null, stripeRef: session.id, locale, business, termsAccepted: true })
    return NextResponse.redirect(session.url, 303)
  } catch (error) {
    console.error('❌ Checkout regalo:', error instanceof Error ? error.message : error)
    return back('payment')
  }
}
