'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Apple, Check, Copy, LoaderCircle, Nfc, Smartphone } from 'lucide-react'
import FoldSection from '@/components/FoldSection'

// Un link scritto su un adesivo o una tessera NFC: chi avvicina il telefono
// apre la pagina, su iPhone e su Android, senza app. Due usi:
// - 'card': Documenti → Biglietto da visita, link della pagina del biglietto;
// - 'review': Scheda attività, link diretto alle recensioni (es. Google), mai
//   un link KUMANI che rimanda altrove (da NFC Chrome su Android si blocca).
// Scrivere dal sito si può solo con Chrome su Android (Web NFC): Safari su
// iPhone non lo permette, lì si usa l'app gratuita NFC Tools.

// Web NFC non è ancora nei tipi di TypeScript
type NdefWriter = { write: (message: { records: { recordType: string; data: string }[] }, options?: { signal?: AbortSignal }) => Promise<void> }
type NdefWindow = Window & { NDEFReader?: new () => NdefWriter }

type Device = 'iphone' | 'android'
type WriteState = 'idle' | 'waiting' | 'done' | 'denied' | 'error'

export default function NfcTagSection({ kind, url }: { kind: 'card' | 'review'; url: string }) {
  const t = useTranslations('nfcTag')
  const [device, setDevice] = useState<Device>('android')
  const [canWrite, setCanWrite] = useState(false)
  const [state, setState] = useState<WriteState>('idle')
  const [copied, setCopied] = useState(false)
  const abort = useRef<AbortController | null>(null)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanWrite(typeof (window as NdefWindow).NDEFReader === 'function')
    if (/iPhone|iPad/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) setDevice('iphone')
    return () => abort.current?.abort()
  }, [])

  const write = async () => {
    const Reader = (window as NdefWindow).NDEFReader
    if (!Reader) return
    abort.current?.abort()
    const controller = new AbortController()
    abort.current = controller
    // Se nessun tag arriva entro un minuto si smette di aspettare
    const timer = setTimeout(() => controller.abort(), 60_000)
    setState('waiting')
    try {
      await new Reader().write({ records: [{ recordType: 'url', data: url }] }, { signal: controller.signal })
      setState('done')
    } catch (e) {
      const name = e instanceof DOMException ? e.name : ''
      if (name === 'AbortError') setState('idle')
      else setState(name === 'NotAllowedError' ? 'denied' : 'error')
    } finally {
      clearTimeout(timer)
    }
  }

  const cancel = () => {
    abort.current?.abort()
    setState('idle')
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // appunti non disponibili: il link resta visibile da selezionare
    }
  }

  const tab = (d: Device, label: string, Icon: typeof Apple) => (
    <button
      type="button"
      onClick={() => setDevice(d)}
      aria-pressed={device === d}
      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition ${device === d ? 'border-[var(--gold)] bg-[var(--gold-pale)] text-[var(--ink)]' : 'border-[var(--gold)]/20 text-[var(--muted)] hover:border-[var(--gold)]/60'}`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  )
  const steps = (keys: string[]) => (
    <ol className="mt-3 space-y-2">
      {keys.map((k, i) => (
        <li key={k} className="flex gap-3 text-sm text-[var(--ink)]">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-xs font-bold text-[var(--gold-bright)]">{i + 1}</span>
          <span className="pt-0.5">{t(k)}</span>
        </li>
      ))}
    </ol>
  )
  const box = 'rounded-xl border border-[var(--gold)]/20 bg-[var(--background)] p-4'

  return (
    <FoldSection className="mt-6" icon={<Nfc className="h-5 w-5 text-[var(--gold)]" />} title={t(`${kind}.title`)}>
      <p className="text-sm text-[var(--muted)]">{t(`${kind}.intro`)}</p>

      {/* Cosa serve */}
      <div className={`mt-4 ${box}`}>
        <h3 className="text-sm font-bold text-[var(--ink)]">{t('buyTitle')}</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">{t('buyText')}</p>
        <p className="mt-2 text-sm text-[var(--muted)]">{t('buyMetal')}</p>
      </div>

      {/* Dove attaccarlo (recensioni) */}
      {kind === 'review' && (
        <div className={`mt-4 ${box}`}>
          <h3 className="text-sm font-bold text-[var(--ink)]">{t('review.placeTitle')}</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">{t('review.placeText')}</p>
        </div>
      )}

      {/* Il link da scrivere */}
      <div className="mt-4">
        <p className="text-xs font-bold uppercase tracking-wider text-[var(--muted)]">{t('linkLabel')}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 break-all rounded-lg border border-[var(--gold)]/30 bg-[var(--gold-pale)] px-3 py-2 text-sm text-[var(--ink)]">{url}</code>
          <button type="button" onClick={copyLink} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--gold)]/50 px-4 py-2 text-sm font-bold text-[var(--ink)]">
            {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4 text-[var(--gold)]" />} {copied ? t('copied') : t('copy')}
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">{t(`${kind}.linkHint`)}</p>
      </div>

      {/* Come si scrive il tag */}
      <h3 className="mt-5 text-sm font-bold text-[var(--ink)]">{t('writeTitle')}</h3>
      <div className="mt-2 flex gap-2">
        {tab('iphone', 'iPhone', Apple)}
        {tab('android', 'Android', Smartphone)}
      </div>

      {device === 'android' ? (
        <div className={`mt-3 ${box}`}>
          {steps(['androidStep1', 'androidStep2', 'androidStep3', 'androidStep4'])}
          {canWrite ? (
            <div className="mt-4 space-y-2">
              {state === 'waiting' ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-xl bg-[var(--ink)] px-5 py-3 font-bold text-[var(--gold-bright)]">
                    <LoaderCircle className="h-5 w-5 animate-spin" /> {t('waiting')}
                  </span>
                  <button type="button" onClick={cancel} className="text-sm font-semibold text-[var(--muted)] underline">
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => void write()} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[var(--gold)] to-[var(--gold-bright)] px-5 py-3 font-extrabold text-[var(--ink)] shadow-sm transition hover:brightness-105">
                  <Nfc className="h-5 w-5" /> {t(state === 'done' ? 'writeAgain' : 'writeButton')}
                </button>
              )}
              {state === 'done' && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{t('done')}</p>}
              {state === 'denied' && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t('denied')}</p>}
              {state === 'error' && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t('error')}</p>}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('androidNoChrome')}</p>
          )}
          <p className="mt-3 text-xs text-[var(--muted)]">{t('androidAlt')}</p>
        </div>
      ) : (
        <div className={`mt-3 ${box}`}>
          <p className="text-sm text-[var(--muted)]">{t('iphoneIntro')}</p>
          {steps(['iphoneStep1', 'iphoneStep2', 'iphoneStep3', 'iphoneStep4', 'iphoneStep5'])}
          <p className="mt-3 text-xs text-[var(--muted)]">{t('iphoneModels')}</p>
        </div>
      )}

      {/* Come si legge */}
      <div className={`mt-4 ${box}`}>
        <h3 className="text-sm font-bold text-[var(--ink)]">{t(`${kind}.readTitle`)}</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--ink)]">
          <li>{t('readIphone')}</li>
          <li>{t('readIphoneOld')}</li>
          <li>{t('readAndroid')}</li>
        </ul>
      </div>

      {/* Consigli */}
      <div className={`mt-4 ${box}`}>
        <h3 className="text-sm font-bold text-[var(--ink)]">{t('tipsTitle')}</h3>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--ink)]">
          <li>{t('tipTest')}</li>
          <li>{t(`${kind}.tipUpdate`)}</li>
          <li>{t('tipLock')}</li>
          <li>{t(`${kind}.tipQr`)}</li>
        </ul>
      </div>
    </FoldSection>
  )
}
