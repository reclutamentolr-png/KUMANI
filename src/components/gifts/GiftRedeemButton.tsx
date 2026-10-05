'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Gift, LoaderCircle } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { redeemGiftCode } from '@/app/actions/gifts'

// Attivazione del regalo per l'utente collegato (pagina /regalo/CODICE)
export default function GiftRedeemButton({ code, openHref }: { code: string; openHref: string }) {
  const t = useTranslations('gifts')
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const redeem = async () => {
    setBusy(true)
    setError(null)
    const result = await redeemGiftCode(code)
    setBusy(false)
    if (!result.success) {
      setError(t(`redeem_${result.reason ?? 'error'}`))
      return
    }
    const date = result.expiresAt ? new Date(result.expiresAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    setDone(t('redeemDone', { date }))
    router.refresh()
  }

  if (done) {
    return (
      <div className="mt-6 space-y-3">
        <p className="rounded-xl bg-emerald-500/15 px-4 py-3 text-center text-sm font-semibold text-emerald-200">{done}</p>
        <Link href={openHref} className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)]">
          {t('openGift')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={redeem}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Gift className="h-5 w-5" />}
        {t('redeemButton')}
      </button>
      {error && <p className="mt-3 rounded-xl bg-red-500/15 px-4 py-3 text-center text-sm text-red-200">{error}</p>}
    </div>
  )
}
