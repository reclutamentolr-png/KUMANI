'use server'

import { getLocale, getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { hasActivePreventiviAccess } from '@/lib/quotes-server'
import { getStripe } from '@/lib/stripe'
import { SITE_URL } from '@/lib/siteUrl'
import { localizedPath, notifyUser } from '@/lib/push'
import { quoteAmountDueCents, quoteGrossTotal, quoteVatUnknown, type QuotePaymentMode, type QuoteVatMode } from '@/lib/quotes'
import { recordQuotePayment, retrieveConnectedSession, serviceDb, syncSellerAccount } from '@/lib/shopPayments'

// KUMANI Shop, fase 1: il venditore collega il suo conto Stripe (conto
// Standard di Stripe Connect) e il cliente accetta e paga il preventivo
// dalla pagina pubblica. I soldi vanno direttamente al venditore.

type Result<T = null> = { success: true; data: T } | { success: false; message: string }

export type SellerPaymentStatus = {
  connected: boolean
  chargesEnabled: boolean
  detailsSubmitted: boolean
  // Scheda attività completa (dati del venditore mostrati al cliente)
  profileReady: boolean
}

async function seller() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  if (!(await hasActivePreventiviAccess(supabase, user.id))) return null
  return { supabase, user }
}

async function profileReady(userId: string) {
  const { data } = await serviceDb().from('quote_issuer_profiles').select('company_name, vat_number, address, email').eq('user_id', userId).maybeSingle()
  return !!(data?.company_name?.trim() && data?.vat_number?.trim() && data?.address?.trim() && data?.email?.trim())
}

export async function getSellerPaymentStatus(): Promise<SellerPaymentStatus | null> {
  const s = await seller()
  if (!s) return null
  const [{ data }, ready] = await Promise.all([
    s.supabase.from('seller_stripe_accounts').select('charges_enabled, details_submitted').eq('user_id', s.user.id).maybeSingle(),
    profileReady(s.user.id),
  ])
  return { connected: !!data, chargesEnabled: !!data?.charges_enabled, detailsSubmitted: !!data?.details_submitted, profileReady: ready }
}

// Collega (o completa) il conto Stripe: restituisce il link della procedura
// guidata di Stripe. Servono la Scheda attività completa e le condizioni accettate.
export async function startStripeOnboarding(acceptTerms: boolean, returnTo: 'profile' | 'shop' = 'profile'): Promise<Result<{ url: string }>> {
  const s = await seller()
  if (!s) return { success: false, message: 'notAllowed' }
  if (!acceptTerms) return { success: false, message: 'termsRequired' }
  if (!(await profileReady(s.user.id))) return { success: false, message: 'profileIncomplete' }
  const db = serviceDb()
  const stripe = getStripe()
  try {
    let { data: row } = await db.from('seller_stripe_accounts').select('stripe_account_id').eq('user_id', s.user.id).maybeSingle()
    if (!row) {
      const { data: issuer } = await db.from('quote_issuer_profiles').select('company_name, email').eq('user_id', s.user.id).maybeSingle()
      const account = await stripe.accounts.create({
        type: 'standard',
        country: 'IT',
        email: issuer?.email ?? s.user.email ?? undefined,
        business_profile: { name: issuer?.company_name ?? undefined },
        metadata: { kumani_user_id: s.user.id },
      })
      const { error } = await db
        .from('seller_stripe_accounts')
        .insert({ user_id: s.user.id, stripe_account_id: account.id, terms_accepted_at: new Date().toISOString() })
      if (error) throw new Error(error.message)
      row = { stripe_account_id: account.id }
    }
    const locale = await getLocale()
    // Ritorno dove si è partiti: Scheda attività o KUMANI Shop → Pagamenti
    const back = `${SITE_URL}${localizedPath(locale, returnTo === 'shop' ? '/marketplace/shop' : '/scheda-attivita')}`
    const query = returnTo === 'shop' ? '?tab=payments&stripe=' : '?stripe='
    const link = await stripe.accountLinks.create({
      account: row.stripe_account_id as string,
      refresh_url: `${back}${query}refresh`,
      return_url: `${back}${query}return`,
      type: 'account_onboarding',
    })
    return { success: true, data: { url: link.url } }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Shop] startStripeOnboarding failed:', message)
    // Connect non ancora attivato sul conto Stripe di KUMANI
    return { success: false, message: /connect/i.test(message) ? 'connectUnavailable' : 'stripeError' }
  }
}

