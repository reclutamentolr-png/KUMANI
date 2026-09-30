'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle, Tag } from 'lucide-react'
import Link from '@/components/LocalizedLink'

// Avviso in cima alla dashboard: messaggi non letti dalla Bacheca Annunci,
// con accesso diretto ai messaggi o alla Bacheca. Sparisce quando i
// messaggi vengono letti (evento refreshUnreadCount). Il numero rosso
// lampeggia (non con "riduci movimento" attivo).
export default function BachecaMessagesAlert({ initialCount }: { initialCount: number }) {
  const t = useTranslations('dashboard')
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    const onRead = () => setCount(0)
    window.addEventListener('refreshUnreadCount', onRead)
    return () => window.removeEventListener('refreshUnreadCount', onRead)
  }, [])

  if (count <= 0) return null

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-[var(--gold)] bg-[var(--ink)] p-5 text-white shadow-[0_14px_40px_rgba(23,23,23,0.25)]">
      <div className="flex items-start gap-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)]">
          <MessageCircle className="h-6 w-6 text-[var(--ink)]" />
          <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6">
            <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75 motion-safe:animate-ping" />
            <span className="relative flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white ring-2 ring-[var(--ink)] motion-safe:animate-pulse">
              {count > 99 ? '99+' : count}
            </span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-[var(--gold-bright)]">{count === 1 ? t('newMessage') : t('newMessages', { count })}</p>
          <p className="mt-1 text-sm leading-6 text-white/75">{t('bachecaAlertText')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/marketplace/chat"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2.5 text-sm font-bold text-[var(--ink)] transition hover:brightness-110"
            >
              <MessageCircle className="h-4 w-4" />
              {t('bachecaAlertRead')}
            </Link>
            <Link
              href="/marketplace/listings"
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Tag className="h-4 w-4" />
              {t('bachecaAlertBoard')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
