import { SITE_URL } from '@/lib/siteUrl'
import { createClient } from '@/lib/supabase/server'
import { getTranslations } from 'next-intl/server'
import { redirect } from 'next/navigation'
import MandalaCanvas from '@/components/MandalaCanvas'
import Link from '@/components/LocalizedLink'
import { ArrowLeft, ArrowRight, Flower2, Share2, Sparkles, Waves } from 'lucide-react'

export default async function MandalaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('mandala')
  const commonT = await getTranslations('common')
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const { data: profile } = await supabase.from('profiles').select('referral_code').eq('id', user.id).single()
  const baseUrl = SITE_URL
  const referralUrl = profile?.referral_code ? `${baseUrl}/${locale}/ref/${profile.referral_code}` : `${baseUrl}/${locale}`

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"><ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}</Link>
          <div className="flex items-center gap-2"><Flower2 className="h-5 w-5 text-[var(--gold-bright)]" /><span className="font-semibold tracking-wide">Mandala KUMANI</span></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]"><Sparkles className="h-4 w-4" /> {t('eyebrow')}</div>
            <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">Mandala KUMANI</h1>
            <p className="text-base text-white/70 sm:text-lg">{t('subtitle')}</p>
          </div>
        </div>

        <MandalaCanvas referralUrl={referralUrl} />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-5 shadow-sm"><Flower2 className="mb-3 h-7 w-7 text-[var(--gold)]" /><h2 className="font-bold text-[var(--ink)]">{t('featureFlowTitle')}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('featureFlowDescription')}</p></div>
          <div className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-5 shadow-sm"><Share2 className="mb-3 h-7 w-7 text-[var(--gold)]" /><h2 className="font-bold text-[var(--ink)]">{t('featureShareTitle')}</h2><p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t('featureShareDescription')}</p></div>
        </div>

        <Link
          href="/marketplace/neurobalance"
          className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--gold)]/25 bg-[var(--ink)] p-5 text-white shadow-md transition-colors hover:border-[var(--gold)]/60 sm:flex-row"
        >
          <div className="flex items-center gap-3">
            <Waves className="h-7 w-7 shrink-0 text-[var(--gold-bright)]" />
            <div>
              <h2 className="font-bold">{t('crossLinkTitle')}</h2>
              <p className="mt-1 text-sm leading-6 text-white/70">{t('crossLinkBody')}</p>
            </div>
          </div>
          <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2 text-sm font-bold text-[var(--ink)]">
            {t('crossLinkButton')} <ArrowRight className="h-4 w-4" />
          </span>
        </Link>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-[var(--muted)]">{t('disclaimer')}</p>
      </main>
    </div>
  )
}
