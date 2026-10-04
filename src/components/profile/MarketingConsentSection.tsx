'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// Consenso alle email di novità e offerte (facoltativo): si dà e si revoca
// con un clic, ogni cambio resta nello storico dei consensi.
export default function MarketingConsentSection({ isOpen }: { isOpen: boolean }) {
  const t = useTranslations('marketingConsent')
  const [granted, setGranted] = useState<boolean | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    createClient()
      .rpc('get_my_marketing_consent')
      .then(({ data }) => {
        if (!cancelled) setGranted(data === true)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  const toggle = async () => {
    if (granted === null) return
    setSaving(true)
    const { data, error } = await createClient().rpc('set_my_marketing_consent', { p_granted: !granted })
    setSaving(false)
    if (!error) setGranted(data === true)
  }

  if (granted === null) return null
  return (
    <div className="mt-2 flex items-center justify-between gap-3 border-t border-gray-100 pt-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--ink)]">
          <Mail className="h-4 w-4 text-[var(--gold)]" /> {t('title')}
        </p>
        <p className="mt-0.5 text-xs text-gray-500">{t(granted ? 'onText' : 'offText')}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={granted}
        aria-label={t('title')}
        disabled={saving}
        onClick={toggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${granted ? 'bg-[var(--gold)]' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${granted ? 'left-[22px]' : 'left-0.5'}`} />
      </button>
    </div>
  )
}
