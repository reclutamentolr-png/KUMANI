'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import Link from '@/components/LocalizedLink'
import { X, Clock } from 'lucide-react'

type Props = {
  expiresAt: string
  daysLeft: number
}

export default function RenewalReminderModal({ expiresAt, daysLeft }: Props) {
  const t = useTranslations('dashboard')
  const locale = useLocale()
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  const formattedDate = new Date(expiresAt).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setVisible(false)}>
      <div
        className="relative w-full max-w-sm rounded-2xl border border-amber-400/50 bg-white p-8 text-center shadow-[0_25px_60px_rgba(0,0,0,0.3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setVisible(false)}
          aria-label="Close"
          className="absolute right-4 top-4 text-gray-400 transition-colors hover:text-gray-700"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <Clock className="h-8 w-8 text-amber-600" />
        </div>

        <h2 className="mb-2 text-xl font-bold text-gray-900">{t('renewalReminderTitle')}</h2>
        <p className="text-sm leading-6 text-gray-600">
          {t('renewalReminderMessage', { days: daysLeft, date: formattedDate })}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={{ pathname: '/billing' }}
            className="w-full rounded-xl bg-[var(--ink)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--ink-soft)]"
          >
            {t('renewalReminderCta')}
          </Link>
          <button
            onClick={() => setVisible(false)}
            className="w-full rounded-xl px-5 py-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-700"
          >
            {t('renewalReminderLater')}
          </button>
        </div>
      </div>
    </div>
  )
}
