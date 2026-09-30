'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestWithdrawal } from '@/app/actions/withdrawals'

// Pulsante "Esercita il diritto di recesso" su /billing. I testi arrivano già
// tradotti dal server (/billing sceglie la lingua dal cookie).
export default function WithdrawalRequest({
  texts,
}: {
  texts: { reasonLabel: string; cta: string; confirm: string; confirmCta: string; cancel: string; sent: string; errors: Record<string, string> }
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)

  const submit = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const result = await requestWithdrawal(reason)
      if (result.success) {
        setOpen(false)
        setMessage({ ok: true, text: texts.sent })
        router.refresh()
      } else {
        setMessage({ ok: false, text: texts.errors[result.reason ?? 'error'] ?? texts.errors.error })
      }
    } catch {
      setMessage({ ok: false, text: texts.errors.error })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-3">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50"
        >
          {texts.cta}
        </button>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm text-gray-700">
            {texts.reasonLabel}
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm"
            />
          </label>
          <p className="text-sm font-semibold text-gray-800">{texts.confirm}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="flex-1 rounded-xl bg-red-600 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-red-700 disabled:opacity-50"
            >
              {texts.confirmCta}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-semibold text-gray-700 disabled:opacity-50"
            >
              {texts.cancel}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p
          role="status"
          className={`mt-3 rounded-lg p-3 text-sm ${message.ok ? 'border border-green-200 bg-green-50 text-green-800' : 'border border-amber-200 bg-amber-50 text-amber-800'}`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
