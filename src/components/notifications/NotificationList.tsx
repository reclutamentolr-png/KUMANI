'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Bell, CalendarClock, MessageCircle, ShieldCheck, Ticket, Users, type LucideIcon } from 'lucide-react'
import { markNotificationsRead, type NotificationItem } from '@/app/actions/notifications'
import type { PushCategory } from '@/lib/push'

// Righe degli avvisi (campanella, pagina Avvisi, «Novità per te»): icona del
// gruppo, titolo (in grassetto se da leggere), testo e da quanto tempo.
// Toccando: segnato letto e si va alla pagina giusta.

export const NOTIFICATIONS_CHANGED = 'kumani:notifications-changed'

const ICON: Record<PushCategory, LucideIcon> = { network: Users, expiry: CalendarClock, events: Ticket, messages: MessageCircle, staff: ShieldCheck }
const TONE: Record<PushCategory, string> = {
  network: 'bg-[var(--gold-pale)] text-[var(--ink)]',
  expiry: 'bg-amber-100 text-amber-800',
  events: 'bg-sky-100 text-sky-800',
  messages: 'bg-rose-100 text-rose-700',
  staff: 'bg-gray-100 text-gray-700',
}

export function useTimeAgo() {
  const locale = useLocale()
  return (iso: string) => {
    const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000)
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' })
    const abs = Math.abs(seconds)
    if (abs < 60) return rtf.format(0, 'minute')
    if (abs < 3600) return rtf.format(Math.round(seconds / 60), 'minute')
    if (abs < 86400) return rtf.format(Math.round(seconds / 3600), 'hour')
    if (abs < 7 * 86400) return rtf.format(Math.round(seconds / 86400), 'day')
    return new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  }
}

export default function NotificationList({
  items,
  onOpened,
  compact = false,
}: {
  items: NotificationItem[]
  onOpened?: (id: string) => void
  compact?: boolean
}) {
  const t = useTranslations('notifications')
  const router = useRouter()
  const ago = useTimeAgo()

  if (!items.length) {
    return (
      <p className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-gray-500">
        <Bell className="h-6 w-6 text-gray-300" /> {t('empty')}
      </p>
    )
  }

  const open = async (item: NotificationItem) => {
    if (!item.read) {
      onOpened?.(item.id)
      await markNotificationsRead([item.id]).catch(() => null)
      window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED))
    }
    if (item.url) router.push(item.url)
  }

  return (
    <ul className="divide-y divide-gray-100">
      {items.map((item) => {
        const Icon = ICON[item.category] ?? Bell
        return (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => open(item)}
              className={`flex w-full cursor-pointer items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--gold-pale)]/40 ${item.read ? '' : 'bg-[var(--gold-pale)]/25'}`}
            >
              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE[item.category] ?? TONE.staff}`}>
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-sm leading-snug text-[var(--ink)] ${item.read ? 'font-medium' : 'font-bold'}`}>{item.title}</span>
                {item.body && <span className={`mt-0.5 block text-sm leading-snug text-gray-600 ${compact ? 'line-clamp-2' : ''}`}>{item.body}</span>}
                <span className="mt-1 block text-xs text-gray-400">{ago(item.createdAt)}</span>
              </span>
              {!item.read && <span aria-label={t('unread')} className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-rose-500" />}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
