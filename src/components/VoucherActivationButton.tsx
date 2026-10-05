'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Ticket, LoaderCircle, X } from 'lucide-react'
import { redeemActivationCode } from '@/app/actions/codes'

// "Hai un codice?" in dashboard: un solo campo per voucher abbonamento
// (KV-/KVA-), codici Pass (PASS-) e regali (GIFT-), riconosciuti dal codice.
export default function VoucherActivationButton() {
  const t = useTranslations('dashboard')
  const tg = useTranslations('gifts')
  const locale = useLocale()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const close = () => {
    if (loading) return
    setOpen(false)
    setCode('')
    setMessage(null)
  }

  const handleRedeem = async () => {
    if (!code.trim()) return
    setLoading(true)
    setMessage(null)
    const result = await redeemActivationCode(code)
    setLoading(false)

    if (!result.success) {
      if (result.kind === 'gift') {
        setMessage({ type: 'error', text: tg(`redeem_${result.reason ?? 'error'}`) })
        return
      }
      const key =
        result.reason === 'already_used'
          ? 'activateVoucherErrorUsed'
          : result.reason === 'self_redemption'
            ? 'activateVoucherErrorSelf'
            : result.reason === 'not_found'
              ? 'activateVoucherErrorNotFound'
              : 'activateVoucherErrorGeneric'
      setMessage({ type: 'error', text: t(key) })
      return
    }

    const date = result.expiresAt ? new Date(result.expiresAt).toLocaleDateString(locale) : ''
    setMessage({
      type: 'success',
      text: result.kind === 'voucher' ? t('activateVoucherSuccess', { date }) : t('activateCodeSuccessService', { date }),
    })
    setTimeout(() => {
      setOpen(false)
      router.refresh()
    }, 1500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-[var(--gold)]/50 bg-white px-4 py-2.5 text-sm font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--gold-pale)]"
      >
        <Ticket className="mr-2 h-4 w-4" />
        {t('activateViaVoucher')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={close}>
          <div
            className="relative w-full max-w-sm rounded-2xl border border-[var(--gold)]/45 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={close} aria-label="Close" className="absolute right-4 top-4 text-gray-400 hover:text-gray-700">
              <X className="h-5 w-5" />
            </button>

            <h3 className="mb-2 text-lg font-bold text-[var(--ink)]">{t('activateViaVoucherTitle')}</h3>
            <p className="mb-4 text-sm text-[var(--muted)]">{t('activateViaVoucherIntro')}</p>

            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={t('activateVoucherPlaceholder')}
              disabled={loading}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm uppercase tracking-wider focus:border-[var(--gold)] focus:outline-none"
            />

            <button
              onClick={handleRedeem}
              disabled={loading || !code.trim()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--ink-soft)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {t('activateViaVoucherSubmit')}
            </button>

            {message && (
              <p className={`mt-3 text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {message.text}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
