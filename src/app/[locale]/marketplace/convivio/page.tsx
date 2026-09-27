import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, HandPlatter } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ConvivioHome from '@/components/convivio/ConvivioHome'
import { getLeaderStatus, getMySupplier, listConvivi } from '@/app/actions/convivio'
import { createClient } from '@/lib/supabase/server'

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

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <HandPlatter className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">Kordata</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 max-w-2xl">
          <h1 className="text-3xl font-bold text-[var(--ink)] sm:text-4xl">Kordata</h1>
          <p className="mt-2 text-lg font-semibold text-[var(--gold)]">{t('tagline')}</p>
          <p className="mt-2 text-[var(--muted)]">{t('intro')}</p>
        </div>
        <ConvivioHome open={open} mine={mine} leader={leader} isPro={!!supplier?.is_pro} />
      </main>
    </div>
  )
}
