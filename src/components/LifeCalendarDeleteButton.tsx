'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { deleteItem } from '@/app/actions/lifeCalendar'
import { askConfirm } from '@/lib/confirm'

export default function LifeCalendarDeleteButton({ id }: { id: string }) {
  const t = useTranslations('lifeCalendar')
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!(await askConfirm(t('deleteConfirm')))) return
    setDeleting(true)
    const result = await deleteItem(id)
    if (result.success) {
      router.push('/marketplace/life-calendar')
    } else {
      alert(t(result.message))
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm bg-red-50 text-red-700 hover:bg-red-100 transition-all disabled:opacity-50"
    >
      <Trash2 className="w-4 h-4" />
      {t('deleteItem')}
    </button>
  )
}
