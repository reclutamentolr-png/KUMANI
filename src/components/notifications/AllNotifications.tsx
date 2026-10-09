'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CheckCheck, LoaderCircle } from 'lucide-react'
import { getNotifications, markNotificationsRead, type NotificationItem } from '@/app/actions/notifications'
import NotificationList, { NOTIFICATIONS_CHANGED } from './NotificationList'
import type { PushCategory } from '@/lib/push'

// Pagina Avvisi: filtri per gruppo, «Segna tutto come letto», «Carica altri»
type Filter = 'all' | PushCategory
const FILTERS: Filter[] = ['all', 'network', 'expiry', 'events', 'messages']
const PAGE = 30

export default function AllNotifications({ initial, unread: initialUnread }: { initial: NotificationItem[]; unread: number }) {
  const t = useTranslations('notifications')
  const [items, setItems] = useState(initial)
  const [unread, setUnread] = useState(initialUnread)
  const [filter, setFilter] = useState<Filter>('all')
  const [more, setMore] = useState(initial.length === PAGE)
  const [busy, setBusy] = useState<'list' | 'more' | 'all' | null>(null)

  const choose = async (which: Filter) => {
    setFilter(which)
    setBusy('list')
    const res = await getNotifications({ limit: PAGE, category: which })
    setItems(res.items)
    setUnread(res.unread)
    setMore(res.items.length === PAGE)
    setBusy(null)
  }
  const loadMore = async () => {
    setBusy('more')
    const res = await getNotifications({ limit: PAGE, category: filter, before: items[items.length - 1]?.createdAt })
    setItems((list) => [...list, ...res.items])
    setMore(res.items.length === PAGE)
    setBusy(null)
  }
  const markAll = async () => {
    setBusy('all')
    await markNotificationsRead()
    setItems((list) => list.map((item) => ({ ...item, read: true })))
    setUnread(0)
    setBusy(null)
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--gold)]/25 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
        <div className="flex gap-1.5 overflow-x-auto">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => choose(f)}
              aria-pressed={filter === f}
              className={`min-h-9 shrink-0 cursor-pointer rounded-full px-3 text-xs font-semibold ${filter === f ? 'bg-[var(--ink)] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              {t(`filter_${f}`)}
            </button>
          ))}
        </div>
        {unread > 0 && (
          <button type="button" onClick={markAll} disabled={busy !== null} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[var(--ink)] hover:bg-gray-100 disabled:opacity-60">
            {busy === 'all' ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />} {t('markAll')}
          </button>
        )}
      </div>
      {busy === 'list' ? (
        <p className="flex justify-center py-10">
          <LoaderCircle className="h-5 w-5 animate-spin text-gray-400" />
        </p>
      ) : (
        <NotificationList items={items} onOpened={() => setUnread((n) => Math.max(n - 1, 0))} />
      )}
      {more && busy !== 'list' && (
        <button type="button" onClick={loadMore} disabled={busy !== null} className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 border-t border-gray-100 text-sm font-semibold text-[var(--ink)] hover:bg-gray-50 disabled:opacity-60">
          {busy === 'more' && <LoaderCircle className="h-4 w-4 animate-spin" />} {t('loadMore')}
        </button>
      )}
      <p className="border-t border-gray-100 px-4 py-3 text-center text-xs text-gray-500">{t('keepNote')}</p>
    </div>
  )
}
