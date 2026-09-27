import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation' // ✅ CORRETTO per i Server Component
import { cookies } from 'next/headers'
import Link from 'next/link' // ✅ Corretto
import { getTranslations } from 'next-intl/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { isActiveSubscription } from '@/lib/subscriptionGate'
import { findStripeSubscriptionForUser, subscriptionPeriodEnd } from '@/lib/stripeCustomer'
import { locales, defaultLocale } from '../../../i18n'

type BillingPageProps = {
  searchParams: Promise<{ success?: string; session_id?: string; canceled?: string; error?: string; portal?: string }>
}

type BillingProfile = {
  subscription_status: string | null
  subscription_expires_at: string | null
  email: string | null
  subscription_plan: string | null
}

// Oltre questo tempo una session_id nell'URL non attiva più nulla (link
// vecchi, cronologia del browser): ci pensa il webhook.
const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000
const isRecentSession = (createdSeconds: number) => Date.now() - createdSeconds * 1000 < MAX_SESSION_AGE_MS
const isInFuture = (ms: number) => ms > Date.now()

export default async function BillingPage({ searchParams }: BillingPageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // /billing è fuori da [locale] (il middleware non la tocca): la lingua si
  // prende dal cookie impostato dal selettore lingua / da next-intl.
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value
  const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale
  const t = await getTranslations({ locale, namespace: 'billingPage' })

  const { success, session_id, canceled, error: checkoutError, portal } = await searchParams

  // get_my_profile: l'email non è più leggibile con una select diretta.
  let { data: profile } = await supabase
    .rpc('get_my_profile')
    .maybeSingle<BillingProfile>()

  // Fallback: l'attivazione "normale" avviene tramite il webhook Stripe
  // (checkout.session.completed), ma quel webhook non può raggiungere
  // localhost senza `stripe listen` in ascolto, e in produzione può comunque
  // arrivare in ritardo. Se Stripe ci ha appena rimandati qui con successo e
  // il profilo non risulta ancora attivo, verifichiamo la sessione
  // direttamente con l'API di Stripe e attiviamo subito — evitando che
  // l'utente resti bloccato su "Completa il tuo abbonamento" nonostante il
  // pagamento sia andato a buon fine.
  if (success === 'true' && session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(session_id, { expand: ['subscription'] })
      const isRecent = isRecentSession(session.created)
      const isPaidForThisUser = session.payment_status === 'paid' && session.metadata?.userId === user.id
      // Si attiva solo se l'abbonamento Stripe è davvero in corso adesso
      // (non annullato/scaduto nel frattempo).
      const sub = session.subscription && typeof session.subscription !== 'string' ? session.subscription : null
      const isSubscriptionLive = !!sub && (sub.status === 'active' || sub.status === 'trialing')
      // Scadenza reale: fine del periodo corrente dell'abbonamento Stripe.
      const periodEnd: number | undefined = sub
        ? ((sub as Stripe.Subscription & { current_period_end?: number }).current_period_end ?? sub.items?.data?.[0]?.current_period_end)
        : undefined

      const paidPlan = session.metadata?.plan === 'pro' ? 'pro' : 'base'
      const currentlyActive = isActiveSubscription(profile)
      // Mai declassare un profilo Pro a Base (es. vecchia sessione Base).
      const newPlan = currentlyActive && profile?.subscription_plan === 'pro' ? 'pro' : paidPlan
      const alreadyActive = currentlyActive && (profile?.subscription_plan ?? 'base') === newPlan

      if (isRecent && isPaidForThisUser && isSubscriptionLive && periodEnd && !alreadyActive) {
        const supabaseAdmin = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: updated, error } = await supabaseAdmin
          .from('profiles')
          .update({
            subscription_status: 'active',
            subscription_expires_at: new Date(periodEnd * 1000).toISOString(),
            subscription_source: 'stripe',
            subscription_plan: newPlan,
          })
          .eq('id', user.id)
          .select('subscription_status, subscription_expires_at, email, subscription_plan')
          .single<BillingProfile>()

        if (error) {
          console.error('❌ Errore attivazione abbonamento (fallback /billing):', error.message)
        } else if (updated) {
          profile = updated
        }
      }
    } catch (err) {
      console.error('❌ Errore verifica sessione Stripe su /billing:', err instanceof Error ? err.message : err)
    }
  }

  const isActive = isActiveSubscription(profile)
  const planName = profile?.subscription_plan === 'pro' ? t('planPro') : t('planBase')
  const dateFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  const expiresOn = isActive && profile?.subscription_expires_at
    ? dateFormat.format(new Date(profile.subscription_expires_at))
    : null

  // Origine dell'abbonamento (carta / voucher / admin) e prova Pro: servono a
  // capire se c'è qualcosa da gestire o disdire su Stripe.
  const { data: extra } = await supabase
    .from('profiles')
    .select('subscription_source, pro_trial_ends_at')
    .eq('id', user.id)
    .maybeSingle<{ subscription_source: string | null; pro_trial_ends_at: string | null }>()
  const source = extra?.subscription_source ?? null
  const isStripeSubscriber = isActive && source === 'stripe'
  const isPrepaid = isActive && (source === 'voucher' || source === 'admin')
  const trialEndMs = extra?.pro_trial_ends_at ? new Date(extra.pro_trial_ends_at).getTime() : 0
  const trialEndsOn = isInFuture(trialEndMs) && !(isActive && profile?.subscription_plan === 'pro')
    ? dateFormat.format(new Date(trialEndMs))
    : null

  // Stato reale dell'abbonamento su Stripe (disdetta programmata / rinnovo):
  // best effort, se Stripe non risponde la pagina resta utilizzabile.
  let stripeState: { cancelOn: string | null; renewsOn: string | null } | null = null
  if (isStripeSubscriber) {
    try {
      const found = await findStripeSubscriptionForUser(user.id, user.email)
      const sub = found?.subscription
      if (sub) {
        const periodEnd = subscriptionPeriodEnd(sub)
        const scheduledEnd = sub.cancel_at ?? (sub.cancel_at_period_end ? periodEnd : undefined)
        stripeState = {
          cancelOn: scheduledEnd ? dateFormat.format(new Date(scheduledEnd * 1000)) : null,
          renewsOn: !scheduledEnd && periodEnd ? dateFormat.format(new Date(periodEnd * 1000)) : null,
        }
      }
    } catch (err) {
      console.error('❌ Lettura stato abbonamento Stripe su /billing:', err instanceof Error ? err.message : err)
    }
  }

  const portalNotice =
    portal === 'error' ? t('portalError')
    : portal === 'none' ? t('portalNone')
    : portal === 'not_configured' ? t('portalNotConfigured')
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">

        {!isActive && (checkoutError === 'true' || canceled === 'true') && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {checkoutError === 'true' ? t('errorNotice') : t('canceledNotice')}
          </div>
        )}

        {portalNotice && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {portalNotice}
          </div>
        )}
        {portal === 'return' && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
            {t('portalReturn')}
          </div>
        )}

        <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
          <span className="text-4xl">{isActive ? '✅' : '💳'}</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {isActive ? t('titleActive') : t('titleInactive')}
        </h1>

        <p className="text-gray-600 mb-8">
          {isActive ? t('activeText', { plan: planName }) : t('inactiveText')}
        </p>

        {!isActive && (
          <form action="/api/checkout" method="POST">
            <button
              type="submit"
              className="w-full bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg"
            >
              {t('subscribeCta')}
            </button>
          </form>
        )}

        {isActive && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            <p>{t('statusLabel')} <strong>{t('statusActive', { plan: planName })}</strong></p>
            {expiresOn && <p className="text-xs mt-1">{t('validUntil', { date: expiresOn })}</p>}
            <p className="text-xs mt-1">{t('billingEmail', { email: profile?.email ?? '' })}</p>
          </div>
        )}

        {isStripeSubscriber && (
          <div className="mt-6 rounded-xl border border-gray-200 p-5 text-left">
            <h2 className="text-base font-bold text-gray-900">{t('manageTitle')}</h2>
            <p className="mt-1 text-sm text-gray-600">{t('manageText')}</p>

            {stripeState?.cancelOn && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                {t('cancelScheduled', { date: stripeState.cancelOn })}
              </div>
            )}
            {stripeState?.renewsOn && (
              <p className="mt-3 text-sm text-gray-700">{t('renewsOn', { date: stripeState.renewsOn })}</p>
            )}

            <form action="/api/billing/portal" method="POST" className="mt-4">
              <button
                type="submit"
                className="w-full rounded-xl border border-indigo-600 px-6 py-3 font-bold text-indigo-600 transition-all hover:bg-indigo-50"
              >
                {t('manageCta')}
              </button>
            </form>
            <p className="mt-2 text-xs text-gray-500">{t('manageStripeNote')}</p>
          </div>
        )}

        {isPrepaid && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4 text-left text-sm text-gray-700">
            {expiresOn ? t('prepaidNote', { date: expiresOn }) : t('prepaidNoteNoDate')}
          </div>
        )}

        {trialEndsOn && (
          <div className="mt-6 rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-left text-sm text-indigo-800">
            {t('trialNote', { date: trialEndsOn })}
          </div>
        )}

        {!(isActive && profile?.subscription_plan === 'pro') && (
          <Link href="/pro" className="mt-6 block text-sm font-semibold text-indigo-600 hover:underline">
            {t('discoverPro')}
          </Link>
        )}

        <Link href="/dashboard" className="mt-6 inline-block text-sm text-indigo-600 hover:underline font-medium">
          {t('backToDashboard')}
        </Link>
      </div>
    </div>
  )
}
