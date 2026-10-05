'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LayoutGrid, LoaderCircle } from 'lucide-react'
import { showFullDashboard } from '@/app/actions/gifts'

// Chiude la dashboard essenziale (del regalo) e mostra quella completa
export default function ShowFullDashboardButton() {
  const t = useTranslations('gifts')
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true)
        await showFullDashboard()
        router.refresh()
      }}
      className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-black/5 hover:text-[var(--ink)] disabled:opacity-50"
    >
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LayoutGrid className="h-4 w-4" />}
      {t('showFull')}
    </button>
  )
}
