import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, Store } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import SupplierArea from '@/components/convivio/SupplierArea'
import { getMySupplier, listConvivi } from '@/app/actions/convivio'
import { createClient } from '@/lib/supabase/server'

// Convivio → Area fornitore (professionisti Pro)
export default async function ConvivioSupplierPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('convivio')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [info, orders] = await Promise.all([getMySupplier(), listConvivi('supplier')])

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/marketplace/convivio" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {t('backToList')}
          </Link>
          <div className="flex items-center gap-2">
            <Store className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">{t('supplierArea')}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 max-w-2xl">
          <h1 className="text-3xl font-bold text-[var(--ink)]">{t('supplierArea')}</h1>
          <p className="mt-2 text-[var(--muted)]">{t('supplierAreaIntro')}</p>
        </div>
        <SupplierArea info={info ?? { is_pro: false, supplier: null, prefill: null }} userId={user.id} orders={orders} />
      </main>
    </div>
  )
}
