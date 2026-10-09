import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { ArrowLeft, CalendarHeart, Gift, Heart, LogIn, Route, Sparkles, UserPlus } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { createClient } from '@/lib/supabase/server'
import { getSurprisePrices } from '@/lib/surpriseServer'
import { SURPRISE_KINDS, type SurpriseKind } from '@/lib/surprise'
import NewSurpriseButton from '@/components/surprise/NewSurpriseButton'
import TemplatePicker from '@/components/surprise/TemplatePicker'
import { pageMetadata } from '@/lib/seo'

// KUMANI Sorpresa: presentazione e prezzi. Chi non è iscritto (anche chi ha
// appena ricevuto una sorpresa) vede «Registrati gratis e crea la tua»; chi è
// iscritto crea le sorprese e vede le sue (bozze e attive).
export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  setRequestLocale((await params).locale)
  const t = await getTranslations('surprise')
  return pageMetadata('/sorprese', {
    title: t('metaTitle'),
    description: t('metaDescription'),
  })
}

const ICON: Record<SurpriseKind, typeof Gift> = {
  voucher: Gift,
  journey3: Route,
  journey7: CalendarHeart,
}

export default async function SurprisesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('surprise')
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [prices, { data: gifts }] = await Promise.all([
    getSurprisePrices(),
    user
      ? supabase
          .from('surprise_gifts')
          .select('id, kind, status, title, recipient_name, opened_at, refunded_at, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: null }),
  ])
  const money = (cents: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100)
  const date = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })

  return (
    <div className="min-h-screen bg-[var(--background)] pb-24">
      <div className="bg-gradient-to-br from-[var(--ink)] to-[#2b2110] px-4 pb-10 pt-6 text-white">
        <div className="mx-auto max-w-3xl">
          {user ? (
            <Link href="/wallet" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
              <ArrowLeft className="h-4 w-4" /> {t('backWallet')}
            </Link>
          ) : (
            <Link href="/" className="text-sm font-bold tracking-[0.3em] text-[var(--gold-bright)]">
              KUMANI
            </Link>
          )}
          <h1 className="mt-4 flex items-center gap-3 text-3xl font-bold sm:text-4xl">
            <Sparkles className="h-8 w-8 text-[var(--gold-bright)]" /> {t('title')}
          </h1>
          <p className="mt-2 max-w-2xl text-white/80">{t('intro')}</p>
          <ol className="mt-5 grid gap-2 text-sm text-white/85 sm:grid-cols-3">
            {(['how1', 'how2', 'how3'] as const).map((k, i) => (
              <li key={k} className="rounded-xl bg-white/10 px-3 py-2">
                <span className="font-bold text-[var(--gold-bright)]">{i + 1}.</span> {t(k)}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mx-auto -mt-6 max-w-3xl px-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {SURPRISE_KINDS.map((kind) => {
            const Icon = ICON[kind]
            return (
              <div key={kind} className="rounded-2xl border border-[var(--gold)]/30 bg-white p-4 shadow-sm">
                <Icon className="h-6 w-6 text-[var(--gold)]" />
                <p className="mt-2 font-bold text-[var(--ink)]">{t(`kind_${kind}`)}</p>
                <p className="mt-1 text-sm text-[var(--muted)]">{t(`kind_${kind}_desc`)}</p>
                <p className="mt-2 text-lg font-bold text-[var(--ink)]">{money(prices[kind])}</p>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-center text-sm text-[var(--muted)]">{t('freeUntilPay')}</p>

        {!user ? (
          <>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-7 py-3.5 text-lg font-bold text-[var(--ink)] shadow-lg hover:brightness-110"
              >
                <UserPlus className="h-5 w-5" /> {t('publicCta')}
              </Link>
              <Link
                href="/login?next=/sorprese"
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 font-semibold text-[var(--ink)] hover:border-[var(--gold)]"
              >
                <LogIn className="h-4 w-4" /> {t('publicLogin')}
              </Link>
            </div>
            <h2 className="mt-10 text-xl font-bold text-[var(--ink)]">{t('examplesTitle')}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-3">
              {(['example1', 'example2', 'example3'] as const).map((k) => (
                <li key={k} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 text-sm text-[var(--ink)] shadow-sm">
                  <Heart className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" /> {t(k)}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="mt-8">
              <TemplatePicker prices={prices} />
            </div>
            <div className="mt-6 flex flex-col items-center gap-2">
              <p className="text-sm text-[var(--muted)]">{t('orFromScratch')}</p>
              <NewSurpriseButton />
            </div>

            <h2 className="mt-10 text-xl font-bold text-[var(--ink)]">{t('myTitle')}</h2>
            {!gifts?.length ? (
              <p className="mt-3 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-[var(--muted)]">{t('empty')}</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {gifts.map((g) => (
                  <li key={g.id}>
                    <Link href={`/sorprese/${g.id}`} className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 hover:border-[var(--gold)]">
                      <Gift className="h-5 w-5 shrink-0 text-[var(--gold)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-[var(--ink)]">{g.title || t('untitled')}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">
                          {g.recipient_name ? `${t('forName', { name: g.recipient_name })} · ` : ''}
                          {t(`kind_${g.kind as SurpriseKind}`)} · {date(g.created_at)}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                          g.refunded_at
                            ? 'bg-gray-100 text-gray-600'
                            : g.status === 'draft'
                              ? 'bg-amber-100 text-amber-800'
                              : g.opened_at
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-sky-100 text-sky-800'
                        }`}
                      >
                        {g.refunded_at ? t('status_refunded') : g.status === 'draft' ? t('status_draft') : g.opened_at ? t('status_opened') : t('status_active')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
