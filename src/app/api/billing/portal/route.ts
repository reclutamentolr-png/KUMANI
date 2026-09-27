import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { findStripeSubscriptionForUser, isPortalNotConfiguredError } from '@/lib/stripeCustomer'

// Apre il Customer Portal di Stripe (cambio carta, fatture, disdetta) per chi
// paga l'abbonamento con carta. Chiamata da un <form method="POST"> su /billing.
export async function POST() {
  const back = (portal: string) => NextResponse.redirect(new URL(`/billing?portal=${portal}`, SITE_URL), 303)

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', SITE_URL), 303)

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_source')
      .eq('id', user.id)
      .maybeSingle()
    // Voucher / attivazioni admin: su Stripe non c'è nulla da gestire.
    if (profile?.subscription_source !== 'stripe') return back('none')

    const found = await findStripeSubscriptionForUser(user.id, user.email)
    if (!found) return back('none')

    try {
      const session = await getStripe().billingPortal.sessions.create({
        customer: found.customerId,
        return_url: `${SITE_URL}/billing?portal=return`,
      })
      return NextResponse.redirect(session.url, 303)
    } catch (err) {
      if (isPortalNotConfiguredError(err)) {
        console.error(
          '❌ Stripe Customer Portal NON configurato: salvare le impostazioni in Dashboard Stripe → Impostazioni → Billing → Customer portal ' +
          '(https://dashboard.stripe.com/test/settings/billing/portal in modalità test).',
          err instanceof Error ? err.message : err
        )
        return back('not_configured')
      }
      throw err
    }
  } catch (err) {
    console.error('❌ Errore apertura Stripe Customer Portal:', err)
    return back('error')
  }
}
