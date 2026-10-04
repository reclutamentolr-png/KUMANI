import { createClient as createServiceClient } from '@supabase/supabase-js'
import { recordConsent } from '@/lib/withdrawal'
import { SITE_URL } from '@/lib/siteUrl'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { parseVatInput } from '@/lib/vat'
import { getToolPassOffer, TOOL_PASS_TYPE } from '@/lib/toolPasses'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { locales, defaultLocale } from '../../../../../i18n'

// Acquisto del pass di un singolo servizio (1 anno, pagamento una tantum).
// Stessi controlli del checkout degli abbonamenti: consenso all'avvio
// immediato per il privato, P.IVA e dichiarazione B2B per l'azienda.
export async function POST(request: Request) {
  const tool = new URL(request.url).searchParams.get('tool') ?? ''
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const pagePath = `${prefix}/pass/${encodeURIComponent(tool)}`
  const back = (error: string) => NextResponse.redirect(new URL(`${pagePath}?error=${error}`, SITE_URL), 303)

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL(`${prefix}/login?next=${encodeURIComponent(`/pass/${tool}`)}`, SITE_URL), 303)

    const offer = await getToolPassOffer(supabase, tool)
    if (!offer.enabled) return back('unavailable')

    // Chi può già usare il servizio con il suo piano non paga il pass
    const { data: access } = await supabase.rpc('can_use_tool', { p_tool: tool }).maybeSingle<{ allowed: boolean }>()
    const { data: passes } = await supabase.rpc('my_tool_passes')
    const hasPass = Array.isArray(passes) && (passes as { tool: string }[]).some((row) => row.tool === tool)
    if (access?.allowed && !hasPass) return back('already')

    const form = await request.formData().catch(() => null)
    const isBusiness = form?.get('buyer_type') === 'business'
    let business: { name: string; vat: string } | null = null
    if (isBusiness) {
      const name = String(form?.get('business_name') ?? '').trim().slice(0, 200)
      const vat = parseVatInput(String(form?.get('vat_number') ?? ''))
      if (!name || form?.get('business_declaration') !== '1') return back('business')
      if (!vat?.ok) return back('vat')
      business = { name, vat: vat.normalized }
    } else if (form?.get('immediate_start') !== '1') {
      return back('consent')
    }
    // Termini di servizio e Privacy accettati (per privati e aziende)
    if (form?.get('accept_terms') !== '1') return back('terms')

    const marketplaceT = await getTranslations({ locale, namespace: 'marketplace' })
    const toolInfo = getMarketplaceTools((key) => marketplaceT(key)).find((item) => item.toolName === tool)
    const tp = await getTranslations({ locale, namespace: 'toolPass' })
    const productName = tp('productName', { service: toolInfo?.title ?? tool })

    const now = new Date().toISOString()
    const meta: Record<string, string> = {
      type: TOOL_PASS_TYPE,
      userId: user.id,
      tool,
      locale,
      ...(business
        ? { buyer_type: 'business', business_name: business.name, vat_number: business.vat, business_declaration: now, terms_accepted: now }
        : { buyer_type: 'consumer', immediate_start_consent: now, terms_accepted: now }),
    }

    const stripe = getStripe()
    let customerId: string | null = null
    if (business) {
      const customer = await stripe.customers
        .create({ email: user.email, name: business.name, tax_id_data: [{ type: 'eu_vat', value: business.vat }], metadata: { userId: user.id } })
        .catch(() => stripe.customers.create({ email: user.email, name: business.name, metadata: { userId: user.id, vat_number: business.vat } }))
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: { currency: 'eur', unit_amount: offer.priceCents, product_data: { name: productName } },
        },
      ],
      metadata: meta,
      payment_intent_data: { metadata: meta },
      // Ricevuta/fattura del pagamento (non è una fattura di abbonamento:
      // niente KU Points, provvigioni o donazioni)
      invoice_creation: { enabled: true, invoice_data: { metadata: meta, description: productName } },
      success_url: `${SITE_URL}${pagePath}?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}${pagePath}?canceled=1`,
      ...(customerId ? { customer: customerId } : { customer_email: user.email, customer_creation: 'always' as const }),
    })
    if (!session.url) throw new Error('URL di pagamento mancante')
    // Prova del consenso (avvio immediato o dichiarazione aziendale + Termini)
    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await recordConsent(service, { userId: user.id, kind: 'pass', plan: null, tool, stripeRef: session.id, locale, business, termsAccepted: true })
    return NextResponse.redirect(session.url, 303)
  } catch (error) {
    console.error('❌ Checkout pass servizio:', error instanceof Error ? error.message : error)
    return back('payment')
  }
}
