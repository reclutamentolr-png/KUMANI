'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { LoaderCircle, Trash2 } from 'lucide-react'
import { deleteSurprise } from '@/app/actions/surprise'
import { askConfirm } from '@/lib/confirm'

// Cestino accanto a ogni sorpresa in «Le mie sorprese»: chi l'ha creata fa
// pulizia da solo. Per una sorpresa già inviata l'avviso dice che il link
// non funzionerà più.
export default function DeleteSurpriseButton({ id, title, active }: { id: string; title: string; active: boolean }) {
  const t = useTranslations('surprise')
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const remove = async () => {
    if (!(await askConfirm(active ? t('deleteActiveConfirm', { title }) : t('deleteDraftConfirm'), { tone: 'danger' }))) return
    setBusy(true)
    const r = await deleteSurprise(id)
    setBusy(false)
    if (!r.success) {
      window.alert(t('deleteError'))
      return
    }
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label={t('deleteSurprise', { title })}
      title={t('deleteSurprise', { title })}
      className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:border-red-300 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
    >
      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </button>
  )
}
