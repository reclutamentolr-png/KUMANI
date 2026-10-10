'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useLocalizedRouter as useRouter } from '@/lib/useLocalizedRouter'
import Link from '@/components/LocalizedLink'
import { Copy, Pencil, Trash2, LoaderCircle } from 'lucide-react'
import { deleteQuote, duplicateQuote } from '@/app/actions/quotes'
import { useFromDashboardSuffix } from '@/lib/useFromDashboard'
import { askConfirm } from '@/lib/confirm'

export default function QuoteActions({ id }: { id: string }) {
  const t = useTranslations('preventivi')
  const router = useRouter()
  const fromDashboardSuffix = useFromDashboardSuffix()
  const [deleting, setDeleting] = useState(false)
  const [duplicating, setDuplicating] = useState(false)

  // Copia completa con un nuovo numero: si apre subito in modifica
  const handleDuplicate = async () => {
    setDuplicating(true)
    const result = await duplicateQuote(id)
    if (result.success) router.push(`/marketplace/preventivi/${result.data.id}/edit${fromDashboardSuffix}`)
    else {
      alert(t(result.message))
      setDuplicating(false)
    }
  }

  const handleDelete = async () => {
    if (!(await askConfirm(t('deleteConfirm')))) return
    setDeleting(true)
    const result = await deleteQuote(id)
    if (result.success) {
      router.push(`/marketplace/preventivi${fromDashboardSuffix}`)
    } else {
      alert(t(result.message))
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`/marketplace/preventivi/${id}/edit${fromDashboardSuffix}`}
        className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)] transition-all"
      >
        <Pencil className="w-4 h-4" />
        {t('editQuote')}
      </Link>
      <button
        onClick={handleDuplicate}
        disabled={duplicating}
        className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)] transition-all disabled:opacity-50"
      >
        {duplicating ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
        {t('duplicateQuote')}
      </button>
      <button
        onClick={handleDelete}
        disabled={deleting}
        className="flex items-center gap-2 px-5 py-3 rounded-xl font-medium text-sm bg-red-50 text-red-700 hover:bg-red-100 transition-all disabled:opacity-50"
      >
        {deleting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        {t('deleteQuote')}
      </button>
    </div>
  )
}
