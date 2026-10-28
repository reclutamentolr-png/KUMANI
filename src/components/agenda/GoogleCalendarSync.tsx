'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Check, CircleAlert, RefreshCw, Unlink, Zap } from 'lucide-react'
import { disconnectGoogleCalendarAction, syncGoogleCalendarNow } from '@/app/actions/calendarFeed'
import { askConfirm } from '@/lib/confirm'

// Google Calendar collegato con l'API (aggiornamento immediato): pulsante per
// collegarsi, poi account, ultimo aggiornamento, «Aggiorna ora» e «Scollega».
// Il link .ics sotto resta per iPhone e Outlook.
export type GoogleCalendarState = { email: string | null; lastSyncAt: string | null; lastError: string | null } | null

export default function GoogleCalendarSync({ link, outcome }: { link: GoogleCalendarState; outcome: string | null }) {
  const t = useTranslations('calendarFeed')
  const locale = useLocale()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [synced, setSynced] = useState<null | boolean>(null)
  const when = (iso: string) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date(iso))

  const syncNow = () =>
    start(async () => {
      const result = await syncGoogleCalendarNow()
      setSynced(result === 'ok')
      router.refresh()
    })
  const disconnect = async () => {
    if (!(await askConfirm(t('googleApiDisconnectConfirm')))) return
    start(async () => {
      await disconnectGoogleCalendarAction()
      router.refresh()
    })
  }

  const message = outcome === 'ok' ? null : outcome === 'denied' ? t('googleApiDenied') : outcome === 'scope' ? t('googleApiScope') : outcome === 'failed' ? t('googleApiFailed') : null
  const button = 'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold disabled:opacity-60'

  return (
    <section className="rounded-2xl border-2 border-[var(--gold)]/50 bg-white p-5 shadow-sm sm:p-6" data-step="google-api">
      <h2 className="flex items-center gap-2 text-lg font-extrabold text-[var(--ink)]">
        <Zap className="h-5 w-5 text-[var(--gold)]" aria-hidden /> {t('googleApiTitle')}
      </h2>
      <p className="mt-1 text-sm text-[var(--muted)]">{t('googleApiText')}</p>

      {message && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{message}</p>}

      {link ? (
        <div className="mt-4 space-y-3">
          {outcome === 'ok' && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{t('googleApiOk')}</p>}
          <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            <Check className="h-4 w-4 text-emerald-600" aria-hidden /> {link.email ? t('googleApiConnected', { email: link.email }) : t('googleApiConnectedNoEmail')}
          </p>
          <p className="text-xs text-[var(--muted)]">{link.lastSyncAt ? t('googleApiLastSync', { when: when(link.lastSyncAt) }) : t('googleApiFirstSync')}</p>
          {link.lastError && synced !== true && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t('googleApiError')}
            </p>
          )}
          <div className="flex flex-wrap gap-2.5">
            <button type="button" onClick={syncNow} disabled={pending} className={`${button} bg-[var(--ink)] text-white hover:bg-black`}>
              {synced ? <Check className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden /> : <RefreshCw className={`h-4 w-4 text-[var(--gold-bright)] ${pending ? 'animate-spin' : ''}`} aria-hidden />}
              {synced ? t('googleApiSynced') : t('googleApiSyncNow')}
            </button>
            <button type="button" onClick={disconnect} disabled={pending} className={`${button} border border-gray-300 text-[var(--ink)] hover:bg-gray-50`}>
              <Unlink className="h-4 w-4" aria-hidden /> {t('googleApiDisconnect')}
            </button>
          </div>
          <p className="text-xs text-[var(--muted)]">{t('googleApiNoDouble')}</p>
        </div>
      ) : (
        // Link normale (non fetch): la richiesta va a Google e torna qui
        <a href={`/api/google-calendar/connect`} className={`${button} mt-4 w-full bg-[var(--ink)] text-white hover:bg-black sm:w-auto`}>
          <span className="text-base font-black text-[var(--gold-bright)]" aria-hidden>
            G
          </span>{' '}
          {t('googleApiConnect')}
        </a>
      )}
    </section>
  )
}
