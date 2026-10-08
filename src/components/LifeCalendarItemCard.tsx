'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import Link from '@/components/LocalizedLink'
import { CheckCircle2, House, RefreshCw, LoaderCircle, Trash2 } from 'lucide-react'
import { markHandled, deleteItem } from '@/app/actions/lifeCalendar'
import { getItemStatus, daysUntil, type ItemStatus } from '@/lib/lifeCalendar'
import { askConfirm } from '@/lib/confirm'

type Item = {
  id: string
  title: string
  category: string
  due_date: string
  recurrence: string
  profile_name?: string | null
  casa_home_id?: string | null
  casa_home_name?: string | null
}

const STATUS_DOT: Record<ItemStatus, string> = {
  regular: 'bg-green-500',
  upcoming: 'bg-[var(--gold-bright)]',
  urgent: 'bg-amber-600',
  expired: 'bg-red-600',
}

export default function LifeCalendarItemCard({ item }: { item: Item }) {
  const t = useTranslations('lifeCalendar')
  const router = useRouter()
  const [handling, setHandling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const status = getItemStatus(item.due_date)
  const days = daysUntil(item.due_date)
  const isRecurring = item.recurrence !== 'none'

  const handleMarkHandled = async () => {
    if (!isRecurring && !(await askConfirm(t('archiveConfirm')))) return

    setHandling(true)
    const result = await markHandled(item.id)
    setHandling(false)

    if (!result.success) {
      alert(t(result.message))
      return
    }

    if (result.data.archived) {
      alert(t('archivedSuccess'))
    } else if (result.data.newDueDate) {
      alert(t('renewedSuccess', { date: new Date(result.data.newDueDate).toLocaleDateString() }))
    }

    router.refresh()
  }

  const handleDelete = async () => {
    if (!(await askConfirm(t('deleteConfirm')))) return
    setDeleting(true)
    const result = await deleteItem(item.id)
    if (result.success) {
      router.refresh()
    } else {
      alert(t(result.message))
      setDeleting(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[var(--gold)]/20 shadow-sm hover:border-[var(--gold)]/50 transition-colors p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className={`mt-1.5 w-3 h-3 rounded-full shrink-0 ring-2 ring-white shadow ${STATUS_DOT[status]}`} />
        <div className="min-w-0">
          <h3 className="font-semibold text-[var(--ink)] truncate">{item.title}</h3>
          {item.casa_home_id && (
            <Link
              href={`/marketplace/casa/${item.casa_home_id}`}
              title={t('openInCasa')}
              className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full bg-[var(--ink)] px-2 py-0.5 text-[11px] font-bold text-[var(--gold-bright)] hover:brightness-125"
            >
              <House className="h-3 w-3 shrink-0" />
              <span className="truncate">{t('casaBadge', { name: item.casa_home_name ?? '' })}</span>
            </Link>
          )}
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {t(`category_${item.category}`)}
            {item.profile_name ? ` · ${item.profile_name}` : ''}
            {' · '}
            {isRecurring ? t('recurringBadge') : t('oneTimeBadge')}
          </p>
          <p className="text-sm mt-1">
            {status === 'expired' ? (
              <span className="text-red-700 font-medium">{t('expiredSince', { count: Math.abs(days) })}</span>
            ) : (
              <span className={status === 'urgent' ? 'text-amber-700 font-medium' : 'text-[var(--muted)]'}>
                {t('dueIn', { count: days })} · {new Date(item.due_date).toLocaleDateString()}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <button
          onClick={handleMarkHandled}
          disabled={handling}
          title={isRecurring ? t('markHandledHint') : t('archiveHint')}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
            isRecurring ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)]'
          }`}
        >
          {handling ? (
            <LoaderCircle className="w-4 h-4 animate-spin" />
          ) : isRecurring ? (
            <RefreshCw className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          {isRecurring ? t('markHandled') : t('markCompleted')}
        </button>
        <Link
          href={`/marketplace/life-calendar/${item.id}`}
          className="px-3 py-2 rounded-lg text-sm font-medium border border-[var(--gold)]/40 bg-white text-[var(--ink)] hover:bg-[var(--gold-pale)] transition-all"
        >
          {t('details')}
        </Link>
        <button
          onClick={handleDelete}
          disabled={deleting}
          title={t('deleteItem')}
          className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-all disabled:opacity-50"
        >
          {deleting ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}
