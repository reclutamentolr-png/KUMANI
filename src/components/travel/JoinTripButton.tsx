'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { LoaderCircle } from 'lucide-react'
import { joinTrip } from '@/app/actions/travel'

// "Unisciti al viaggio" dalla pagina dell'invito (utente già registrato).
export default function JoinTripButton({ code }: { code: string }) {
  const t = useTranslations('travel')
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const join = async () => {
    setBusy(true)
    setError(null)
    const result = await joinTrip(code)
    if (result.success && result.id) {
      router.push(`${locale === 'it' ? '' : `/${locale}`}/viaggi/${result.id}`)
      return
    }
    setBusy(false)
    setError(t(`error_${result.success ? 'saveError' : result.error}`))
  }

  return (
    <>
      <button
        type="button"
        onClick={join}
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-6 py-3.5 font-bold text-[var(--ink)] disabled:opacity-60"
      >
        {busy && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('joinTrip')}
      </button>
      {error && <p className="mt-3 text-center text-sm text-red-300">{error}</p>}
    </>
  )
}
