'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { AlertTriangle, BadgeCheck, CheckCircle2, Circle, ExternalLink, Hourglass, LoaderCircle, RefreshCw, Unlink, XCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { askConfirm } from '@/lib/confirm'
import { disconnectStripe, startStripeOnboarding, type SellerPaymentsDetail } from '@/app/actions/shop'

// KUMANI Shop → Pagamenti: guida al collegamento del conto Stripe in 4 passi
// (Scheda attività, cosa preparare, collegamento, verifica) con quello che
// manca letto da Stripe in tempo reale e i pulsanti per completarlo.

const STRIPE_STEPS = ['account', 'security', 'business', 'owner', 'bank', 'review'] as const
const PREPARE = ['id', 'iban', 'tax', 'phone', 'time'] as const

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="flex items-center gap-3 text-base font-bold text-[var(--ink)]">
        {done ? (
          <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600" />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-sm text-white">{n}</span>
        )}
        {title}
      </h3>
      <div className="mt-3 space-y-3 pl-10 text-sm leading-relaxed text-gray-700">{children}</div>
    </section>
  )
}

export default function SellerPaymentsGuide({ detail }: { detail: SellerPaymentsDetail }) {
  const t = useTranslations('shopPay')
  const ts = useTranslations('shopSeller')
  const locale = useLocale()
  const router = useRouter()
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState<'connect' | 'refresh' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const active = detail.chargesEnabled
  const state = !detail.connected ? 'none' : active ? 'active' : detail.blocked === 'rejected' ? 'rejected' : detail.due.length || detail.errors.length ? 'missing' : detail.detailsSubmitted ? 'review' : 'incomplete'

  const connect = async () => {
    setBusy('connect')
    setError(null)
    const r = await startStripeOnboarding(detail.connected || terms, 'shop')
    if (r.success) {
      window.location.href = r.data.url
      return
    }
    setBusy(null)
    setError(ts.has(`error_${r.message}`) ? ts(`error_${r.message}`) : ts('error_stripeError'))
  }
  const refresh = () => {
    setBusy('refresh')
    router.refresh()
    setTimeout(() => setBusy(null), 2500)
  }
  const disconnect = async () => {
    if (!(await askConfirm(ts('disconnectConfirm'), { tone: 'warning' }))) return
    const r = await disconnectStripe()
    if (r.success) router.refresh()
  }

  const banner = {
    none: { icon: Circle, tone: 'border-gray-200 bg-white text-gray-800' },
    incomplete: { icon: Hourglass, tone: 'border-amber-300 bg-amber-50 text-amber-900' },
    missing: { icon: AlertTriangle, tone: 'border-amber-300 bg-amber-50 text-amber-900' },
    review: { icon: Hourglass, tone: 'border-sky-300 bg-sky-50 text-sky-900' },
    active: { icon: BadgeCheck, tone: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
    rejected: { icon: XCircle, tone: 'border-red-300 bg-red-50 text-red-900' },
  }[state]
  const BannerIcon = banner.icon

  return (
    <div className="space-y-4">
      <div className={`flex items-start gap-3 rounded-2xl border p-4 ${banner.tone}`}>
        <BannerIcon className="mt-0.5 h-6 w-6 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-bold">{t(`state_${state}`)}</p>
          <p className="text-sm opacity-90">{t(`stateText_${state}`)}</p>
          {detail.testMode && <p className="mt-1 inline-block rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">{t('testMode')}</p>}
        </div>
        {detail.connected && (
          <button type="button" onClick={refresh} disabled={busy !== null} aria-label={t('refresh')} title={t('refresh')} className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-white/60 disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      <Step n={1} title={t('step1Title')} done={detail.profileReady}>
        <p>{detail.profileReady ? t('step1Done') : t('step1Text')}</p>
        {!detail.profileReady && (
          <>
            <ul className="list-disc space-y-1 pl-5">
              {detail.missingProfile.map((f) => (
                <li key={f}>{t(`profile_${f}`)}</li>
              ))}
            </ul>
            <Link href="/scheda-attivita" className="inline-flex min-h-11 items-center rounded-xl bg-[var(--ink)] px-4 font-bold text-white">
              {t('step1Cta')}
            </Link>
          </>
        )}
      </Step>

      {!active && (
        <Step n={2} title={t('step2Title')} done={false}>
          <p>{t('step2Text')}</p>
          <ul className="list-disc space-y-1 pl-5">
            {PREPARE.map((k) => (
              <li key={k}>{t(`prepare_${k}`)}</li>
            ))}
          </ul>
        </Step>
      )}

      <Step n={3} title={t('step3Title')} done={detail.connected && detail.detailsSubmitted}>
        {!detail.connected || !detail.detailsSubmitted ? (
          <>
            <p>{t('step3Text')}</p>
            <ol className="list-decimal space-y-1.5 pl-5">
              {STRIPE_STEPS.map((k) => (
                <li key={k}>
                  <span className="font-semibold text-[var(--ink)]">{t(`stripe_${k}_title`)}</span> — {t(`stripe_${k}_text`)}
                </li>
              ))}
            </ol>
            <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">{t('step3Tip')}</p>
            {!detail.connected && (
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--ink)]" />
                <span>{ts('termsLabel')}</span>
              </label>
            )}
            <button
              type="button"
              onClick={connect}
              disabled={busy !== null || !detail.profileReady || (!detail.connected && !terms)}
              className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 font-bold text-[var(--ink)] shadow disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy === 'connect' && <LoaderCircle className="h-4 w-4 animate-spin" />} {detail.connected ? ts('continueButton') : ts('connectButton')}
            </button>
            {!detail.profileReady && <p className="text-xs text-amber-700">{t('step3NeedsProfile')}</p>}
          </>
        ) : (
          <p>{t('step3Done')}</p>
        )}
      </Step>

      {detail.connected && (
        <Step n={4} title={t('step4Title')} done={active}>
          {active ? (
            <p>{t('step4Active')}</p>
          ) : (
            <>
              {detail.pendingVerification && <p className="flex items-start gap-2"><Hourglass className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" /> {t('pending')}</p>}
              {detail.due.length > 0 && (
                <>
                  <p className="font-semibold text-[var(--ink)]">{t('dueTitle')}</p>
                  <ul className="space-y-1.5">
                    {detail.due.map((d) => (
                      <li key={d.group} className="flex items-start gap-2">
                        <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${d.pastDue ? 'text-red-600' : 'text-amber-600'}`} />
                        <span>
                          {t(`req_${d.group}`)}
                          {d.pastDue && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{t('pastDue')}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {detail.errors.length > 0 && (
                <>
                  <p className="font-semibold text-[var(--ink)]">{t('errorsTitle')}</p>
                  <ul className="space-y-1.5">
                    {detail.errors.map((e, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                        <span>
                          {t(`req_${e.group}`)}
                          <span className="block text-xs text-gray-500">{e.reason}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {detail.deadline && <p className="text-xs text-gray-600">{t('deadline', { date: new Date(detail.deadline).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) })}</p>}
              {(detail.due.length > 0 || detail.errors.length > 0) && (
                <button type="button" onClick={connect} disabled={busy !== null} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[var(--ink)] px-5 font-bold text-white disabled:opacity-50">
                  {busy === 'connect' && <LoaderCircle className="h-4 w-4 animate-spin" />} {ts('continueButton')}
                </button>
              )}
            </>
          )}
        </Step>
      )}

      {active && (
        <section className="space-y-2 rounded-2xl border border-[var(--gold)]/30 bg-[var(--gold-pale)]/40 p-5 text-sm leading-relaxed text-gray-700">
          <h3 className="text-base font-bold text-[var(--ink)]">{t('afterTitle')}</h3>
          <p>{t('afterPayouts')}</p>
          <p>{t('afterRefunds')}</p>
          <p>{t('afterFees')}</p>
          <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-semibold text-[var(--ink)] underline">
            <ExternalLink className="h-4 w-4" /> {t('openStripe')}
          </a>
        </section>
      )}

      {error && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{error}</p>}
      {detail.connected && (
        <button type="button" onClick={disconnect} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-600">
          <Unlink className="h-4 w-4" /> {ts('disconnectButton')}
        </button>
      )}
    </div>
  )
}
