import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Clock, ShieldCheck, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import Logo from '@/components/Logo'
import { getMarketplaceTools } from '@/lib/marketplaceTools'
import { getTrialCodeInfo, startTrial } from '@/app/actions/trials'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { robots: { index: false, follow: false } }

// Pagina del codice di prova (/prova/PR-XXXX-XXXX): spiega il servizio e la
// durata; con «Inizia la prova» il server crea l'accesso temporaneo da ospite.
export default async function TrialCodePage({ params, searchParams }: { params: Promise<{ locale: string; code: string }>; searchParams: Promise<{ e?: string }> }) {
  const { locale, code } = await params
  setRequestLocale(locale)
  const { e } = await searchParams
  const t = await getTranslations('trials')
  const tm = await getTranslations('marketplace')
  const info = await getTrialCodeInfo(decodeURIComponent(code))
  const tool = info.state === 'ok' ? getMarketplaceTools(tm).find((x) => x.toolName === info.tool) : undefined
  const duration = (m: number) => (m >= 1440 ? t('durationDays', { days: Math.round(m / 1440) }) : t('durationHours', { hours: Math.round(m / 60) }))
  const errors: Record<string, string> = { terms: t('errTerms'), loggedIn: t('errLoggedIn'), invalid: t('errInvalid'), error: t('errGeneric') }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--paper)] px-4 py-10">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[var(--gold)]/30 bg-white shadow-xl">
        <div className="bg-[var(--ink)] px-6 py-6 text-center text-white">
          <Logo size={56} className="mx-auto h-14 w-14" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gold-bright)]">{t('pageBadge')}</p>
        </div>
        <div className="space-y-5 p-6 sm:p-8">
          {info.state === 'ok' ? (
            <>
              <div className="text-center">
                <h1 className="text-2xl font-bold text-[var(--ink)]">{t('pageTitle', { tool: tool?.title ?? info.tool })}</h1>
                {info.inviter && <p className="mt-1 text-sm text-[var(--muted)]">{t('pageInvitedBy', { name: info.inviter })}</p>}
              </div>
              {tool?.description && <p className="text-center text-gray-700">{tool.description}</p>}
              <ul className="space-y-2 rounded-2xl bg-[var(--paper)] p-4 text-sm text-gray-700">
                <li className="flex gap-2">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('pagePoint1', { duration: duration(info.durationMinutes) })}
                </li>
                <li className="flex gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('pagePoint2')}
                </li>
                <li className="flex gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('pagePoint3')}
                </li>
              </ul>
              {e && errors[e] && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{errors[e]}</p>}
              <form action={startTrial} className="space-y-4">
                <input type="hidden" name="code" value={decodeURIComponent(code)} />
                <input type="hidden" name="locale" value={locale} />
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" name="terms" required className="mt-0.5 h-5 w-5 accent-[var(--gold)]" />
                  <span>
                    {t.rich('pageTerms', {
                      terms: (chunks) => (
                        <Link href="/terms" target="_blank" className="font-semibold text-[var(--gold)] underline">
                          {chunks}
                        </Link>
                      ),
                      privacy: (chunks) => (
                        <Link href="/privacy" target="_blank" className="font-semibold text-[var(--gold)] underline">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </span>
                </label>
                <button type="submit" className="w-full rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3.5 text-base font-bold text-[var(--ink)] shadow-md hover:brightness-105">
                  {t('pageStart')}
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-4 text-center">
              <h1 className="text-xl font-bold text-[var(--ink)]">{t(info.state === 'used' ? 'stateUsed' : info.state === 'expired' ? 'stateExpired' : 'stateMissing')}</h1>
              <p className="text-gray-600">{t('stateHint')}</p>
              <Link href="/" className="inline-block rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-[var(--gold-bright)]">
                {t('discover')}
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
