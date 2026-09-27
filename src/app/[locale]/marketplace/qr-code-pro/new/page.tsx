import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, QrCode } from 'lucide-react'
import { hasActiveQrProAccess } from '@/lib/qrPro-server'
import QrProForm from '@/components/QrProForm'

export default async function NewQrCodePage() {
  const t = await getTranslations('qrCodePro')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActiveQrProAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/marketplace')
  }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/marketplace/qr-code-pro"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <QrCode className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('newCode')}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <QrProForm mode="create" />
      </main>
    </div>
  )
}
