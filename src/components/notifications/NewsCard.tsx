'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Bell, ChevronRight } from 'lucide-react'
import Link from '@/components/LocalizedLink'
import type { NotificationItem } from '@/app/actions/notifications'
import NotificationList from './NotificationList'

// Dashboard: «Novità per te», gli ultimi avvisi da leggere (al massimo 3).
// Toccandone uno sparisce da qui; «Vedi tutti» apre la pagina Avvisi.
export default function NewsCard({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const t = useTranslations('notifications')
  const [left, setLeft] = useState(items)
  const [total, setTotal] = useState(unread)
  if (!left.length) return null
  const others = total - left.length

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[var(--gold)]/30 bg-white shadow-[0_8px_24px_rgba(23,23,23,0.06)]">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-[var(--ink)]">
          <Bell className="h-5 w-5 text-[var(--gold)]" /> {t('newsTitle')}
          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-bold text-white">{total}</span>
        </h2>
        <Link href="/avvisi" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-[var(--ink)] hover:underline">
          {t('seeAllShort')} <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
      <NotificationList
        items={left}
        compact
        onOpened={(id) => {
          setLeft((list) => list.filter((item) => item.id !== id))
          setTotal((n) => Math.max(n - 1, 0))
        }}
      />
      {others > 0 && (
        <Link href="/avvisi" className="block border-t border-gray-100 px-4 py-2.5 text-center text-sm text-gray-600 hover:bg-gray-50">
          {t('newsMore', { n: others })}
        </Link>
      )}
    </section>
  )
}
