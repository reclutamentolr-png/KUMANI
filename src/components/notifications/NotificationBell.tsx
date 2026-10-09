'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, CheckCheck, LoaderCircle, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import { getNotifications, getUnreadNotificationCount, markNotificationsRead, type NotificationItem } from '@/app/actions/notifications'
import NotificationList, { NOTIFICATIONS_CHANGED } from './NotificationList'
import type { PushCategory } from '@/lib/push'

// Campanella in alto su tutte le pagine: numero degli avvisi da leggere e,
// toccandola, gli ultimi avvisi con i filtri per gruppo. Il numero si
// aggiorna aprendo la pagina, tornando sulla scheda e ogni 2 minuti.

type Filter = 'all' | PushCategory
const FILTERS: Filter[] = ['all', 'network', 'expiry', 'events', 'messages']

export default function NotificationBell() {
  const t = useTranslations('notifications')
  const [count, setCount] = useState(0)
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [items, setItems] = useState<NotificationItem[] | null>(null)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  const refreshCount = useCallback(() => {
    getUnreadNotificationCount()
      .then(setCount)
      .catch(() => null)
  }, [])

  useEffect(() => {
    refreshCount()
    const onVisible = () => document.visibilityState === 'visible' && refreshCount()
    const timer = setInterval(refreshCount, 120_000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(NOTIFICATIONS_CHANGED, refreshCount)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(NOTIFICATIONS_CHANGED, refreshCount)
    }
  }, [refreshCount])

  const load = useCallback(async (which: Filter) => {
    setItems(null)
    const res = await getNotifications({ limit: 20, category: which }).catch(() => ({ items: [], unread: 0 }))
    setItems(res.items)
    setCount(res.unread)
  }, [])

  // Chiusura con Esc o toccando fuori (computer)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onClick = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])

  const toggle = () => {
    if (!open) load(filter)
    setOpen(!open)
  }
  const choose = (which: Filter) => {
    setFilter(which)
    load(which)
  }
  const markAll = async () => {
    setBusy(true)
    await markNotificationsRead().catch(() => null)
    setItems((list) => list?.map((item) => ({ ...item, read: true })) ?? null)
    setCount(0)
    setBusy(false)
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={t('bellLabel', { n: count })}
        aria-expanded={open}
        className="relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-colors hover:bg-white/20"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--ink)] bg-rose-500 px-1 text-[11px] font-bold leading-none text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[69] bg-black/50 sm:hidden" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label={t('title')}
            className="fixed inset-x-0 top-0 z-[70] max-h-[85vh] overflow-hidden rounded-b-3xl bg-white text-[var(--ink)] shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:max-h-[70vh] sm:w-[400px] sm:rounded-2xl sm:border sm:border-[var(--gold)]/25"
          >
            <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))] sm:pt-3">
              <span className="text-base font-bold">{t('title')}</span>
              <div className="flex items-center gap-1">
                {count > 0 && (
                  <button type="button" onClick={markAll} disabled={busy} className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold text-[var(--ink)] hover:bg-gray-100 disabled:opacity-60">
                    {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />} {t('markAll')}
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label={t('close')} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto border-b border-gray-100 px-3 py-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => choose(f)}
                  aria-pressed={filter === f}
                  className={`shrink-0 cursor-pointer rounded-full px-3 py-1.5 text-xs font-semibold ${filter === f ? 'bg-[var(--ink)] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {t(`filter_${f}`)}
                </button>
              ))}
            </div>
            <div className="max-h-[calc(85vh-140px)] overflow-y-auto sm:max-h-[calc(70vh-140px)]" onClick={(e) => (e.target as HTMLElement).closest('button') && setTimeout(() => setOpen(false), 0)}>
              {items === null ? (
                <p className="flex justify-center py-10">
                  <LoaderCircle className="h-5 w-5 animate-spin text-gray-400" />
                </p>
              ) : (
                <NotificationList items={items} compact onOpened={() => setCount((c) => Math.max(c - 1, 0))} />
              )}
            </div>
            <Link href="/avvisi" onClick={() => setOpen(false)} className="block border-t border-gray-100 px-4 py-3 text-center text-sm font-semibold text-[var(--ink)] hover:bg-gray-50">
              {t('seeAll')}
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
