'use client'

import { useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { BellRing, CheckCircle2, LoaderCircle, X } from 'lucide-react'
import { enablePush, getPushDeviceStatus } from '@/lib/pushClient'

// Dashboard: invito ad attivare le notifiche su questo dispositivo. Compare
// solo se il dispositivo le supporta e non sono ancora attive; chiuso una
// volta non torna più (su questo dispositivo).
const DISMISS_KEY = 'kumani-push-invite-dismissed'

export default function PushInviteCard() {
  const t = useTranslations('pushInvite')
  const locale = useLocale()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'on' | 'denied' | 'error' | null>(null)

  useEffect(() => {
    let cancelled = false
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch {
      // senza memoria del browser l'invito resta visibile
    }
    getPushDeviceStatus().then(({ status }) => {
      if (!cancelled && status === 'off') setVisible(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {}
    setVisible(false)
  }

  const enable = async () => {
    setBusy(true)
    const r = await enablePush(locale)
    setBusy(false)
    if (r === 'off') return
    setResult(r)
    if (r === 'on' || r === 'denied') {
      try {
        localStorage.setItem(DISMISS_KEY, '1')
      } catch {}
    }
  }

  if (!visible) return null

  return (
    <section className="relative flex flex-col gap-3 rounded-2xl border border-[var(--gold)]/40 bg-[var(--paper)] p-5 pr-12 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <button type="button" onClick={dismiss} aria-label={t('close')} className="absolute right-3 top-3 rounded-full p-1.5 text-[var(--muted)] hover:bg-[var(--gold-pale)] hover:text-[var(--ink)]">
        <X className="h-4 w-4" />
      </button>
      {result === 'on' ? (
        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> {t('done')}
        </p>
      ) : (
        <>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
              <BellRing className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-bold text-[var(--ink)]">{t('title')}</h2>
              <p className="mt-0.5 text-sm text-[var(--muted)]">{result === 'denied' ? t('denied') : result === 'error' ? t('error') : t('text')}</p>
            </div>
          </div>
          {result !== 'denied' && (
            <button
              type="button"
              onClick={enable}
              disabled={busy}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-bold text-[var(--gold-bright)] disabled:opacity-50"
            >
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} {t('enable')}
            </button>
          )}
        </>
      )}
    </section>
  )
}
