'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Check, FilePlus, LoaderCircle, Plus, Send, X } from 'lucide-react'
import { HOPLA_CHUNK, HOPLA_HIGH_WATER, formatBytes, linkCancel, linkSend, parseCtrl, waitForBuffer, type HoplaCtrl, type HoplaLink } from '@/lib/hopla'

type Phase = 'ready' | 'waiting' | 'sending' | 'done' | 'refused'

type WakeLock = { release: () => Promise<void>; released?: boolean; addEventListener?: (type: 'release', cb: () => void) => void }
type WakeNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } }

const primary =
  'inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-lg font-bold text-[var(--gold-bright)] transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:opacity-50'
const secondary =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--gold)]/40 bg-white px-5 text-base font-bold text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]'

type Props = {
  link: HoplaLink | null
  // Mentre si invia (dall'offerta alla fine): chi mostra il codice non cambia modalità
  onBusy?: (busy: boolean) => void
  onDone?: () => void
  // Testo sotto il pulsante quando l'altro dispositivo non è ancora collegato
  offlineHint?: string
}

// Hoplà, chi invia: sceglie i file (di qualsiasi tipo), li propone all'altro
// dispositivo e, se accetta, li manda a pezzi sul canale diretto. I file
// scelti restano pronti anche se il collegamento cade.
export default function HoplaSendPanel({ link, onBusy, onDone, offlineHint }: Props) {
  const t = useTranslations('hopla')
  const locale = useLocale()
  const [phase, setPhase] = useState<Phase>('ready')
  const [files, setFiles] = useState<File[]>([])
  const [sentBytes, setSentBytes] = useState(0)
  const [sentFiles, setSentFiles] = useState(0)
  const [hidden, setHidden] = useState(false)
  const [cancelled, setCancelled] = useState<'me' | 'peer' | null>(null)
  // Schermo tenuto acceso: true sì, false il browser non lo permette, null non serve ora
  const [awake, setAwake] = useState<boolean | null>(null)

  const phaseRef = useRef<Phase>('ready')
  // Annullamento: chi l'ha chiesto e come svegliare l'invio fermo in attesa
  const cancelRef = useRef<{ by: 'me' | 'peer' | 'lost' | null; wake: (() => void) | null }>({ by: null, wake: null })
  const savedRef = useRef<{ last: number; resolve: (() => void) | null }>({ last: -1, resolve: null })
  const acceptRef = useRef<((ok: boolean) => void) | null>(null)
  const wakeRef = useRef<WakeLock | null>(null)
  const sentRef = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const go = (next: Phase) => {
    phaseRef.current = next
    setPhase(next)
    onBusy?.(next === 'waiting' || next === 'sending')
  }

  const stopSending = (by: 'me' | 'peer' | 'lost') => {
    if (cancelRef.current.by) return
    cancelRef.current.by = by
    acceptRef.current?.(false)
    savedRef.current.resolve?.()
    cancelRef.current.wake?.()
  }

  const onCtrl = (msg: HoplaCtrl) => {
    if (msg.t === 'accept') acceptRef.current?.(true)
    else if (msg.t === 'refuse') acceptRef.current?.(false)
    else if (msg.t === 'saved') {
      setSentFiles((n) => Math.max(n, msg.i + 1))
      if (msg.i === savedRef.current.last) savedRef.current.resolve?.()
    } else if (msg.t === 'cancel') {
      // L'altro dispositivo ha annullato la ricezione
      if (phaseRef.current === 'waiting' || phaseRef.current === 'sending') stopSending('peer')
    }
  }
  const onCtrlRef = useRef(onCtrl)
  useEffect(() => {
    onCtrlRef.current = onCtrl
  })

  // I messaggi del collegamento arrivano qui
  useEffect(() => {
    if (!link) {
      // Collegamento caduto a metà: l'invio si ferma, i file restano pronti
      if (phaseRef.current === 'waiting' || phaseRef.current === 'sending') stopSending('lost')
      return
    }
    link.listen({
      onData: (data) => {
        const msg = typeof data === 'string' ? parseCtrl(data) : null
        if (msg) onCtrlRef.current(msg)
      },
      onCtrl: (msg) => onCtrlRef.current(msg),
    })
  }, [link])

  // Con lo schermo spento o un'altra app davanti l'invio si ferma: lo diciamo
  useEffect(() => {
    const onVisibility = () => {
      setHidden(document.visibilityState === 'hidden')
      // Il blocco dello schermo si perde quando la pagina va in secondo piano: lo si riprende
      if (document.visibilityState === 'visible' && (phaseRef.current === 'waiting' || phaseRef.current === 'sending')) keepAwake()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // Avanzamento 4 volte al secondo (non a ogni pezzo: sui telefoni lenti pesa)
  useEffect(() => {
    if (phase !== 'sending') return
    const timer = setInterval(() => setSentBytes(sentRef.current), 250)
    return () => clearInterval(timer)
  }, [phase])

  const total = files.reduce((sum, f) => sum + f.size, 0)

  // Tiene acceso lo schermo durante l'invio. Va chiesto subito al tocco su «Invia»:
  // più tardi il browser può non concederlo.
  function keepAwake() {
    const api = (navigator as WakeNavigator).wakeLock
    if (!api) {
      setAwake(false)
      return
    }
    if (wakeRef.current && !wakeRef.current.released) return
    api
      .request('screen')
      .then((lock) => {
        wakeRef.current = lock
        setAwake(true)
        lock.addEventListener?.('release', () => {
          if (wakeRef.current === lock) setAwake(document.visibilityState === 'visible' ? false : null)
        })
      })
      .catch(() => setAwake(false))
  }

  function letSleep() {
    wakeRef.current?.release().catch(() => {})
    wakeRef.current = null
    setAwake(null)
  }

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    // Copia subito: svuotare il campo qui sotto svuota anche la FileList
    const picked = Array.from(list)
    setFiles((prev) => [...prev, ...picked].slice(0, 1000))
    if (inputRef.current) inputRef.current.value = ''
  }

  // Dopo un annullamento o un collegamento caduto si torna alla scelta, con gli stessi file
  const stopped = () => {
    const by = cancelRef.current.by
    setCancelled(by === 'me' || by === 'peer' ? by : null)
    go('ready')
  }

  const sendAll = async () => {
    const dc = link?.dc
    if (!link || !dc || dc.readyState !== 'open' || !files.length) return
    keepAwake()
    cancelRef.current = { by: null, wake: null }
    setCancelled(null)
    const cancelWait = new Promise<void>((resolve) => {
      cancelRef.current.wake = resolve
    })
    go('waiting')
    setSentBytes(0)
    setSentFiles(0)
    linkSend(link, { t: 'offer', files: files.map((f, i) => ({ i, name: f.name, size: f.size, type: f.type })) })
    const ok = await new Promise<boolean>((resolve) => {
      acceptRef.current = resolve
    })
    acceptRef.current = null
    if (!ok) {
      letSleep()
      if (cancelRef.current.by) stopped()
      else go('refused')
      return
    }
    sentRef.current = 0
    go('sending')
    keepAwake()
    const maxSize = link.pc.sctp?.maxMessageSize
    const chunk = maxSize ? Math.min(HOPLA_CHUNK, maxSize) : 64 * 1024
    const allSaved = new Promise<void>((resolve) => {
      savedRef.current = { last: files.length - 1, resolve }
    })
    let sent = 0
    try {
      for (const [i, file] of files.entries()) {
        linkSend(link, { t: 'start', i })
        for (let offset = 0; offset < file.size; offset += chunk) {
          if (cancelRef.current.by) break
          if (dc.readyState !== 'open') throw new Error('closed')
          if (dc.bufferedAmount > HOPLA_HIGH_WATER) await Promise.race([waitForBuffer(dc), cancelWait])
          if (cancelRef.current.by) break
          const buffer = await file.slice(offset, offset + chunk).arrayBuffer()
          dc.send(buffer)
          sent += buffer.byteLength
          sentRef.current = sent
        }
        if (cancelRef.current.by) break
        linkSend(link, { t: 'end', i })
      }
      setSentBytes(sent)
      if (!cancelRef.current.by) await Promise.race([allSaved, cancelWait])
      if (cancelRef.current.by) {
        stopped()
        return
      }
      linkSend(link, { t: 'done' })
      go('done')
      onDone?.()
    } catch {
      // Collegamento caduto: chi mostra il codice o la pagina del telefono lo dicono
      cancelRef.current.by = 'lost'
      stopped()
    } finally {
      letSleep()
    }
  }

  // «Annulla invio»: si ferma subito, l'altro dispositivo scarta il file a metà
  const cancelSend = () => {
    linkCancel(link)
    stopSending('me')
  }

  const again = () => {
    setCancelled(null)
    setFiles([])
    setSentBytes(0)
    setSentFiles(0)
    go('ready')
  }

  const percent = total > 0 ? Math.min(100, Math.round((sentBytes / total) * 100)) : 0

  if (phase === 'done') {
    return (
      <section className="flex flex-col items-center gap-4 py-8 text-center" role="status">
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e6f4ea] text-[#1d6b34]">
          <Check className="h-10 w-10" strokeWidth={2.6} aria-hidden="true" />
        </span>
        <p className="text-2xl font-extrabold text-[var(--ink)]">{t('sendDone', { count: files.length })}</p>
        <button type="button" onClick={again} className={primary}>
          <Plus className="h-5 w-5" aria-hidden="true" /> {t('phoneSendMore')}
        </button>
      </section>
    )
  }

  if (phase === 'refused') {
    return (
      <section className="space-y-4 py-6 text-center" role="alert">
        <p className="text-xl font-extrabold text-[var(--ink)]">{t('sendRefused')}</p>
        <button type="button" onClick={again} className={secondary}>
          {t('phoneSendMore')}
        </button>
      </section>
    )
  }

  return (
    <div className="space-y-4" aria-live="polite">
      <input ref={inputRef} type="file" multiple className="sr-only" id="hopla-files" onChange={(e) => addFiles(e.target.files)} />
      {files.length === 0 ? (
        <label htmlFor="hopla-files" className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[var(--gold)]/50 bg-white p-6 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
            <FilePlus className="h-8 w-8" aria-hidden="true" />
          </span>
          <span className="text-xl font-extrabold text-[var(--ink)]">{t('pickFiles')}</span>
          <span className="text-sm text-[var(--muted)]">{t('pickFilesHint')}</span>
        </label>
      ) : (
        <section className="space-y-3 rounded-3xl border border-[var(--gold)]/25 bg-white p-4">
          <p className="text-base font-extrabold text-[var(--ink)]">{t('phoneSelected', { count: files.length, size: formatBytes(total, locale) })}</p>
          <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
            {files.map((f, i) => (
              <li key={`${i}-${f.name}`} className="flex items-center gap-2">
                {phase === 'sending' && i < sentFiles ? <Check className="h-4 w-4 shrink-0 text-[#1d6b34]" aria-hidden="true" /> : null}
                <span className="min-w-0 flex-1 truncate text-[var(--ink)]">{f.name}</span>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">{formatBytes(f.size, locale)}</span>
                {phase === 'ready' && (
                  <button type="button" onClick={() => setFiles((prev) => prev.filter((_, k) => k !== i))} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--background)]" aria-label={t('phoneRemove', { name: f.name })}>
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          {phase === 'ready' && (
            <label htmlFor="hopla-files" className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 text-sm font-bold text-[#7a5a14]">
              <Plus className="h-4 w-4" aria-hidden="true" /> {t('phonePickMore')}
            </label>
          )}
        </section>
      )}

      {phase === 'ready' && cancelled && (
        <p className="rounded-2xl bg-[#fff4e5] p-3 text-center text-sm font-semibold text-[#7a4a00]" role="status">
          {cancelled === 'me' ? t('phoneCancelled') : t('sendCancelledByPeer')}
        </p>
      )}
      {phase === 'ready' && files.length > 0 && (
        <>
          <button type="button" onClick={sendAll} disabled={!link} className={primary}>
            <Send className="h-5 w-5" aria-hidden="true" /> {t('sendButton', { count: files.length })}
          </button>
          {!link && offlineHint && <p className="text-center text-sm text-[var(--muted)]">{offlineHint}</p>}
        </>
      )}
      {phase === 'waiting' && (
        <div className="space-y-2">
          <p className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--gold-pale)] p-4 text-center font-bold text-[var(--ink)]" role="status">
            <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" aria-hidden="true" /> {t('sendWaiting')}
          </p>
          <button type="button" onClick={cancelSend} className={`${secondary} text-[#a12a2a]`}>
            <X className="h-5 w-5" aria-hidden="true" /> {t('cancelSend')}
          </button>
        </div>
      )}
      {phase === 'sending' && (
        <section className="space-y-2" role="status">
          <div className="h-3 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('phoneSending')}>
            <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-200" style={{ width: `${percent}%` }} />
          </div>
          <p className="text-center text-sm font-bold text-[var(--ink)]">
            {percent}% · {t('progress', { done: formatBytes(sentBytes, locale), total: formatBytes(total, locale) })}
          </p>
          {hidden || awake === false ? (
            <p className="rounded-2xl bg-[#fff4e5] p-3 text-center text-sm font-semibold text-[#7a4a00]">{hidden ? t('phoneHidden') : t('phoneNoWake')}</p>
          ) : (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-[#e6f4ea] p-3 text-center text-sm font-semibold text-[#1d6b34]">
              <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> {awake ? t('phoneAwake') : t('phoneSending')}
            </p>
          )}
          <button type="button" onClick={cancelSend} className={`${secondary} text-[#a12a2a]`}>
            <X className="h-5 w-5" aria-hidden="true" /> {t('cancelSend')}
          </button>
        </section>
      )}
    </div>
  )
}
