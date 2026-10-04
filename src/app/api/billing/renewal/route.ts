import { NextResponse } from 'next/server'
import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { findStripeSubscriptionForUser } from '@/lib/stripeCustomer'

// Rinnovo automatico on/off con un clic da /billing (form POST, campo
// "renew" = 0 o 1). Spento: l'abbonamento resta attivo fino alla fine del
// periodo già pagato e poi non si rinnova; acceso: torna a rinnovarsi.
export async function POST(request: Request) {
  const back = (renewal: string) => NextResponse.redirect(new URL(`/billing?renewal=${renewal}`, SITE_URL), 303)
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.redirect(new URL('/login', SITE_URL), 303)

    const form = await request.formData().catch(() => null)
    const renew = form?.get('renew') === '1'
    const found = await findStripeSubscriptionForUser(user.id, user.email)
    if (!found?.subscription) return back('error')

    await getStripe().subscriptions.update(found.subscription.id, { cancel_at_period_end: !renew })
    return back(renew ? 'on' : 'off')
  } catch (err) {
    console.error('❌ Cambio rinnovo automatico:', err instanceof Error ? err.message : err)
    return back('error')
  }
}
