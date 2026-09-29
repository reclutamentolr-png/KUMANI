import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { QrCode, ArrowLeft, PlusCircle, Sparkles } from 'lucide-react'
import { hasActiveQrProAccess } from '@/lib/qrPro-server'
import QrProCodeCard from '@/components/QrProCodeCard'

export default async function QrCodeProPage() {
  const t = await getTranslations('qrCodePro')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const hasAccess = await hasActiveQrProAccess(supabase, user.id)
  if (!hasAccess) {
    redirect('/dashboard')
  }

  const { data: qrCodes } = await supabase
    .from('qr_pro_codes')
    .select('id, label, content_type, click_count, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="w-5 h-5" />
            {commonT('backToDashboard')}
          </Link>
          <h1 className="flex items-center gap-2 font-semibold tracking-wide">
            <QrCode className="h-5 w-5 text-[var(--gold-bright)]" />
            {t('title')}
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 bg-[var(--gold)]/15 text-[var(--gold-bright)] px-4 py-1.5 rounded-full text-sm font-medium mb-4">
                <Sparkles className="w-4 h-4" />
                {t('badge')}
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t('heroTitle')}</h2>
              <p className="text-white/70 text-base sm:text-lg">{t('heroDescription')}</p>
            </div>
            <Link
              href="/marketplace/qr-code-pro/new"
              className="flex shrink-0 items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)] rounded-xl font-bold shadow-md hover:brightness-105 transition-all"
            >
              <PlusCircle className="w-5 h-5" />
              {t('newCode')}
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          <QrCode className="h-5 w-5 text-[var(--gold)]" />
          <h3 className="text-xl font-bold text-[var(--ink)]">{t('myCodes')}</h3>
        </div>

        {qrCodes && qrCodes.length > 0 ? (
          <div className="space-y-4">
            {qrCodes.map((qrCode) => (
              <QrProCodeCard key={qrCode.id} qrCode={qrCode} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16 rounded-2xl border border-dashed border-[var(--gold)]/40 bg-white text-[var(--muted)]">
            <QrCode className="w-12 h-12 mx-auto mb-4 text-[var(--gold)]" />
            <p>{t('noCodesYet')}</p>
          </div>
        )}
      </main>
    </div>
  )
}
