'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowRight, Heart, HeartHandshake, LoaderCircle, Sparkles, User } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { donateNetworkPoints } from '@/app/actions/donations'
import { euroFormat, type DonationSummary, type MyDonations } from '@/lib/donationTypes'

// Portafoglio → Donazioni: l'associazione sostenuta (fascia con foto), le
// cifre in evidenza (community, versato, il tuo contributo), la donazione dei
// propri KU Points con importi rapidi e il proprio resoconto.
export default function WalletDonations({
  summary,
  mine,
  networkPoints,
}: {
  summary: DonationSummary
  mine: MyDonations | null
  networkPoints: number
}) {
  const t = useTranslations('donations')
  const locale = useLocale()
  const router = useRouter()
  const eur = (cents: number) => euroFormat(locale, cents)
  const active = summary.active!
  const [points, setPoints] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const value = summary.point_value_cents
  const amount = Math.max(0, Math.floor(Number(points) || 0))
  const canDonate = value > 0 && amount >= 1 && amount <= networkPoints

  const donate = async () => {
    if (!canDonate) return
    if (!confirm(t('donateConfirm', { points: amount, amount: eur(amount * value), association: active.name }))) return
    setBusy(true)
    setMessage(null)
    const result = await donateNetworkPoints(amount)
    setBusy(false)
    if (!result.success) {
      const key = result.reason === 'insufficient_points' ? 'error_insufficient' : result.reason === 'disabled' ? 'error_disabled' : 'error_generic'
      setMessage({ ok: false, text: t(key) })
      return
    }
    setPoints('')
    setMessage({ ok: true, text: t('donateDone', { amount: eur(result.amountCents), association: active.name }) })
    router.refresh()
  }

  // Il tuo contributo: quanto KUMANI ha donato per il tuo abbonamento più i
  // KU Points che hai donato tu
  const myImpact = (mine?.subscription_cents ?? 0) + (mine?.total_cents ?? 0)
  const quick = [10, 50, 100].filter((n) => n <= networkPoints)
  const chip = (selected: boolean) =>
    `rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${selected ? 'border-[var(--gold)] bg-[var(--gold)] text-[var(--ink)]' : 'border-[var(--gold)]/40 text-[var(--ink)] hover:bg-[var(--gold-pale)]'}`

  return (
    <div className="space-y-5">
      {/* Associazione: fascia scura con la foto del cuore */}
      <div className="relative overflow-hidden rounded-2xl bg-[var(--ink)] text-white shadow-[0_14px_34px_rgba(23,23,23,0.25)]">
        <Image src="/home/donation-heart.webp" alt="" fill sizes="(min-width: 768px) 700px, 100vw" className="object-cover opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--ink)] via-[var(--ink)]/85 to-[var(--ink)]/40" />
        <div className="relative flex items-start gap-4 p-5 sm:p-6">
          {active.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={active.logo_url} alt="" className="h-14 w-14 shrink-0 rounded-xl bg-white object-contain p-1.5" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/95">
              <HeartHandshake className="h-7 w-7 text-[var(--gold)]" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight">{active.name}</p>
            {active.mission && <p className="mt-1 text-sm text-white/80">{active.mission}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-[var(--gold)]/25 px-3 py-1 text-xs font-bold text-[var(--gold-bright)]">{t('pledgeChipBase', { amount: eur(summary.base_cents) })}</span>
              <span className="rounded-full bg-[var(--gold)]/25 px-3 py-1 text-xs font-bold text-[var(--gold-bright)]">{t('pledgeChipPro', { amount: eur(summary.pro_cents) })}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Le cifre, in evidenza */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--gold)]/40 bg-gradient-to-br from-[var(--gold-pale)] to-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            <Heart className="h-3.5 w-3.5 text-[var(--gold)]" fill="currentColor" /> {t('accruedLabel')}
          </p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--gold)]">{eur(summary.accrued_cents)}</p>
          <p className="text-xs text-[var(--muted)]">{t('accruedHint')}</p>
        </div>
        <div className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            <HeartHandshake className="h-3.5 w-3.5 text-[var(--gold)]" /> {t('paidLabel')}
          </p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--ink)]">{eur(summary.paid_cents)}</p>
          <p className="text-xs text-[var(--muted)]">{t('paidHint')}</p>
        </div>
        <div className="col-span-2 rounded-2xl bg-[var(--ink)] p-4 text-white sm:col-span-1">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/60">
            <User className="h-3.5 w-3.5 text-[var(--gold-bright)]" /> {t('yourImpactLabel')}
          </p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--gold-bright)]">{eur(myImpact)}</p>
          <p className="text-xs text-white/60">{t('yourImpactHint')}</p>
        </div>
      </div>

      {/* Dona i tuoi punti */}
      {value > 0 && (
        <div className="rounded-2xl border border-[var(--gold)]/30 bg-white p-4 sm:p-5">
          <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
            <Sparkles className="h-4 w-4 text-[var(--gold)]" /> {t('donateTitle')}
          </p>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{t('donateHint', { value: eur(value * 10) })}</p>
          {networkPoints > 0 ? (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {quick.map((n) => (
                  <button key={n} type="button" onClick={() => setPoints(String(n))} className={chip(amount === n)}>
                    {n}
                  </button>
                ))}
                <button type="button" onClick={() => setPoints(String(networkPoints))} className={chip(amount === networkPoints)}>
                  {t('donateAll', { points: networkPoints })}
                </button>
              </div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <input
                  type="number"
                  min={1}
                  max={networkPoints}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder={t('donatePlaceholder')}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[var(--gold)] focus:outline-none sm:w-40"
                />
                <button
                  type="button"
                  onClick={donate}
                  disabled={!canDonate || busy}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-2.5 text-sm font-extrabold text-[var(--ink)] shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Heart className="h-4 w-4" fill="currentColor" />}
                  {t('donateButton', { amount: eur(amount * value) })}
                </button>
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">{t('availablePoints', { points: networkPoints })}</p>
            </>
          ) : (
            <p className="mt-3 rounded-xl bg-[var(--gold-pale)]/60 px-3 py-2.5 text-sm text-[var(--ink)]">{t('noPointsYet')}</p>
          )}
          {message && <p className={`mt-2 text-sm ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>{message.text}</p>}
        </div>
      )}

      {/* Il tuo resoconto */}
      <div>
        <p className="text-sm font-bold text-[var(--ink)]">{t('myTitle')}</p>
        {mine && mine.subscription_cents > 0 && (
          <p className="mt-1.5 flex items-center gap-2 text-sm text-[var(--ink)]">
            <Heart className="h-4 w-4 shrink-0 text-[var(--gold)]" fill="currentColor" /> {t('mySubscription', { amount: eur(mine.subscription_cents) })}
          </p>
        )}
        {mine && mine.total_points > 0 ? (
          <>
            <p className="mt-1.5 flex items-center gap-2 text-sm text-[var(--ink)]">
              <Sparkles className="h-4 w-4 shrink-0 text-[var(--gold)]" /> {t('myTotal', { points: mine.total_points, amount: eur(mine.total_cents) })}
            </p>
            <ul className="mt-2 space-y-1 pl-6 text-xs text-[var(--muted)]">
              {mine.items.slice(0, 5).map((item, i) => (
                <li key={i}>
                  {new Date(item.created_at).toLocaleDateString(locale)} · {item.points} → {eur(item.amount_cents)} · {item.association}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1.5 text-sm text-[var(--muted)]">{t('myNone')}</p>
        )}
      </div>

      <Link href="/donazioni" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
        {t('learnMore')} <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  )
}