// Al ritorno dalla procedura di Stripe: stato aggiornato subito
export async function refreshStripeAccount(): Promise<Result<SellerPaymentStatus>> {
  const s = await seller()
  if (!s) return { success: false, message: 'notAllowed' }
  const { data: row } = await serviceDb().from('seller_stripe_accounts').select('stripe_account_id').eq('user_id', s.user.id).maybeSingle()
  if (row) {
    try {
      await syncSellerAccount(await getStripe().accounts.retrieve(row.stripe_account_id as string))
    } catch (error) {
      console.error('[Shop] refreshStripeAccount failed:', error)
    }
  }
  const status = await getSellerPaymentStatus()
  return status ? { success: true, data: status } : { success: false, message: 'notAllowed' }
}

// Scollega il conto da KUMANI (il conto Stripe del venditore resta suo)
export async function disconnectStripe(): Promise<Result> {
  const s = await seller()
  if (!s) return { success: false, message: 'notAllowed' }
  const { error } = await serviceDb().from('seller_stripe_accounts').delete().eq('user_id', s.user.id)
  if (error) return { success: false, message: 'saveError' }
  return { success: true, data: null }
}

// ---------- Pagina pubblica del preventivo ----------

type PublicQuoteRow = {
  id: string
  user_id: string
  quote_number: number
  client_email: string | null
  total: number
  vat_mode: QuoteVatMode | null
  vat_rate: number | null
  payment_mode: QuotePaymentMode
  deposit_percent: number | null
  payment_status: string
  accepted_at: string | null
  valid_until: string | null
}

async function quoteByToken(token: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null
  const db = serviceDb()
  const { data: quote } = await db
    .from('quotes')
    .select('id, user_id, quote_number, client_email, total, vat_mode, vat_rate, payment_mode, deposit_percent, payment_status, accepted_at, valid_until')
    .eq('public_token', token)
    .maybeSingle<PublicQuoteRow>()
  if (!quote) return null
  // Solo se il venditore ha ancora i Preventivi attivi (stessa regola della pagina)
  const { data: visible } = await db.rpc('public_page_visible', { p_owner: quote.user_id, p_tool: 'preventivi' })
  return visible ? quote : null
}

const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ').slice(0, 120)

// Accettazione senza pagamento online
export async function acceptPublicQuote(token: string, name: string): Promise<Result> {
  const quote = await quoteByToken(token)
  if (!quote) return { success: false, message: 'notFound' }
  const who = cleanName(name)
  if (who.length < 2) return { success: false, message: 'nameRequired' }
  if (quote.accepted_at) return { success: true, data: null }
  if (quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10)) return { success: false, message: 'expired' }
  const { error } = await serviceDb()
    .from('quotes')
    .update({ accepted_at: new Date().toISOString(), accepted_by_name: who })
    .eq('id', quote.id)
    .is('accepted_at', null)
  if (error) return { success: false, message: 'saveError' }
  await notifyUser(
    quote.user_id,
    'messages',
    (t, locale) => ({
      title: t('quoteAcceptedTitle', { number: quote.quote_number }),
      body: t('quoteAcceptedBody', { name: who }),
      url: localizedPath(locale, `/marketplace/preventivi/${quote.id}`),
      tag: `quote-accepted-${quote.id}`,
    }),
    { kind: 'quote_accepted', ref: quote.id }
  )
  return { success: true, data: null }
}

