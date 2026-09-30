import { SITE_URL } from '@/lib/siteUrl'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { isActiveSubscription } from '@/lib/subscriptionGate'
import { cookies } from 'next/headers'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { recordConsent } from '@/lib/withdrawal'
import { locales, defaultLocale } from '../../../../i18n'

export async function POST(request: Request) {
  const base = SITE_URL
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.redirect(new URL('/register', base), 303)
    }

    // Piano scelto: Base (49 €/anno, default) o Pro (149 €/anno, ?plan=pro).
    const plan = new URL(request.url).searchParams.get('plan') === 'pro' ? 'pro' : 'base'
    const priceId = plan === 'pro' ? process.env.STRIPE_PRICE_ID_PRO : process.env.STRIPE_PRICE_ID
    if (!priceId) {
      return NextResponse.redirect(new URL(plan === 'pro' ? '/pro?error=unavailable' : '/billing?error=true', base), 303)
    }

    // Consenso all'avvio immediato (casella obbligatoria nel modulo): senza,
    // si torna alla pagina di partenza con l'avviso.
    const form = await request.formData().catch(() => null)
    if (form?.get('immediate_start') !== '1') {
      return NextResponse.redirect(new URL(plan === 'pro' ? '/pro?error=consent' : '/billing?error=consent', base), 303)
    }
    const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
    const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale

    // Chi paga già con carta non apre un secondo abbonamento: passa a Pro
    // dalla pagina Pro (Stripe calcola la differenza sull'abbonamento attuale).
    const { data: current } = await supabase
      .from('profiles')
      .select('subscription_status, subscription_source, subscription_expires_at, subscription_plan')
      .eq('id', user.id)
      .maybeSingle()
    const hasActiveSubscription = isActiveSubscription(current)
    const hasStripeSubscription = hasActiveSubscription && current?.subscription_source === 'stripe'
    if (hasStripeSubscription) {
      return NextResponse.redirect(new URL(plan === 'pro' ? '/pro' : '/billing', base), 303)
    }
    // Abbonamento già attivo (anche da voucher): niente secondo pagamento per
    // lo stesso piano. Il Pro resta acquistabile da chi ha solo il Base.
    if (hasActiveSubscription && (plan === 'base' || current?.subscription_plan === 'pro')) {
      return NextResponse.redirect(new URL(plan === 'pro' ? '/pro' : '/billing', base), 303)
    }

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        userId: user.id,
        plan,
        immediate_start_consent: new Date().toISOString(),
      },
      // Propaga lo stesso userId anche sull'oggetto Subscription (non solo
      // sulla Checkout Session): senza questo, gli eventi successivi
      // customer.subscription.updated/deleted nel webhook non riescono a
      // risalire all'utente e non aggiornano lo stato dell'abbonamento.
      subscription_data: {
        metadata: {
          userId: user.id,
          plan,
          immediate_start_consent: new Date().toISOString(),
        },
      },
      // session_id nell'URL permette a /billing di verificare e attivare
      // l'abbonamento anche se il webhook non arriva (es. in locale senza
      // `stripe listen` in ascolto).
      success_url: `${SITE_URL}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE_URL}/billing?canceled=true`,
      customer_email: user.email,
    })

    // Controllo esplicito per evitare l'errore "string | null" di TypeScript
    if (!session.url) {
      throw new Error('Impossibile ottenere l\'URL di reindirizzamento da Stripe')
    }

    const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    await recordConsent(service, { userId: user.id, kind: 'checkout', plan, stripeRef: session.id, locale })
    
    return NextResponse.redirect(session.url, 303)
    
  } catch (error: unknown) {
    console.error('❌ Errore Stripe Checkout:', error)
    return NextResponse.redirect(new URL('/billing?error=true', SITE_URL), 303)
  }
}