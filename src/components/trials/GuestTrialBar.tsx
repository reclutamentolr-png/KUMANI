'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Clock, LoaderCircle, LogOut, Sparkles } from 'lucide-react'
import { leaveTrial, trialSignupHref } from '@/app/actions/trials'

// Barra fissa in basso per l'ospite in prova: servizio, tempo che resta,
// «Crea il tuo account» (con l'invito di chi ha mandato il codice) ed «Esci».
// Alla scadenza porta alla pagina di fine prova.
export default function GuestTrialBar({ toolTitle, until }: { toolTitle: string; until: string }) {
  const t = useTranslations('trials')
  const end = new Date(until).getTime()
  const [left, setLeft] = useState(() => Math.max(end - Date.now(), 0))
  const [busy, setBusy] = useState<'signup' | 'leave' | null>(null)

  useEffect(() => {
    const tick = () => {
      const ms = Math.max(end - Date.now(), 0)
      setLeft(ms)
      if (ms === 0) window.location.reload()
    }
    const timer = setInterval(tick, 20_000)
    return () => clearInterval(timer)
  }, [end])

  const minutes = Math.ceil(left / 60_000)
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const remaining = days > 0 ? t('leftDays', { days, hours }) : hours > 0 ? t('leftHours', { hours, minutes: mins }) : t('leftMinutes', { minutes: mins })

  const signup = async () => {
    setBusy('signup')
    const href = await trialSignupHref()
    await leaveTrial()
    window.location.href = href
  }
  const leave = async () => {
    setBusy('leave')
    await leaveTrial()
    // Ricarica completa: la sessione da ospite è appena stata chiusa
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = '/'
  }

  return (
    <>
      <div aria-hidden className="h-24 shrink-0" />
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--gold)]/40 bg-[var(--ink)] px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2.5 text-white shadow-[0_-10px_30px_rgba(23,23,23,0.3)] print:hidden">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[var(--gold-bright)]">{t('barTitle', { tool: toolTitle })}</p>
            <p className="flex items-center gap-1.5 text-xs text-white/75">
              <Clock className="h-3.5 w-3.5" /> {remaining} · {t('barNote')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={signup}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-4 py-2 text-sm font-bold text-[var(--ink)] disabled:opacity-60"
            >
              {busy === 'signup' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {t('barSignup')}
            </button>
            <button
              type="button"
              onClick={leave}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10 disabled:opacity-60"
            >
              {busy === 'leave' ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />} {t('barLeave')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