// Accetta e paga: Checkout di Stripe sul conto del venditore
export async function startQuoteCheckout(token: string, name: string): Promise<Result<{ url: string }>> {
  const quote = await quoteByToken(token)
  if (!quote) return { success: false, message: 'notFound' }
  const who = cleanName(name)
  if (who.length < 2) return { success: false, message: 'nameRequired' }
  if (quote.payment_status === 'paid') return { success: false, message: 'alreadyPaid' }
  if (quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10)) return { success: false, message: 'expired' }
  // «+ IVA» senza aliquota: non si sa il totale da pagare
  if (quoteVatUnknown(quote.vat_mode, quote.vat_rate)) return { success: false, message: 'vatMissing' }
  // Si paga il totale con l'IVA (o l'acconto su quel totale)
  const amount = quoteAmountDueCents(quoteGrossTotal(quote.total, quote.vat_mode, quote.vat_rate), quote.payment_mode, quote.deposit_percent)
  if (amount < 50) return { success: false, message: 'noPayment' }
  const db = serviceDb()
  const { data: account } = await db.from('seller_stripe_accounts').select('stripe_account_id, charges_enabled').eq('user_id', quote.user_id).maybeSingle()
  if (!account?.charges_enabled) return { success: false, message: 'sellerNotReady' }
  const { data: issuer } = await db.from('quote_issuer_profiles').select('company_name').eq('user_id', quote.user_id).maybeSingle()

  const locale = await getLocale()
  const t = await getTranslations('quotePublic')
  const page = `${SITE_URL}${localizedPath(locale, `/preventivo/${token}`)}`
  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: 'payment',
        locale: (['it', 'en', 'fr', 'es', 'pt', 'de', 'ru'].includes(locale) ? locale : 'auto') as 'auto',
        customer_email: quote.client_email || undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: amount,
              product_data: {
                name:
                  quote.payment_mode === 'deposit'
                    ? t('checkoutDeposit', { percent: quote.deposit_percent ?? 0, number: quote.quote_number })
                    : t('checkoutItem', { number: quote.quote_number }),
                description: issuer?.company_name ?? undefined,
              },
            },
          },
        ],
        payment_intent_data: { metadata: { quote_id: quote.id } },
        metadata: { kind: 'quote', quote_id: quote.id, accepted_by_name: who },
        success_url: `${page}?paid={CHECKOUT_SESSION_ID}`,
        cancel_url: `${page}?cancelled=1`,
      },
      { stripeAccount: account.stripe_account_id as string }
    )
    await db.from('quotes').update({ accepted_by_name: who, stripe_checkout_session_id: session.id }).eq('id', quote.id)
    return { success: true, data: { url: session.url! } }
  } catch (error) {
    console.error('[Shop] startQuoteCheckout failed:', error)
    return { success: false, message: 'stripeError' }
  }
}

// Ritorno dal pagamento: conferma subito, senza aspettare il webhook
export async function confirmQuotePayment(token: string, sessionId: string): Promise<boolean> {
  if (!/^cs_[A-Za-z0-9_]{10,200}$/.test(sessionId)) return false
  const quote = await quoteByToken(token)
  if (!quote) return false
  if (quote.payment_status === 'paid') return true
  const { data: account } = await serviceDb().from('seller_stripe_accounts').select('stripe_account_id').eq('user_id', quote.user_id).maybeSingle()
  if (!account) return false
  try {
    const session = await retrieveConnectedSession(sessionId, account.stripe_account_id as string)
    if (session.metadata?.quote_id !== quote.id) return false
    return await recordQuotePayment(session)
  } catch (error) {
    console.error('[Shop] confirmQuotePayment failed:', error)
    return false
  }
}

// ---------------------------------------------------------------------------
// Guida al collegamento (KUMANI Shop → Pagamenti): cosa manca nella Scheda
// attività e cosa chiede Stripe, letto dal conto in tempo reale
// ---------------------------------------------------------------------------

export type RequirementGroup = 'document' | 'identity' | 'address' | 'contact' | 'bank' | 'business' | 'tax' | 'terms' | 'other'
export type ProfileField = 'company_name' | 'vat_number' | 'address' | 'email'

