import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, FileCheck2 } from 'lucide-react'
import { hasActiveDigitalReceiptAccess } from '@/lib/digitalReceipt-server'
import DigitalReceiptForm from '@/components/DigitalReceiptForm'

export default async function NewDigitalReceiptPage() {
  const t = await getTranslations('digitalReceipt')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  const hasAccess = await hasActiveDigitalReceiptAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${await getLocale()}/marketplace`)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[var(--gold-pale)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/marketplace/digital-receipt"
            className="flex items-center gap-2 text-white hover:text-[var(--gold-bright)] font-medium transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            {t('title')}
          </Link>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <FileCheck2 className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('newReceipt')}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <DigitalReceiptForm />
      </main>
    </div>
  )
}
