import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { hasActiveAureyaAccess } from '@/lib/aureya-server'
import { ArrowLeft, AlertTriangle, Ear, Eye, Sparkles, Stethoscope } from 'lucide-react'
import AureyaHistoryDeleteButton from '@/components/AureyaHistoryDeleteButton'

interface ResultRow {
  id: string
  test_type: 'acoustic' | 'visual'
  score: number | null
  tested_at: string
}

export default async function AureyaPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const t = await getTranslations('aureya')
  const commonT = await getTranslations('common')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/${locale}/login`)

  const hasAccess = await hasActiveAureyaAccess(supabase, user.id)
  if (!hasAccess) {
    redirect(`/${locale}/marketplace`)
  }

  const { data: history } = await supabase
    .from('aureya_test_results')
    .select('id, test_type, score, tested_at')
    .eq('user_id', user.id)
    .order('tested_at', { ascending: false })
    .limit(20)
    .returns<ResultRow[]>()

  const results = history || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-[var(--gold-pale)]">
      <header className="sticky top-0 z-10 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-white transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">Aureya</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto mb-8 max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--gold)]/40 bg-[var(--gold-pale)] px-4 py-1.5 text-sm font-semibold text-[var(--ink)] shadow-sm">
            <Sparkles className="h-4 w-4 text-[var(--gold)]" /> {t('eyebrow')}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">{t('heroTitle')}</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600">{t('heroDescription')}</p>
        </div>

        <div className="mb-10 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-bold text-amber-900">{t('medicalDisclaimerTitle')}</h2>
            <p className="mt-1 text-sm leading-6 text-amber-800">{t('medicalDisclaimerBody')}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Link
            href="/marketplace/aureya/acustico"
            className="group rounded-2xl border border-[var(--gold)]/20 bg-white/80 p-6 shadow-sm transition-all hover:border-[var(--gold)]/50 hover:shadow-md"
          >
            <div className="mb-4 inline-flex rounded-2xl bg-[var(--ink)] p-3 text-white"><Ear className="h-7 w-7" /></div>
            <h2 className="text-xl font-bold text-slate-900">{t('acousticCardTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t('acousticCardDescription')}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-[var(--gold)] group-hover:underline">{t('acousticCardCta')} &rarr;</span>
          </Link>

          <Link
            href="/marketplace/aureya/visivo"
            className="group rounded-2xl border border-[var(--gold)]/20 bg-white/80 p-6 shadow-sm transition-all hover:border-[var(--gold)]/50 hover:shadow-md"
          >
            <div className="mb-4 inline-flex rounded-2xl bg-[var(--ink)] p-3 text-white"><Eye className="h-7 w-7" /></div>
            <h2 className="text-xl font-bold text-slate-900">{t('visualCardTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{t('visualCardDescription')}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-[var(--gold)] group-hover:underline">{t('visualCardCta')} &rarr;</span>
          </Link>
        </div>

        <div className="mt-12">
          <h2 className="mb-4 text-lg font-bold text-slate-900">{t('historyTitle')}</h2>
          {results.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white/60 p-6 text-sm text-slate-500">{t('historyEmpty')}</p>
          ) : (
            <ul className="divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white/80">
              {results.map((row) => {
                const isAcoustic = row.test_type === 'acoustic'
                const date = new Date(row.tested_at).toLocaleString()
                return (
                  <li key={row.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="flex items-center gap-3">
                      {isAcoustic ? <Ear className="h-4 w-4 text-[var(--gold)]" /> : <Eye className="h-4 w-4 text-[var(--gold)]" />}
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {isAcoustic ? t('historyAcousticLabel') : t('historyVisualLabel')}
                        </p>
                        <p className="text-xs text-slate-500">{date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {row.score ?? '—'}
                      </span>
                      <AureyaHistoryDeleteButton id={row.id} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-5 text-slate-500">{t('footerDisclaimer')}</p>
      </main>
    </div>
  )
}
