import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import Link from '@/components/LocalizedLink'
import { hasActiveAureyaAccess } from '@/lib/aureya-server'
import { ArrowLeft, AlertTriangle, Ear, Eye, Grid3x3, Sparkles, Stethoscope } from 'lucide-react'
import AureyaHistoryDeleteButton from '@/components/AureyaHistoryDeleteButton'

interface ResultRow {
  id: string
  test_type: 'acoustic' | 'visual' | 'acuity' | 'amsler'
  score: number | null
  result: { eyes?: { marked?: number[] }[] } | null
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
    redirect(`/${locale}/dashboard`)
  }

  const { data: history } = await supabase
    .from('aureya_test_results')
    .select('id, test_type, score, tested_at, result')
    .eq('user_id', user.id)
    .order('tested_at', { ascending: false })
    .limit(20)
    .returns<ResultRow[]>()

  const results = history || []

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="sticky top-0 z-20 border-b border-[var(--gold)]/25 bg-[var(--ink)] text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:text-[var(--gold-bright)]"
          >
            <ArrowLeft className="h-5 w-5" /> {commonT('backToDashboard')}
          </Link>
          <div className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-[var(--gold-bright)]" />
            <span className="font-semibold tracking-wide">Aureya</span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl bg-[var(--ink)] p-6 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)] sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[var(--gold)]/25 bg-[var(--gold)]/10" />
          <div className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full border border-[var(--gold)]/15" />
          <div className="relative max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-medium text-[var(--gold-bright)]">
              <Sparkles className="h-4 w-4" /> {t('eyebrow')}
            </div>
            <h1 className="mb-3 text-3xl font-bold tracking-tight sm:text-4xl">{t('heroTitle')}</h1>
            <p className="text-base text-white/70 sm:text-lg">{t('heroDescription')}</p>
          </div>
        </div>

        <div className="mb-10 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
          <div>
            <h2 className="font-bold text-amber-900">{t('medicalDisclaimerTitle')}</h2>
            <p className="mt-1 text-sm leading-6 text-amber-800">{t('medicalDisclaimerBody')}</p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Link
            href="/marketplace/aureya/acustico"
            className="group rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6 shadow-sm transition-all hover:border-[var(--gold)]/60 hover:shadow-md"
          >
            <div className="mb-4 inline-flex rounded-2xl bg-[var(--ink)] p-3 text-[var(--gold-bright)]"><Ear className="h-7 w-7" /></div>
            <h2 className="text-xl font-bold text-[var(--ink)]">{t('acousticCardTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('acousticCardDescription')}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-[var(--gold)] group-hover:underline">{t('acousticCardCta')} &rarr;</span>
          </Link>

          <Link
            href="/marketplace/aureya/acuita"
            className="group rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6 shadow-sm transition-all hover:border-[var(--gold)]/60 hover:shadow-md"
          >
            <div className="mb-4 inline-flex rounded-2xl bg-[var(--ink)] p-3 text-[var(--gold-bright)]"><Eye className="h-7 w-7" /></div>
            <h2 className="text-xl font-bold text-[var(--ink)]">{t('acuityCardTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('acuityCardDescription')}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-[var(--gold)] group-hover:underline">{t('acuityCardCta')} &rarr;</span>
          </Link>
          <Link
            href="/marketplace/aureya/amsler"
            className="group rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6 shadow-sm transition-all hover:border-[var(--gold)]/60 hover:shadow-md"
          >
            <div className="mb-4 inline-flex rounded-2xl bg-[var(--ink)] p-3 text-[var(--gold-bright)]"><Grid3x3 className="h-7 w-7" /></div>
            <h2 className="text-xl font-bold text-[var(--ink)]">{t('amslerCardTitle')}</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('amslerCardDescription')}</p>
            <span className="mt-4 inline-block text-sm font-semibold text-[var(--gold)] group-hover:underline">{t('amslerCardCta')} &rarr;</span>
          </Link>
        </div>

        <div className="mt-12">
          <h2 className="mb-4 text-lg font-bold text-[var(--ink)]">{t('historyTitle')}</h2>
          {results.length === 0 ? (
            <p className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] p-6 text-sm text-[var(--muted)]">{t('historyEmpty')}</p>
          ) : (
            <ul className="divide-y divide-[var(--gold)]/15 overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-[var(--paper)] shadow-sm">
              {results.map((row) => {
                const date = new Date(row.tested_at).toLocaleString()
                const Icon = row.test_type === 'acoustic' ? Ear : row.test_type === 'amsler' ? Grid3x3 : Eye
                const label =
                  row.test_type === 'acoustic'
                    ? t('historyAcousticLabel')
                    : row.test_type === 'acuity'
                      ? t('historyAcuityLabel')
                      : row.test_type === 'amsler'
                        ? t('historyAmslerLabel')
                        : t('historyVisualLabel')
                // Amsler: niente punteggio, si mostrano le zone segnate
                const zones = (row.result?.eyes ?? []).reduce((acc, e) => acc + (e.marked?.length ?? 0), 0)
                const badge = row.test_type === 'amsler' ? (zones === 0 ? t('historyAmslerOk') : t('historyAmslerZones', { count: zones })) : (row.score ?? '—')
                return (
                  <li key={row.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-[var(--gold)]" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--ink)]">
                          {label}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-[var(--gold)]/30 bg-[var(--gold-pale)] px-3 py-1 text-xs font-semibold text-[var(--ink)]">
                        {badge}
                      </span>
                      <AureyaHistoryDeleteButton id={row.id} />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-xs leading-5 text-[var(--muted)]">{t('footerDisclaimer')}</p>
      </main>
    </div>
  )
}
