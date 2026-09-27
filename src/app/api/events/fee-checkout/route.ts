import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { SITE_URL } from '@/lib/siteUrl'
import { MIN_FEE_PAYMENT, type EventFee } from '@/lib/events'

// KUMANI Events: pagamento con carta delle commissioni dovute (tutte insieme).
// I metadati NON contengono "userId": il webhook degli abbonamenti attiva un
// piano solo con quello, così un pagamento di commissioni non può farlo.
export async function POST(request: Request) {
  const back = (path: string) => NextResponse.redirect(new URL(path, SITE_URL), 303)
  const localePrefix = (() => {
    const locale = new URL(request.url).searchParams.get('locale') ?? 'it'
    return /^(en|fr|es|pt|de|ru)$/.test(locale) ? `/${locale}` : ''
  })()
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return back(`${localePrefix}/login`)

    const { data } = await supabase.rpc('event_my_fees')
    const due = ((data as EventFee[] | null) ?? []).filter((fee) => fee.status === 'due')
    const total = Math.round(due.reduce((sum, fee) => sum + Number(fee.amount), 0) * 100)
    if (total < MIN_FEE_PAYMENT * 100) return back(`${localePrefix}/events/my?fee=none`)

    const session = await getStripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: total,
            product_data: { name: `KUMANI Events — ${due.length === 1 ? due[0].title : `${due.length} eventi`}` },
          },
        },
      ],
      metadata: { type: 'event_fee', organizerId: user.id, feeIds: due.map((fee) => fee.id).join(',').slice(0, 480) },
      success_url: `${SITE_URL}${localePrefix}/events/my?fee_session={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}${localePrefix}/events/my?fee=canceled`,
    })

    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await service
      .from('event_fees')
      .update({ stripe_session_id: session.id })
      .in('id', due.map((fee) => fee.id))
      .eq('organizer_id', user.id)
      .eq('status', 'due')

    return NextResponse.redirect(session.url ?? `${SITE_URL}${localePrefix}/events/my?fee=error`, 303)
  } catch (err) {
    console.error('[Events] fee checkout failed:', err instanceof Error ? err.message : err)
    return back(`${localePrefix}/events/my?fee=error`)
  }
}
