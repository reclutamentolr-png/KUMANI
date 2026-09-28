import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, HandPlatter, Store } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import SupplierArea from '@/components/convivio/SupplierArea'
import { getMyConvivioFees, getMySupplier, listConvivi } from '@/app/actions/convivio'
import { markConvivioFeesPaid } from '@/lib/eventFees'
import { createClient } from '@/lib/supabase/server'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

// Convivio → Area fornitore (professionisti Pro)
export default async function ConvivioSupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ fee_session?: string; fee?: string }>
}) {
  const { locale } = await params
  const query = await searchParams
  const t = await getTranslations('convivio')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  // Ritorno dal pagamento delle commissioni: le segniamo pagate subito (il
  // webhook fa lo stesso, questa è la riserva se arriva in ritardo).
  let feeNotice: 'paid' | 'pending' | 'canceled' | 'error' | 'none' | null = null
  if (query.fee_session && /^cs_[A-Za-z0-9_]+$/.test(query.fee_session)) {
    try {
      feeNotice = (await markConvivioFeesPaid(query.fee_session, user.id)) ? 'paid' : 'pending'
    } catch (err) {
      console.error('[Kordata] mark fees paid failed:', err instanceof Error ? err.message : err)
      feeNotice = 'pending'
    }
  } else if (query.fee === 'canceled' || query.fee === 'error' || query.fee === 'none') {
    feeNotice = query.fee
  }

  const [info, orders, fees, { data: profile }] = await Promise.all([
    getMySupplier(),
    listConvivi('supplier'),
    getMyConvivioFees(),
    // Paese del profilo: proposto come paese della partita IVA
    supabase.from('profiles').select('country_code').eq('id', user.id).maybeSingle(),
  ])

  const online = await isToolOnline('convivio')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/marketplace/convivio" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('backToList')}
          </Link>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">{t('supplierArea')}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!online && <SuspendedBanner className="mb-6" />}
        <div className="relative mb-6 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <HandPlatter className="h-4 w-4" />
              Kordata
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">{t('supplierArea')}</h1>
            <p className="mt-3 text-base text-white/70 sm:text-lg">{t('supplierAreaIntro')}</p>
          </div>
        </div>
        <SupplierArea
          info={info ?? { is_pro: false, supplier: null, prefill: null }} userId={user.id} orders={orders} fees={fees} feeNotice={feeNotice}
          profileCountry={(profile?.country_code as string | null) ?? null}
        />
      </main>
    </div>
  )
}