export type SellerPaymentsDetail = SellerPaymentStatus & {
  payoutsEnabled: boolean
  missingProfile: ProfileField[]
  // Da completare (scaduti per primi)
  due: { group: RequirementGroup; pastDue: boolean }[]
  // Dati rifiutati da Stripe (con il motivo di Stripe, in inglese)
  errors: { group: RequirementGroup; code: string; reason: string }[]
  pendingVerification: boolean
  // Perché i pagamenti sono fermi: in verifica, dati mancanti, rifiutato, altro
  blocked: 'review' | 'requirements' | 'rejected' | 'other' | null
  deadline: string | null
  testMode: boolean
}

function requirementGroup(key: string): RequirementGroup {
  if (/verification\.(additional_)?document/.test(key)) return 'document'
  if (key.startsWith('external_account')) return 'bank'
  if (key.startsWith('tos_acceptance')) return 'terms'
  if (/tax_id|vat_id|registration_number/.test(key)) return 'tax'
  if (/\.address/.test(key)) return 'address'
  if (/phone|email/.test(key)) return 'contact'
  if (/dob|first_name|last_name|id_number|relationship|representative|owners|directors|executives|individual\.|person_/.test(key)) return 'identity'
  if (/^business_profile|^business_type|^company\.|^settings\./.test(key)) return 'business'
  return 'other'
}

export async function getSellerPaymentsDetail(): Promise<SellerPaymentsDetail | null> {
  const s = await seller()
  if (!s) return null
  const db = serviceDb()
  const [{ data: issuer }, { data: row }] = await Promise.all([
    db.from('quote_issuer_profiles').select('company_name, vat_number, address, email').eq('user_id', s.user.id).maybeSingle(),
    db.from('seller_stripe_accounts').select('stripe_account_id, charges_enabled, payouts_enabled, details_submitted').eq('user_id', s.user.id).maybeSingle(),
  ])
  const missingProfile = (['company_name', 'vat_number', 'address', 'email'] as ProfileField[]).filter((f) => !String(issuer?.[f] ?? '').trim())
  const testMode = (process.env.STRIPE_SECRET_KEY ?? '').startsWith('sk_test_')
  const base: SellerPaymentsDetail = {
    connected: !!row,
    chargesEnabled: !!row?.charges_enabled,
    detailsSubmitted: !!row?.details_submitted,
    payoutsEnabled: !!row?.payouts_enabled,
    profileReady: missingProfile.length === 0,
    missingProfile,
    due: [],
    errors: [],
    pendingVerification: false,
    blocked: null,
    deadline: null,
    testMode,
  }
  if (!row) return base
  try {
    const account = await getStripe().accounts.retrieve(row.stripe_account_id as string)
    await syncSellerAccount(account)
    const req = account.requirements
    const seen = new Set<string>()
    const due: SellerPaymentsDetail['due'] = []
    for (const [keys, pastDue] of [[req?.past_due ?? [], true], [req?.currently_due ?? [], false]] as const) {
      for (const key of keys) {
        const group = requirementGroup(key)
        if (seen.has(group)) continue
        seen.add(group)
        due.push({ group, pastDue })
      }
    }
    const reason = req?.disabled_reason ?? null
    return {
      ...base,
      chargesEnabled: !!account.charges_enabled,
      payoutsEnabled: !!account.payouts_enabled,
      detailsSubmitted: !!account.details_submitted,
      due,
      errors: (req?.errors ?? []).slice(0, 10).map((e) => ({ group: requirementGroup(e.requirement), code: e.code, reason: e.reason })),
      pendingVerification: (req?.pending_verification?.length ?? 0) > 0,
      blocked: account.charges_enabled
        ? null
        : !reason
          ? null
          : reason.startsWith('rejected')
            ? 'rejected'
            : reason === 'under_review' || reason === 'requirements.pending_verification'
              ? 'review'
              : reason.startsWith('requirements')
                ? 'requirements'
                : 'other',
      deadline: req?.current_deadline ? new Date(req.current_deadline * 1000).toISOString() : null,
    }
  } catch (error) {
    console.error('[Shop] stato del conto Stripe non letto:', error instanceof Error ? error.message : error)
    return base
  }
}
