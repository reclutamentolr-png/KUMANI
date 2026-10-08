'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Undo2, Trash2, LoaderCircle } from 'lucide-react'
import { confirmReturn, deleteReceipt } from '@/app/actions/digitalReceipt'
import { askConfirm } from '@/lib/confirm'

export default function DigitalReceiptActions({
  id,
  showConfirmReturn,
}: {
  id: string
  showConfirmReturn: boolean
}) {
  const t = useTranslations('digitalReceipt')
  const router = useRouter()
  const [returning, setReturning] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleConfirmReturn = async () => {
    if (!(await askConfirm(t('confirmReturnConfirm')))) return
    setReturning(true)
    const result = await confirmReturn(id)
    setReturning(false)
    if (result.success) {
      router.refresh()
    } else {
      alert(t(result.message))
    }
  }

  const handleDelete = async () => {
    if (!(await askConfirm(t('deleteConfirm')))) return
    setDeleting(true)
    const result = await deleteReceipt(id)
    if (result.success) {
      router.push('/marketplace/digital-receipt')
    } else {
      alert(t(result.message))
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {showConfirmReturn && (
        <button
          onClick={handleConfirmReturn}
          disabled={returning}
          className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm bg-[var(--ink)] text-white hover:bg-[var(--ink-soft)] transition-all disabled:opacity-50"
        >
          {returning ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Undo2 className="w-4 h-4" />}
          {t('confirmReturnAction')}
        </button>
      )}
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm bg-red-50 text-red-700 hover:bg-red-100 transition-all disabled:opacity-50"
      >
        {deleting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        {t('deleteReceipt')}
      </button>
    </div>
  )
}
