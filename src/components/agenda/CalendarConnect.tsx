'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Apple, Check, Copy, Mail, RefreshCw } from 'lucide-react'
import { rotateCalendarFeed } from '@/app/actions/calendarFeed'
import { askConfirm } from '@/lib/confirm'

// Collegare il calendario KUMANI a Google Calendar, iPhone/Mac e Outlook con
// il link personale (.ics). Pulsanti diretti dove esistono, poi i passi a mano.
// Con Google Calendar collegabile con l'API (googleApi) Google sparisce da qui
// (con tutti e due gli impegni comparirebbero due volte) e il link compare solo
// dopo aver scelto iPhone/Mac o Outlook.
export default function CalendarConnect({ httpsUrl, lastFetchedAt, googleApi = false }: { httpsUrl: string; lastFetchedAt: string | null; googleApi?: boolean }) {
  const t = useTranslations('calendarFeed')
  const locale = useLocale()
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  const [chosen, setApp] = useState<'apple' | 'outlook' | null>(null)
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://')
  const google = `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl)}`
  const outlook = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(httpsUrl)}&name=KUMANI`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(httpsUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt(t('copy'), httpsUrl)
    }
  }
  const rotate = async () => {
    if (!(await askConfirm(t('rotateConfirm')))) return
    start(async () => {
      await rotateCalendarFeed(locale)
      router.refresh()
    })
  }

  const card = 'rounded-2xl border border-[var(--gold)]/25 bg-white p-5 shadow-sm sm:p-6'
  const button = 'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold'

  const linkBox = (
    <>
      <p className="mt-4 break-all rounded-xl bg-[var(--ink)] px-3.5 py-2.5 font-mono text-sm text-[var(--gold-bright)]">{httpsUrl}</p>
      <button type="button" onClick={copy} className={`${button} mt-3 w-full bg-[var(--gold)]/15 text-[var(--ink)] hover:bg-[var(--gold)]/25 sm:w-auto`}>
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {copied ? t('copied') : t('copy')}
      </button>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {lastFetchedAt
          ? t('lastFetched', { when: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }).format(new Date(lastFetchedAt)) })
          : t('neverFetched')}
      </p>
    </>
  )
  const info = (
    <section className={card}>
      <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('infoTitle')}</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--muted)]">
        <li>{t('infoWhat')}</li>
        <li>{t('infoOneWay')}</li>
        <li>{t('infoDelay')}</li>
        <li>{t('infoPrivate')}</li>
      </ul>
      <button type="button" onClick={rotate} disabled={pending} data-step="rotate" className={`${button} mt-4 border border-[var(--gold)]/40 text-[var(--ink)] hover:bg-[var(--gold)]/10 disabled:opacity-60`}>
        <RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} aria-hidden /> {t('rotate')}
      </button>
    </section>
  )

  // Con Google collegabile: prima si sceglie iPhone/Mac o Outlook, poi compaiono passi e link
  if (googleApi) {
    const choice = (app: 'apple' | 'outlook', icon: React.ReactNode) => (
      <button
        type="button"
        onClick={() => setApp(app === chosen ? null : app)}
        aria-pressed={app === chosen}
        className={`${button} ${app === chosen ? 'bg-[var(--ink)] text-white' : 'border border-[var(--gold)]/40 text-[var(--ink)] hover:bg-[var(--gold)]/10'}`}
      >
        {icon} {t(app)}
      </button>
    )
    return (
      <div className="space-y-6">
        <section className={card} data-step="apps">
          <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('otherAppsTitle')}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('appsGoogleApiHint')}</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {choice('apple', <Apple className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden />)}
            {choice('outlook', <Mail className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden />)}
          </div>
          {chosen && (
            <div className="mt-6 text-sm text-[var(--ink)]" data-step="link">
              <a
                href={chosen === 'apple' ? webcalUrl : outlook}
                {...(chosen === 'outlook' ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                className={`${button} w-full bg-[var(--ink)] text-white hover:bg-black sm:w-auto`}
              >
                {chosen === 'apple' ? <Apple className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden /> : <Mail className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden />} {t('addTo', { app: t(chosen) })}
              </a>
              <p className="mt-4 font-bold">{t(`${chosen}StepsTitle`)}</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-[var(--muted)]">
                {[1, 2, 3].map((n) => (
                  <li key={n}>{t(`${chosen}Step${n}`)}</li>
                ))}
              </ol>
              <p className="mt-5 font-bold">{t('linkTitle')}</p>
              <p className="mt-1 text-[var(--muted)]">{t('linkHint')}</p>
              {linkBox}
            </div>
          )}
        </section>
        {chosen && info}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className={card} data-step="link">
        <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('linkTitle')}</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('linkHint')}</p>
        {linkBox}
      </section>

      <section className={card} data-step="apps">
        <h2 className="text-lg font-extrabold text-[var(--ink)]">{t('appsTitle')}</h2>
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <a href={google} target="_blank" rel="noopener noreferrer" className={`${button} bg-[var(--ink)] text-white hover:bg-black`}>
            <span className="text-base font-black text-[var(--gold-bright)]" aria-hidden>G</span> {t('google')}
          </a>
          <a href={webcalUrl} className={`${button} bg-[var(--ink)] text-white hover:bg-black`}>
            <Apple className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden /> {t('apple')}
          </a>
          <a href={outlook} target="_blank" rel="noopener noreferrer" className={`${button} bg-[var(--ink)] text-white hover:bg-black`}>
            <Mail className="h-4 w-4 text-[var(--gold-bright)]" aria-hidden /> {t('outlook')}
          </a>
        </div>
        <div className="mt-6 space-y-4 text-sm text-[var(--ink)]">
          {(['google', 'apple', 'outlook'] as const).map((app) => (
            <div key={app}>
              <p className="font-bold">{t(`${app}StepsTitle`)}</p>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-[var(--muted)]">
                {[1, 2, 3].map((n) => (
                  <li key={n}>{t(`${app}Step${n}`)}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </section>

      {info}
    </div>
  )
}