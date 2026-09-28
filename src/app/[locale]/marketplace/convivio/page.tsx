import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, HandPlatter } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ConvivioHome from '@/components/convivio/ConvivioHome'
import { getLeaderStatus, getMySupplier, listConvivi } from '@/app/actions/convivio'
import { createClient } from '@/lib/supabase/server'
import { SuspendedBanner } from '@/components/ServiceSuspended'
import { isToolOnline } from '@/lib/toolOnline'

// Kordata (Community): acquisti di gruppo proposti dai Kumani.
export default async function ConvivioPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('convivio')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const [open, mine, leader, supplier] = await Promise.all([listConvivi('open'), listConvivi('mine'), getLeaderStatus(), getMySupplier()])

  const online = await isToolOnline('convivio')

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <HandPlatter className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">Kordata</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {!online && <SuspendedBanner className="mb-6" />}
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <HandPlatter className="h-4 w-4" />
              {t('tagline')}
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Kordata</h1>
            <p className="mt-3 text-base text-white/70 sm:text-lg">{t('intro')}</p>
          </div>
        </div>
        <ConvivioHome open={open} mine={mine} leader={leader} isPro={!!supplier?.is_pro} />
      </main>
    </div>
  )
}
