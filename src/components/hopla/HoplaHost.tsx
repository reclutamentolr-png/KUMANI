'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Download, Globe, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, Upload, Wifi } from 'lucide-react'
import { hoplaReceived } from '@/app/actions/hopla'
import Link from '@/components/LocalizedLink'
import type { HoplaMode } from '@/lib/hopla'
import { useHoplaHost } from './useHoplaHost'
import HoplaReceivePanel from './HoplaReceivePanel'
import HoplaSendPanel from './HoplaSendPanel'

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'

// Hoplà dai servizi (computer o telefono): si sceglie se ricevere qui o
// inviare da qui, si mostra il codice QR e il telefono che lo inquadra fa
// l'opposto. La modalità si può cambiare anche a collegamento aperto, ma
// non durante un invio.
export default function HoplaHost() {
  const t = useTranslations('hopla')
  const locale = useLocale()
  const [mode, setMode] = useState<HoplaMode>('get')
  const [busy, setBusy] = useState(false)
  const { phase, qr, device, route, link, restart, recheckRoute } = useHoplaHost(locale, mode)

  const deviceName = t(`devices.${device}`)
  const connected = phase === 'connected'
  const showQr = !connected
  // Il KU Karma del giorno: a fine invio o ricezione (il database controlla piano e giorno)
  const award = () => hoplaReceived().catch(() => {})

  const modeButton = (m: HoplaMode, Icon: typeof Download) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      disabled={busy}
      aria-pressed={mode === m}
      className={`flex flex-1 items-center gap-3 rounded-2xl border-2 p-4 text-left transition disabled:opacity-60 ${mode === m ? 'border-[var(--gold)] bg-[var(--gold-pale)]' : 'border-[var(--gold)]/20 bg-white hover:border-[var(--gold)]/60'}`}
    >
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${mode === m ? 'bg-[var(--ink)] text-[var(--gold-bright)]' : 'bg-[var(--background)] text-[var(--ink)]'}`}>
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-base font-extrabold text-[var(--ink)]">{t(m === 'get' ? 'modeGet' : 'modeGive')}</span>
        <span className="block text-sm text-[var(--muted)]">{t(m === 'get' ? 'modeGetHint' : 'modeGiveHint')}</span>
      </span>
    </button>
  )

  return (
    <div className="space-y-5">
      <section aria-label={t('modeTitle')} className="flex flex-col gap-3 sm:flex-row">
        {modeButton('get', Download)}
        {modeButton('give', Upload)}
      </section>

      {(phase === 'failed' || phase === 'lost') && (
        <section className="flex gap-3 rounded-3xl border border-[#f2c9c9] bg-[#fdf2f2] p-4" role="alert">
          <Wifi className="mt-0.5 h-5 w-5 shrink-0 text-[#a12a2a]" aria-hidden="true" />
          <div>
            <p className="font-extrabold text-[var(--ink)]">{phase === 'failed' ? t('failedTitle') : t('lostTitle')}</p>
            <p className="text-sm text-[var(--muted)]">{phase === 'failed' ? t('failedText') : t('lostPcText')}</p>
          </div>
        </section>
      )}

      {showQr && (
        <section className={`${card} grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]`} aria-live="polite">
          <div className="space-y-5">
            <ol className="space-y-4">
              {(mode === 'get' ? (['step1', 'getStep2', 'getStep3'] as const) : (['step1', 'giveStep2', 'giveStep3'] as const)).map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-sm font-extrabold text-[var(--gold-bright)]">{index + 1}</span>
                  <span className="pt-1.5 text-base font-semibold leading-snug text-[var(--ink)]">{t(step)}</span>
                </li>
              ))}
            </ol>
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--muted)]" role="status">
              {phase === 'connecting' ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin text-[var(--gold)]" aria-hidden="true" />
                  {t('connecting', { device: deviceName })}
                </>
              ) : (
                <>
                  <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--gold)] opacity-60 motion-reduce:hidden" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[var(--gold)]" />
                  </span>
                  {t('waiting')}
                </>
              )}
            </p>
          </div>
          <div className="mx-auto w-full max-w-[300px] text-center">
            <div className="rounded-3xl border border-[var(--gold)]/30 bg-white p-3 shadow-sm">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt={t('qrAlt')} width={280} height={280} className="aspect-square h-auto w-full rounded-2xl" />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center">
                  <LoaderCircle className="h-8 w-8 animate-spin text-[var(--gold)]" aria-label={t('loading')} />
                </div>
              )}
            </div>
            <button type="button" onClick={restart} className="mt-3 inline-flex min-h-10 items-center gap-1.5 text-sm font-bold text-[#7a5a14] hover:underline">
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> {t('newCode')}
            </button>
          </div>
        </section>
      )}

      {connected && (
        <section className={`${card} flex flex-wrap items-center gap-4`} role="status">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e6f4ea] text-[#1d6b34]">
            <Smartphone className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-extrabold text-[var(--ink)]">{t('connected', { device: deviceName })}</p>
            <p className="text-sm text-[var(--muted)]">{mode === 'get' ? t('getIdle') : t('giveIdle')}</p>
          </div>
          {route && (
            <p className="inline-flex items-center gap-2 rounded-full bg-[var(--background)] px-3 py-1.5 text-xs font-bold text-[var(--muted)]">
              {route === 'local' ? <Wifi className="h-3.5 w-3.5 text-[#1d6b34]" aria-hidden="true" /> : <Globe className="h-3.5 w-3.5 text-[#7a5a14]" aria-hidden="true" />}
              {route === 'local' ? t('routeLocal') : t('routeInternet')}
            </p>
          )}
        </section>
      )}

      {/* Il pannello resta montato: i file ricevuti o scelti non si perdono se il telefono si scollega */}
      <div className={mode === 'get' ? '' : 'hidden'}>
        <HoplaReceivePanel link={mode === 'get' ? link : null} peer={deviceName} route={route} onBusy={setBusy} onDone={award} onStart={recheckRoute} />
      </div>
      <div className={mode === 'give' ? `${card}` : 'hidden'}>
        <HoplaSendPanel link={mode === 'give' ? link : null} onBusy={setBusy} onDone={award} offlineHint={t('giveOffline')} />
      </div>

      <section className="grid gap-3 md:grid-cols-2">
        <div className={card}>
          <h2 className="text-base font-extrabold text-[var(--ink)]">{t('tipsTitle')}</h2>
          <ul className="mt-2 space-y-1.5 text-sm text-[var(--muted)]">
            <li>• {t('tip1')}</li>
            <li>• {t('tip2')}</li>
            <li>• {t('tip3')}</li>
          </ul>
        </div>
        <div className={`${card} flex gap-3`}>
          <ShieldCheck className="h-6 w-6 shrink-0 text-[#1d6b34]" aria-hidden="true" />
          <div>
            <h2 className="text-base font-extrabold text-[var(--ink)]">{t('privacyTitle')}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('privacyText')}</p>
          </div>
        </div>
      </section>

      <details className={`${card} group`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-base font-extrabold text-[var(--ink)]">
          {t('infoTitle')}
          <span className="text-xl text-[var(--gold)] transition-transform group-open:rotate-45" aria-hidden="true">
            +
          </span>
        </summary>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <dl className="space-y-3 text-sm">
            {(['info1', 'info2', 'info3', 'info4'] as const).map((key) => (
              <div key={key}>
                <dt className="font-bold text-[var(--ink)]">{t(`${key}Title`)}</dt>
                <dd className="text-[var(--muted)]">{t(key)}</dd>
              </div>
            ))}
          </dl>
          <div className="text-sm">
            <p className="font-bold text-[var(--ink)]">{t('rulesTitle')}</p>
            <ul className="mt-1.5 space-y-1.5 text-[var(--muted)]">
              {(['rule1', 'rule2', 'rule3', 'rule4', 'rule5'] as const).map((key) => (
                <li key={key}>• {t(key)}</li>
              ))}
            </ul>
            <Link href="/terms" className="mt-3 inline-flex min-h-10 items-center font-bold text-[#7a5a14] hover:underline">
              {t('termsLink')}
            </Link>
          </div>
        </div>
      </details>
    </div>
  )
}
