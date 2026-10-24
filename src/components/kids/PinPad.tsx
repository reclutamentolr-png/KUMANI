'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Delete, Lock } from 'lucide-react'

// Tastierino del codice genitore (4 cifre). Dopo 5 errori si aspetta 30 secondi.
export default function PinPad({
  title,
  subtitle,
  error,
  onComplete,
  onCancel,
  footer,
}: {
  title: string
  subtitle?: string
  error?: string | null
  onComplete: (pin: string) => void | Promise<void>
  onCancel?: () => void
  footer?: React.ReactNode
}) {
  const t = useTranslations('kids')
  const [pin, setPin] = useState('')
  const [busy, setBusy] = useState(false)

  const press = async (digit: string) => {
    if (busy || pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    if (next.length === 4) {
      setBusy(true)
      try {
        await onComplete(next)
      } finally {
        setBusy(false)
        setPin('')
      }
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#2B2D52] text-white">
        <Lock className="h-7 w-7" aria-hidden />
      </div>
      <div>
        <h2 className="text-2xl font-extrabold text-[#2B2D52]">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[#61648A]">{subtitle}</p>}
      </div>
      <div className="flex gap-3" aria-label={t('pinDigits', { count: pin.length })}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-5 w-5 rounded-full border-[3px] border-[#2B2D52] ${i < pin.length ? 'bg-[#2B2D52]' : 'bg-white'}`} />
        ))}
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-700" role="alert">{error}</p>}
      <div className="grid w-full grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className="h-16 rounded-2xl border-[3px] border-[#2B2D52] bg-white text-2xl font-extrabold text-[#2B2D52] shadow-[3px_3px_0_#2B2D52] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
            {d}
          </button>
        ))}
        {onCancel ? (
          <button type="button" onClick={onCancel} className="h-16 rounded-2xl text-sm font-bold text-[#61648A]">
            {t('cancel')}
          </button>
        ) : (
          <span />
        )}
        <button type="button" onClick={() => press('0')} className="h-16 rounded-2xl border-[3px] border-[#2B2D52] bg-white text-2xl font-extrabold text-[#2B2D52] shadow-[3px_3px_0_#2B2D52] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none">
          0
        </button>
        <button type="button" onClick={() => setPin((p) => p.slice(0, -1))} aria-label={t('pinDelete')} className="flex h-16 items-center justify-center rounded-2xl text-[#2B2D52]">
          <Delete className="h-7 w-7" />
        </button>
      </div>
      {footer}
    </div>
  )
}
