import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import ToolBackLink from '@/components/ToolBackLink'
import { ArrowLeft, FileCheck2, Sparkles } from 'lucide-react'
import { hasActiveDigitalReceiptAccess } from '@/lib/digitalReceipt-server'
import DigitalReceiptDashboard from '@/components/DigitalReceiptDashboard'

export default async function DigitalReceiptPage() {
  const t = await getTranslations('digitalReceipt')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${await getLocale()}/login`)

  const hasAccess = await hasActiveDigitalReceiptAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${await getLocale()}/marketplace`)
  }

  const { data: receipts } = await supabase
    .from('digital_receipts')
    .select('id, template, object_name, recipient_name, delivery_date, confirmed_at, returned_at')
    .eq('user_id', user.id)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[var(--gold-pale)]">
      <header className="border-b border-[var(--gold)]/25 bg-[var(--ink)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <ToolBackLink
            className="flex items-center gap-2 text-white hover:text-[var(--gold-bright)] font-medium transition-colors"
            dashboardLabel={<><ArrowLeft className="w-5 h-5" /> {commonT('backToDashboard')}</>}
          >
            <ArrowLeft className="w-5 h-5" />
            {t('backToMarketplace')}
          </ToolBackLink>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-white">
            <FileCheck2 className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[var(--gold-pale)] text-[var(--ink)] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4 text-[var(--gold)]" />
            {t('badge')}
          </div>
          <h2 className="text-4xl font-bold text-gray-900 mb-3">{t('heroTitle')}</h2>
          <p className="text-gray-600 max-w-2xl mx-auto text-lg">{t('heroDescription')}</p>
        </div>

        <DigitalReceiptDashboard receipts={receipts || []} />
      </main>
    </div>
  )
}
