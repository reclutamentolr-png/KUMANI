'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { CheckCircle2, Gift, LoaderCircle, Sparkles } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import ScaledVoucherFront from './ScaledVoucherFront'
import { redeemVoucher } from '@/app/actions/vouchers'
import type { VoucherDesign, VoucherPrintTexts } from '@/components/voucherPrint/VoucherPrintCard'

// Pagina del biglietto: grafica del voucher, frase, «per» e «da», e
// «Attiva il tuo voucher» (iscrizione con il codice già inserito, oppure
// attivazione diretta per chi ha già fatto l'accesso).
export default function VoucherCardView({
  code,
  plan,
  status,
  design,
  phrase,
  to,
  from,
  loggedIn,
  texts,
}: {
  code: string
  plan: 'base' | 'pro'
  status: 'active' | 'used'
  design: VoucherDesign
  phrase: string
  to: string
  from: string
  loggedIn: boolean
  texts: VoucherPrintTexts
}) {
  const t = useTranslations('voucherCard')
  const locale = useLocale()
  const planName = plan === 'pro' ? 'Pro' : 'Plus'
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const activate = async () => {
    setBusy(true)
    setError(null)
    const r = await redeemVoucher(code)
    setBusy(false)
    if (r.success) {
      setDone(new Date(r.expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }))
      return
    }
    setError(r.message === 'self_redemption' ? t('selfError') : r.message === 'already_used' ? t('used') : t('error'))
  }

  return (
    <div className="mx-auto w-full max-w-md text-center">
      <p className="inline-flex items-center gap-2 rounded-full bg-[var(--gold)]/15 px-4 py-1.5 text-sm font-semibold text-[var(--gold-bright)]">
        <Gift className="h-4 w-4" /> {t('pageTitle')}
      </p>
      {to && <h1 className="mt-4 font-serif text-3xl font-semibold text-[var(--gold-bright)]">{t('forName', { name: to })}</h1>}
      <div className="mt-5">
        <ScaledVoucherFront design={design} plan={plan} texts={texts} />
      </div>
      <p className="mt-6 font-serif text-xl italic leading-snug text-[#f5e8bd]">«{phrase}»</p>
      {from && <p className="mt-2 font-serif text-lg font-semibold text-[var(--gold-bright)]">{t('fromName', { name: from })}</p>}

      <div className="mt-7 rounded-2xl border border-[var(--gold)]/30 bg-white/[0.05] p-5 text-left">
        <p className="flex items-center gap-2 font-bold text-white">
          <Sparkles className="h-4 w-4 text-[var(--gold-bright)]" /> {t('planLine', { plan: planName })}
        </p>
        <p className="mt-1.5 text-sm leading-6 text-white/75">{t('whatIs')}</p>
        <p className="mt-3 text-xs text-white/60">
          {t('codeLabel')}: <span className="font-mono font-semibold tracking-wider text-white">{code}</span>
        </p>
      </div>

      <div className="mt-6">
        {done ? (
          <div className="rounded-2xl bg-emerald-500/15 p-5 text-emerald-200">
            <p className="flex items-center justify-center gap-2 font-bold">
              <CheckCircle2 className="h-5 w-5" /> {t('done', { plan: planName, date: done })}
            </p>
            <Link href="/dashboard" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 font-bold text-[var(--ink)]">
              {t('goHome')}
            </Link>
          </div>
        ) : status === 'used' ? (
          <div className="rounded-2xl bg-white/[0.06] p-5">
            <p className="font-semibold text-white">{t('used')}</p>
            {/* Riaperto dalla campanella: si torna alla Home (o al sito, senza accesso) */}
            <Link href={loggedIn ? '/dashboard' : '/'} className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 font-bold text-[var(--ink)]">
              {t('goHome')}
            </Link>
          </div>
        ) : loggedIn ? (
          <button
            type="button"
            onClick={activate}
            disabled={busy}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 text-lg font-extrabold text-[var(--ink)] shadow-xl disabled:opacity-60"
          >
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />} {t('activate')}
          </button>
        ) : (
          <>
            <Link
              href={`/register?voucher=${encodeURIComponent(code)}`}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 text-lg font-extrabold text-[var(--ink)] shadow-xl"
            >
              <Gift className="h-5 w-5" /> {t('activate')}
            </Link>
            <Link href={`/login?next=${encodeURIComponent(`/biglietto/${code}`)}`} className="mt-3 inline-block text-sm font-semibold text-[var(--gold-bright)] underline underline-offset-4">
              {t('haveAccount')}
            </Link>
          </>
        )}
        {error && <p className="mt-3 text-sm font-semibold text-red-300">{error}</p>}
      </div>
    </div>
  )
}
