import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { ArrowLeft, VenetianMask } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import VeritasHome from '@/components/veritas/VeritasHome'
import { createClient } from '@/lib/supabase/server'

// Veritas — "Chi sta mentendo?": crea una stanza per giocare con gli amici.
export default async function VeritasPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('veritas')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)
  const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', user.id).maybeSingle()

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-[var(--gold-bright)]">
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <VenetianMask className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">Veritas</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="relative mb-10 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-center text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 left-10 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative mx-auto max-w-2xl">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Veritas</h1>
            <p className="mt-3 text-lg font-semibold text-[var(--gold-bright)]">{t('tagline')}</p>
            <p className="mt-3 text-white/70">{t('intro')}</p>
          </div>
        </div>

        <VeritasHome defaultNickname={profile?.first_name ?? ''} />

        <div className="mt-10 rounded-2xl border border-[var(--gold)]/25 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-bold text-[var(--ink)]">{t('howToPlay')}</h2>
          <ol className="space-y-2 text-sm leading-6 text-[var(--muted)]">
            <li>1. {t('rule1')}</li>
            <li>2. {t('rule2')}</li>
            <li>3. {t('rule3')}</li>
            <li>4. {t('rule4')}</li>
          </ol>
        </div>
      </main>
    </div>
  )
}
