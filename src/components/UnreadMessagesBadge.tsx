'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { MessageCircle, Mail } from 'lucide-react'
import Link from '@/components/LocalizedLink'

export default function UnreadMessagesBadge({ initialCount }: { initialCount: number }) {
  const t = useTranslations('dashboard')
  const [count, setCount] = useState(initialCount)

  useEffect(() => {
    const handleRefresh = () => {
      setCount(0)
    }

    window.addEventListener('refreshUnreadCount', handleRefresh)
    return () => window.removeEventListener('refreshUnreadCount', handleRefresh)
  }, [])

  if (count > 0) {
    return (
      <Link 
        href="/marketplace/chat" 
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--ink)] bg-[var(--gold)] px-3 py-1.5 rounded-full border border-[var(--gold)] hover:bg-[var(--gold-bright)] transition-colors animate-pulse"
      >
        <MessageCircle className="w-3 h-3" />
        {count === 1 ? t('newMessage') : t('newMessages', { count })}
      </Link>
    )
  }

  return (
    <Link 
      href="/marketplace/chat" 
      className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink)] bg-[var(--gold-pale)]/40 px-3 py-1.5 rounded-full border border-[var(--gold)]/40 hover:bg-[var(--gold-pale)]/70 transition-colors"
    >
      <Mail className="w-3 h-3" />
      {t('readMessages')}
    </Link>
  )
}
