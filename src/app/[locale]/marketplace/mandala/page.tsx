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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[var(--gold-pale)]">
      <header className="sticky top-0 z-10 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-[var(--gold-bright)]"><ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}</Link>
          <div className="flex items-center gap-2"><Flower2 className="h-5 w-5 text-[var(--gold-bright)]" /><span className="font-semibold tracking-wide">Mandala KUMANI</span></div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto mb-10 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-4 py-1.5 text-sm font-semibold text-[var(--ink)] shadow-sm"><Sparkles className="h-4 w-4 text-[var(--gold)]" /> {t('eyebrow')}</div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">Mandala KUMANI</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600 sm:text-xl">{t('subtitle')}</p>
        </div>

        <MandalaCanvas referralUrl={referralUrl} />

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-[var(--gold)]/20 bg-white/80 p-5"><Flower2 className="mb-3 h-7 w-7 text-[var(--gold)]" /><h2 className="font-bold text-slate-900">{t('featureFlowTitle')}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{t('featureFlowDescription')}</p></div>
          <div className="rounded-2xl border border-[var(--gold)]/20 bg-white/80 p-5"><Share2 className="mb-3 h-7 w-7 text-[var(--gold)]" /><h2 className="font-bold text-slate-900">{t('featureShareTitle')}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{t('featureShareDescription')}</p></div>
        </div>

        <Link
          href="/marketplace/neurobalance"
          className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--gold)]/25 bg-[var(--ink)] p-5 text-white sm:flex-row"
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

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-5 text-slate-500">{t('disclaimer')}</p>
      </main>
    </div>
  )
}
