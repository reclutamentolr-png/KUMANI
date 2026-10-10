'use server'

import { verifyAdmin } from '@/lib/verifyAdmin'
import { getStripe } from '@/lib/stripe'
import { serviceDb } from '@/lib/shopPayments'

// Admin → Impostazioni → KUMANI Shop: conto venditore di PROVA, già pronto a
// ricevere pagamenti con i dati di test di Stripe, per mostrare o provare lo
// Shop senza registrarsi su Stripe. Solo con Stripe in modalità test.

type Result = { success: true; account: string; email: string } | { success: false; error: string }

export async function adminCreateTestSeller(email: string): Promise<Result> {
  const admin = await verifyAdmin('settings.write')
  if (!admin) return { success: false, error: 'Non autorizzato' }
  if (!(process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_')) return { success: false, error: 'Stripe è in modalità reale: il conto di prova si crea solo in modalità test.' }
  const db = serviceDb()
  const wanted = email.trim().toLowerCase()
  if (!wanted) return { success: false, error: 'Scrivi l’email del Kumano.' }
  const { data: profile } = await db.from('profiles').select('id, email').ilike('email', wanted).maybeSingle()
  if (!profile) return { success: false, error: 'Nessun Kumano con questa email.' }
  const userId = profile.id as string

  const [{ data: issuer }, { data: shop }] = await Promise.all([
    db.from('quote_issuer_profiles').select('company_name').eq('user_id', userId).maybeSingle(),
    db.from('shop_settings').select('name').eq('owner_id', userId).maybeSingle(),
  ])
  const name = (shop?.name || issuer?.company_name || 'Negozio di prova KUMANI').slice(0, 80)
  try {
    const stripe = getStripe()
    const account = await stripe.accounts.create({
      country: 'IT',
      email: `prova+${userId.slice(0, 8)}@kumani.io`,
      controller: { fees: { payer: 'application' }, losses: { payments: 'application' }, requirement_collection: 'application', stripe_dashboard: { type: 'none' } },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      business_type: 'individual',
      business_profile: { name, mcc: '5947', url: 'https://kumani.io', product_description: 'Negozio di prova KUMANI Shop' },
      // Dati di prova di Stripe: verifica immediata in modalità test
      individual: {
        first_name: 'Prova',
        last_name: 'Venditore',
        email: `prova+${userId.slice(0, 8)}@kumani.io`,
        phone: '+390000000000',
        dob: { day: 1, month: 1, year: 1901 },
        address: { line1: 'address_full_match', city: 'Milano', postal_code: '20121', country: 'IT' },
      },
      external_account: { object: 'bank_account', country: 'IT', currency: 'eur', account_number: 'IT60X0542811101000000123456' },
      tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
      metadata: { kumani_user_id: userId, kumani_test: 'true' },
    })
    // Il conto precedente (se c'era) si scollega da KUMANI; resta su Stripe
    await db.from('seller_stripe_accounts').delete().eq('user_id', userId)
    const { error } = await db.from('seller_stripe_accounts').insert({
      user_id: userId,
      stripe_account_id: account.id,
      terms_accepted_at: new Date().toISOString(),
      charges_enabled: !!account.charges_enabled,
      payouts_enabled: !!account.payouts_enabled,
      details_submitted: true,
    })
    if (error) return { success: false, error: error.message }
    return { success: true, account: account.id, email: profile.email as string }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Stripe non risponde' }
  }
}
