import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, QrCode } from 'lucide-react'
import { hasActiveQrProAccess } from '@/lib/qrPro-server'
import QrProForm from '@/components/QrProForm'
import { getMyBusinessProfile } from '@/lib/businessProfile-server'
import { getBrandFor } from '@/lib/brand-server'
import HubBar from '@/components/hubs/HubBar'

export default async function NewQrCodePage() {
  const t = await getTranslations('qrCodePro')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActiveQrProAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/dashboard')
  }

  const business = await getMyBusinessProfile(supabase, user.id)
  const brandInfo = await getBrandFor(supabase, user.id)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-3">
          <Link
            href="/app/qr-code-pro"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)] shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide min-w-0 text-right leading-tight">
            <QrCode className="h-5 w-5 text-[var(--gold-bright)] shrink-0" />
            {t('newCode')}
          </h1>
        </div>
      </header>
      <HubBar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <QrProForm mode="create" business={business} brand={brandInfo.colors} followBrand={!!brandInfo.follow.qr} />
      </main>
    </div>
  )
}
