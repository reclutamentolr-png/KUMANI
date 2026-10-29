'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { LoaderCircle, Monitor, RefreshCw, ScanLine, Wifi } from 'lucide-react'
import HoplaScanner from './HoplaScanner'
import HoplaReceivePanel from './HoplaReceivePanel'
import HoplaSendPanel from './HoplaSendPanel'
import { useHoplaGuest } from './useHoplaGuest'

const primary =
  'inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-lg font-bold text-[var(--gold-bright)] transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:opacity-50'
const secondary =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--gold)]/40 bg-white px-5 text-base font-bold text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]'

// Hoplà sul telefono che ha inquadrato il codice: se l'altro dispositivo
// riceve, qui si scelgono e inviano i file; se invia, qui si ricevono.
export default function HoplaGuest({ id }: { id: string }) {
  const t = useTranslations('hopla')
  const { phase, hostMode, hostDevice, link, retry } = useHoplaGuest(id)
  const [scanning, setScanning] = useState(false)
  // Qui si invia quando l'altro dispositivo riceve
  const sending = hostMode === 'get'
  const hostName = t(`devices.${hostDevice}`)
  const connected = phase === 'ready'

  // Codice letto dalla fotocamera: se è lo stesso ci si ricollega, altrimenti si apre il nuovo
  const onScanned = (path: string, scannedId: string) => {
    setScanning(false)
    if (scannedId === id) retry()
    else window.location.assign(path)
  }

  return (
    <div className="space-y-5" aria-live="polite">
      {(phase === 'joining' || phase === 'connecting') && (
        <section className="flex flex-col items-center gap-4 py-10 text-center" role="status">
          <LoaderCircle className="h-10 w-10 animate-spin text-[var(--gold)]" aria-hidden="true" />
          <p className="text-lg font-bold text-[var(--ink)]">{t('phoneConnecting')}</p>
        </section>
      )}

      {connected && (
        <div className="space-y-1 text-center">
          <p className="flex items-center justify-center gap-2 rounded-full bg-[#e6f4ea] px-4 py-2 text-sm font-bold text-[#1d6b34]" role="status">
            <Monitor className="h-4 w-4" aria-hidden="true" /> {t('connected', { device: hostName })}
          </p>
          <p className="text-sm text-[var(--muted)]">{sending ? t('guestSendHint') : t('guestGetHint', { device: hostName })}</p>
        </div>
      )}

      {['expired', 'busy', 'failed', 'lost'].includes(phase) && (
        <section className="space-y-3 rounded-3xl border border-[var(--gold)]/25 bg-white p-5 text-center" role="alert">
          <Wifi className="mx-auto h-8 w-8 text-[#a12a2a]" aria-hidden="true" />
          <p className="text-lg font-extrabold text-[var(--ink)]">
            {phase === 'expired' ? t('phoneExpired') : phase === 'busy' ? t('phoneBusy') : phase === 'failed' ? t('failedTitle') : t('lostTitle')}
          </p>
          {(phase === 'failed' || phase === 'lost') && <p className="text-sm text-[var(--muted)]">{phase === 'failed' ? t('failedText') : t('phoneLostText')}</p>}
          {(phase === 'failed' || phase === 'lost') && <p className="text-sm text-[var(--muted)]">{t('phoneNetworkHint')}</p>}
          <div className="space-y-2 pt-1">
            {phase !== 'busy' && (
              <button type="button" onClick={retry} className={primary}>
                <RefreshCw className="h-5 w-5" aria-hidden="true" /> {t('phoneRetry')}
              </button>
            )}
            <button type="button" onClick={() => setScanning(true)} className={phase === 'busy' ? primary : secondary}>
              <ScanLine className="h-5 w-5" aria-hidden="true" /> {t('phoneScan')}
            </button>
          </div>
        </section>
      )}

      {/* I pannelli restano montati: file scelti e ricevuti non si perdono se il collegamento cade */}
      <div className={sending && (connected || phase === 'lost' || phase === 'failed') ? '' : 'hidden'}>
        <HoplaSendPanel link={sending ? link : null} offlineHint={t('guestOffline')} />
      </div>
      <div className={sending ? 'hidden' : ''}>
        <HoplaReceivePanel link={sending ? null : link} peer={hostName} />
      </div>

      {scanning && <HoplaScanner onClose={() => setScanning(false)} onFound={onScanned} />}
    </div>
  )
}
