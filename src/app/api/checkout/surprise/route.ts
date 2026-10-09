import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { recordConsent } from '@/lib/withdrawal'
import { SITE_URL } from '@/lib/siteUrl'
import { getStripe, managedPayments, MANAGED_PAYMENTS_ON } from '@/lib/stripe'
import { parseVatInput } from '@/lib/vat'
import { SURPRISE_TYPE, isSurpriseKind } from '@/lib/surprise'
import { getSurprisePrices, surpriseDb } from '@/lib/surpriseServer'
import { locales, defaultLocale } from '../../../../../i18n'

// Pagamento di una sorpresa (una tantum): attiva il link da mandare. Privato:
// consenso all'attivazione immediata del contenuto digitale (art. 59 lett. o
// Codice del Consumo); azienda: P.IVA e dichiarazione B2B. Per tutti Termini
// e Privacy. Il tipo e il prezzo li prende dal database, non dal modulo.
export async function POST(request: Request) {
  const id = new URL(request.url).searchParams.get('id') ?? ''
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale
  const prefix = locale === defaultLocale ? '' : `/${locale}`
  const pagePath = `${prefix}/sorprese/${encodeURIComponent(id)}`
  const back = (error: string) => NextResponse.redirect(new URL(`${pagePath}?error=${error}#pay`, SITE_URL), 303)

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL(`${prefix}/login?next=${encodeURIComponent(`/sorprese/${id}`)}`, SITE_URL), 303)

    const { data: gift } = await supabase.from('surprise_gifts').select('id, kind, status, title, recipient_name').eq('id', id).eq('user_id', user.id).maybeSingle()
    if (!gift) return back('notFound')
    if (gift.status !== 'draft') return back('alreadyActive')
    if (!isSurpriseKind(gift.kind) || !String(gift.title).trim() || !String(gift.recipient_name).trim()) return back('incomplete')

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
    if (form?.get('accept_terms') !== '1') return back('terms')

    const prices = await getSurprisePrices()
    const amount = prices[gift.kind]
    const t = await getTranslations({ locale, namespace: 'surprise' })
    const productName = t(`product_${gift.kind}`)

    const now = new Date().toISOString()
    // buyerId (non userId): il webhook non deve scambiarlo per un abbonamento
    const meta: Record<string, string> = {
      type: SURPRISE_TYPE,
      buyerId: user.id,
      giftId: gift.id,
      kind: gift.kind,
      locale,
      terms_accepted: now,
      ...(business
        ? { buyer_type: 'business', business_name: business.name, vat_number: business.vat, business_declaration: now }
        : { buyer_type: 'consumer', immediate_start_consent: now }),
    }

    const stripe = getStripe()
    let customerId: string | null = null
    if (business) {
      const customer = await stripe.customers
        .create({ email: user.email, name: business.name, tax_id_data: [{ type: 'eu_vat', value: business.vat }], metadata: { userId: user.id } })
        .catch(() => stripe.customers.create({ email: user.email, name: business.name, metadata: { userId: user.id, vat_number: business.vat } }))
      customerId = customer.id
    }

    const managed = managedPayments()
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        ...(MANAGED_PAYMENTS_ON ? managed.params : { payment_method_types: ['card'] }),
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: amount,
              product_data: { name: productName, ...(managed.productTaxCode ? { tax_code: managed.productTaxCode } : {}) },
              ...(MANAGED_PAYMENTS_ON ? { tax_behavior: 'inclusive' as const } : {}),
            },
          },
        ],
        metadata: meta,
        payment_intent_data: { metadata: meta },
        // Ricevuta/fattura (non è un abbonamento: niente KU Points né provvigioni)
        invoice_creation: { enabled: true, invoice_data: { metadata: meta, description: productName } },
        success_url: `${SITE_URL}${pagePath}?paid=1&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${SITE_URL}${pagePath}?canceled=1#pay`,
        ...(customerId ? { customer: customerId } : { customer_email: user.email, customer_creation: 'always' as const }),
      },
      managed.options
    )
    if (!session.url) throw new Error('URL di pagamento mancante')
    await recordConsent(surpriseDb(), { userId: user.id, kind: 'surprise', plan: null, tool: null, stripeRef: session.id, locale, business, termsAccepted: true })
    return NextResponse.redirect(session.url, 303)
  } catch (error) {
    console.error('❌ Checkout sorpresa:', error instanceof Error ? error.message : error)
    return back('payment')
  }
}
