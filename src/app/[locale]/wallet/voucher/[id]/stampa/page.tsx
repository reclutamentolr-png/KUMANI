import { redirect, notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { SITE_URL } from '@/lib/siteUrl'
import Link from '@/components/LocalizedLink'
import VoucherPrintStudio from '@/components/voucherPrint/VoucherPrintStudio'

export const dynamic = 'force-dynamic'

// Cartolina o biglietto da stampare per un voucher del Kumano (premi delle
// qualifiche, voucher creati con i KU Points): stesse 3 grafiche dei lotti
// Admin, con frase a scelta. Solo i propri voucher ancora da usare.
export default async function VoucherPrintPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const service = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: voucher } = await service
    .from('subscription_vouchers')
    .select('id, code, status, plan')
    .eq('id', id)
    .or(`created_by.eq.${user.id},holder_id.eq.${user.id}`)
    .maybeSingle()
  if (!voucher || voucher.status !== 'active') notFound()

  const t = await getTranslations('voucherPrint')
  const site = (process.env.NEXT_PUBLIC_SITE_URL || SITE_URL).replace(/\/+$/, '')

  return (
    <div className="min-h-screen bg-[var(--paper)] px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <Link href="/wallet" className="text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
          ← {t('backToWallet')}
        </Link>
        <div className="mb-6 mt-2">
          <h1 className="text-2xl font-bold text-[var(--ink)]">{t('title')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{t('intro')}</p>
        </div>
        <VoucherPrintStudio codes={[voucher.code]} plan={voucher.plan === 'pro' ? 'pro' : 'base'} siteUrl={site} fileBase="KUMANI_voucher" />
      </div>
    </div>
  )
}
