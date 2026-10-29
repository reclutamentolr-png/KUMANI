'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LoaderCircle } from 'lucide-react'
import { redeemActivationCode } from '@/app/actions/codes'
import { activationErrorText } from '@/lib/activationMessages'

// Attivazione di un codice pass (dalla pagina del servizio o dal Wallet).
// Il codice attiva il servizio per cui è stato creato, anche se diverso da
// quello della pagina. Accetta anche voucher (KV-/KVA-) e regali (GIFT-):
// stessa attivazione di «Hai un codice?».
export default function PassCodeForm({ tool, initialCode = '', compact = false }: { tool?: string; initialCode?: string; compact?: boolean }) {
  const t = useTranslations('toolPass')
  const td = useTranslations('dashboard')
  const tg = useTranslations('gifts')
  const locale = useLocale()
  const router = useRouter()
  const [code, setCode] = useState(initialCode)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return
    setBusy(true)
    setMessage(null)
    const result = await redeemActivationCode(code).catch(() => ({ success: false, kind: 'pass' as const, reason: 'error', expiresAt: null, subscription: false, tool: null }))
    setBusy(false)
    if (!result.success) {
      setMessage({ ok: false, text: activationErrorText(result, code.trim().toUpperCase(), td, tg) })
      return
    }
    const date = result.expiresAt ? new Date(result.expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    const text = result.subscription
      ? td('activateVoucherSuccess', { date })
      : !tool || result.tool === tool
        ? t('codeDone', { date })
        : t('codeDoneOther', { date })
    setMessage({ ok: true, text })
    setCode('')
    router.refresh()
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {!compact && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="PASS-XXXX-XXXX"
            aria-label={t('codeTitle')}
            className="w-full rounded-lg border border-[var(--gold)]/40 px-3 py-2.5 font-mono text-sm uppercase tracking-wider focus:border-[var(--gold)] focus:outline-none sm:flex-1"
          />
          <button type="submit" disabled={busy || !code.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--ink)] px-5 py-2.5 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-40">
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {t('codeButton')}
          </button>
        </div>
      )}
      {compact && (
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2 text-sm font-bold text-[var(--ink)] disabled:opacity-50"
        >
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {t('walletActivate')}
        </button>
      )}
      {message && <p className={`text-sm ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</p>}
    </form>
  )
}
