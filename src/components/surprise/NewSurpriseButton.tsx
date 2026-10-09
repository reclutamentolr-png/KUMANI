'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { LoaderCircle, Plus } from 'lucide-react'
import { createSurprise } from '@/app/actions/surprise'

export default function NewSurpriseButton() {
  const t = useTranslations('surprise')
  const locale = useLocale()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    setBusy(true)
    setError(null)
    const result = await createSurprise(locale)
    if (!result.success) {
      setBusy(false)
      setError(result.limitText ?? t('error_saveError'))
      return
    }
    router.push(`${locale === 'it' ? '' : `/${locale}`}/sorprese/${result.id}`)
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-7 py-3.5 text-lg font-bold text-[var(--ink)] shadow-lg hover:brightness-110 disabled:opacity-60"
      >
        {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />} {t('createButton')}
      </button>
      {error && <p className="mt-2 text-sm font-semibold text-amber-700">{error}</p>}
    </div>
  )
}
