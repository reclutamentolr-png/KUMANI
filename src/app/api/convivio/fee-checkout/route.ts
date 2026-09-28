import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { SITE_URL } from '@/lib/siteUrl'
import { MIN_FEE_PAYMENT } from '@/lib/events'
import type { ConvivioMyFees } from '@/app/actions/convivio'

// Kordata: pagamento con carta delle commissioni KUMANI dovute dal fornitore
// Pro (tutte insieme). I metadati NON contengono "userId": il webhook degli
// abbonamenti attiva un piano solo con quello, così un pagamento di
// commissioni non può farlo.
export async function POST(request: Request) {
  const back = (path: string) => NextResponse.redirect(new URL(path, SITE_URL), 303)
  const localePrefix = (() => {
    const locale = new URL(request.url).searchParams.get('locale') ?? 'it'
    return /^(en|fr|es|pt|de|ru)$/.test(locale) ? `/${locale}` : ''
  })()
  const supplierPage = `${localePrefix}/marketplace/convivio/fornitore`
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return back(`${localePrefix}/login`)

    const { data } = await supabase.rpc('convivio_my_fees')
    // Al massimo 12 per pagamento: gli id devono stare tutti nei metadati
    // Stripe (500 caratteri), che il webhook usa per segnarle pagate.
    const due = ((data as ConvivioMyFees | null)?.fees ?? []).filter((fee) => fee.status === 'due').slice(0, 12)
    const total = Math.round(due.reduce((sum, fee) => sum + Number(fee.amount), 0) * 100)
    if (total < MIN_FEE_PAYMENT * 100) return back(`${supplierPage}?fee=none`)

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: total,
            product_data: { name: `KUMANI Kordata — ${due.length === 1 ? due[0].title : `${due.length} Kordate`}` },
          },
        },
      ],
      metadata: { type: 'convivio_fee', supplierId: user.id, feeIds: due.map((fee) => fee.id).join(',') },
      success_url: `${SITE_URL}${supplierPage}?fee_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}${supplierPage}?fee=canceled`,
    })

    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await service
      .from('convivio_fees')
      .update({ stripe_session_id: session.id })
      .in('id', due.map((fee) => fee.id))
      .eq('supplier_id', user.id)
      .eq('status', 'due')

    return NextResponse.redirect(session.url ?? `${SITE_URL}${supplierPage}?fee=error`, 303)
  } catch (err) {
    console.error('[Kordata] fee checkout failed:', err instanceof Error ? err.message : err)
    return back(`${supplierPage}?fee=error`)
  }
}
