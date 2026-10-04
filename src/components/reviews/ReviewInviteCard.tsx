'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MessageSquareQuote, X } from 'lucide-react'
import Link from '@/components/LocalizedLink'

const KEY = 'kumani:review-invite-hidden'

// Home: invito a lasciare una recensione a chi ha acquistato da almeno 7
// giorni e non l'ha ancora scritta. "Più tardi" lo nasconde per 30 giorni.
export default function ReviewInviteCard() {
  const t = useTranslations('reviews')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let hiddenUntil = 0
    try {
      hiddenUntil = Number(localStorage.getItem(KEY) || 0)
    } catch {
      // Memoria del browser non disponibile: l'invito resta visibile
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(Date.now() > hiddenUntil)
  }, [])

  if (!visible) return null

  const later = () => {
    setVisible(false)
    try {
      localStorage.setItem(KEY, String(Date.now() + 30 * 86_400_000))
    } catch {
      // niente da fare
    }
  }

  return (
    <div className="relative flex flex-col gap-4 rounded-2xl border border-[var(--gold)]/40 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--gold)] to-[var(--gold-bright)] text-[var(--ink)]">
        <MessageSquareQuote className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 pr-6">
        <p className="font-bold text-[var(--ink)]">{t('inviteTitle')}</p>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{t('inviteText')}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/recensioni/scrivi" className="rounded-xl bg-[var(--ink)] px-4 py-2.5 text-sm font-bold text-white hover:bg-[var(--ink-soft)]">
          {t('inviteCta')}
        </Link>
        <button type="button" onClick={later} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--muted)] hover:bg-gray-100">
          {t('inviteLater')}
        </button>
      </div>
      <button type="button" onClick={later} aria-label={t('inviteLater')} className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 hover:bg-gray-100 sm:hidden">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
