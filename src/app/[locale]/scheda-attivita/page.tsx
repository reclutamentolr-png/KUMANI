import { redirect } from 'next/navigation'
import NextStepNudge from '@/components/ecosystem/NextStepNudge'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Building2 } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import AppHeader from '@/components/nav/AppHeader'
import BusinessProfileForm from '@/components/businessProfile/BusinessProfileForm'
import { createClient } from '@/lib/supabase/server'
import { getMyBusinessProfile } from '@/lib/businessProfile-server'
import { getSessionUser } from '@/lib/session'
import SellerPaymentsCard from '@/components/shop/SellerPaymentsCard'
import { getSellerPaymentStatus } from '@/app/actions/shop'

// «Scheda attività»: i dati dell'attività scritti una volta sola e ripresi
// da tutti i servizi. ?from=/percorso riporta al servizio da cui si arriva.
export default async function BusinessProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ from?: string; stripe?: string }>
}) {
  const { locale } = await params
  const { from, stripe } = await searchParams
  const user = await getSessionUser()
  if (!user) redirect(`/${locale}/login?next=/scheda-attivita`)

  const [t, supabase] = await Promise.all([getTranslations('businessProfile'), createClient()])
  const [profile, { data: proAccess }, { data: baseAccess }] = await Promise.all([
    getMyBusinessProfile(supabase, user.id),
    supabase.rpc('can_use_tool', { p_tool: 'preventivi' }).maybeSingle<{ allowed: boolean }>(),
    supabase.rpc('can_use_tool', { p_tool: 'link-in-bio' }).maybeSingle<{ allowed: boolean }>(),
  ])
  const allowed = !!proAccess?.allowed || !!baseAccess?.allowed
  // KUMANI Shop: pagamenti online dei preventivi (solo con il Pro)
  const sellerPayments = proAccess?.allowed ? await getSellerPaymentStatus() : null
  const back = from && /^\/(?!\/)[A-Za-z0-9/_-]*$/.test(from) ? from : null

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <AppHeader title={t('title')} subtitle={t('subtitle')} icon={<Building2 className="h-6 w-6" />} />
      <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {back && (
          <Link href={back} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
            <ArrowLeft className="h-4 w-4" /> {t('backToService')}
          </Link>
        )}
        <p className="text-[var(--muted)]">{t('intro')}</p>
        {allowed ? (
          <>
            <BusinessProfileForm initial={profile} />
            {sellerPayments && <SellerPaymentsCard initial={sellerPayments} returning={stripe === 'return' || stripe === 'refresh'} />}
          </>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--gold)]/40 bg-[var(--gold-pale)] p-5 text-[var(--ink)]">
            <span>{t('planRequired')}</span>
            <Link href="/pro" className="rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-semibold text-white">
              {t('planCta')}
            </Link>
          </div>
        )}
        {/* Ecosistema: il passo successivo, se il servizio non è ancora incluso */}
        <NextStepNudge tool="preventivi" name="Pro" reason="nudgeProfileToPro" className="mt-8" />
      </main>
    </div>
  )
}
