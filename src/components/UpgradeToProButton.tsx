'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Crown, LoaderCircle } from 'lucide-react'
import { previewUpgradeToPro, upgradeToPro } from '@/app/actions/plans'

// "Passa a Pro" per chi ha già un abbonamento Base con carta: prima mostra
// l'importo esatto che Stripe addebiterà (la differenza), poi chiede conferma.
export default function UpgradeToProButton({ label, note }: { label: string; note: string }) {
  const t = useTranslations('plans')
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [preview, setPreview] = useState<{ amount: string; prorationDate: number } | null>(null)
  // Consenso all'avvio immediato, obbligatorio come nel checkout
  const [agreed, setAgreed] = useState(false)
  const tw = useTranslations('withdrawal')

  const showError = (reason?: string) => setMessage({ ok: false, text: t(`upgradeError_${reason ?? 'stripe_error'}`) })

  const askPreview = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await previewUpgradeToPro()
      if (result.success) {
        const amount = new Intl.NumberFormat(locale, { style: 'currency', currency: result.currency.toUpperCase() }).format(result.amountCents / 100)
        setPreview({ amount, prorationDate: result.prorationDate })
      } else {
        showError(result.reason)
      }
    } catch {
      showError()
    } finally {
      setBusy(false)
    }
  }

  const confirmUpgrade = async () => {
    if (!preview || !agreed) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await upgradeToPro(preview.prorationDate, agreed)
      if (result.success) {
        setPreview(null)
        setMessage({ ok: true, text: t('upgradeDone') })
        router.refresh()
      } else {
        showError(result.reason)
      }
    } catch {
      showError()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {preview ? (
        <div className="rounded-xl border border-[var(--gold)]/40 bg-[var(--gold)]/10 p-4">
          <p className="text-sm text-gray-300">{t('upgradeAmountLabel')}</p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--gold-bright)]">{preview.amount}</p>
          <p className="mt-2 text-xs text-gray-400">{t('upgradeAmountHint')}</p>
          <label className="mt-4 flex items-start gap-2 text-left text-xs leading-relaxed text-gray-300">
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--gold)]" />
            <span>{tw('consentLabel')}</span>
          </label>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={confirmUpgrade}
              disabled={busy || !agreed}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3 font-bold text-[var(--ink)] disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" />} {t('upgradeConfirmPay', { amount: preview.amount })}
            </button>
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                setAgreed(false)
              }}
              disabled={busy}
              className="rounded-xl border border-white/15 px-6 py-3 font-semibold text-gray-300 disabled:opacity-50"
            >
              {t('upgradeCancel')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={askPreview}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] disabled:opacity-50"
          >
            {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Crown className="h-5 w-5" />} {label}
          </button>
          <p className="mt-2 text-xs text-gray-400">{note}</p>
        </>
      )}
      {message && (
        <p
          role="status"
          className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${message.ok ? 'bg-green-500/15 text-green-300' : 'bg-amber-500/15 text-amber-200'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
