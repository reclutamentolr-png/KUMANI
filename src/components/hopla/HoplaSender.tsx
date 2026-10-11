'use client'

import { useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Check, ImagePlus, LoaderCircle, Monitor, Plus, RefreshCw, ScanLine, Send, Wifi, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import HoplaScanner from './HoplaScanner'
import {
  HOPLA_CHUNK,
  HOPLA_CONNECT_TIMEOUT,
  HOPLA_HIGH_WATER,
  HOPLA_ICE,
  HOPLA_LOW_WATER,
  detectDevice,
  formatBytes,
  hoplaChannel,
  newPeerId,
  parseCtrl,
  waitForBuffer,
  type HoplaCtrl,
  type HoplaSignal,
} from '@/lib/hopla'

type Phase = 'joining' | 'connecting' | 'ready' | 'waiting' | 'sending' | 'done' | 'refused' | 'expired' | 'busy' | 'failed' | 'lost'

type WakeLock = { release: () => Promise<void> }
type WakeNavigator = Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } }

const primary =
  'inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-lg font-bold text-[var(--gold-bright)] transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:opacity-50'
const secondary =
  'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-[var(--gold)]/40 bg-white px-5 text-base font-bold text-[var(--ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]'

// Hoplà sul telefono: si collega al PC del codice QR e invia foto e video
export default function HoplaSender({ id }: { id: string }) {
  const t = useTranslations('hopla')
  const locale = useLocale()
  const [phase, setPhase] = useState<Phase>('joining')
  const [files, setFiles] = useState<File[]>([])
  const [sentBytes, setSentBytes] = useState(0)
  const [sentFiles, setSentFiles] = useState(0)
  const [hidden, setHidden] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const peerRef = useRef('')
  // Ogni tentativo (anche «Ricollegati») rientra sullo stesso codice con un nuovo canale
  const [attempt, setAttempt] = useState(0)
  const [scanning, setScanning] = useState(false)
  const phaseRef = useRef<Phase>('joining')
  const savedRef = useRef<{ last: number; resolve: (() => void) | null }>({ last: -1, resolve: null })
  const acceptRef = useRef<((ok: boolean) => void) | null>(null)
  const wakeRef = useRef<WakeLock | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const go = (next: Phase) => {
    phaseRef.current = next
    setPhase(next)
  }

  const sendCtrl = (msg: HoplaCtrl) => dcRef.current?.send(JSON.stringify(msg))

  useEffect(() => {
    const peer = newPeerId()
    peerRef.current = peer
    const supabase = createClient()
    const channel = supabase.channel(hoplaChannel(id), { config: { broadcast: { self: false } } })
    const signal = (payload: HoplaSignal) => channel.send({ type: 'broadcast', event: 'signal', payload })
    let helloTimer: ReturnType<typeof setInterval> | null = null
    let expireTimer: ReturnType<typeof setTimeout> | null = null
    let connectTimer: ReturnType<typeof setTimeout> | null = null
    // Indirizzi di rete del PC arrivati prima che l'offerta sia applicata
    const iceQueue: RTCIceCandidateInit[] = []
    let gotOffer = false

    const onCtrl = (msg: HoplaCtrl) => {
      if (msg.t === 'accept') acceptRef.current?.(true)
      else if (msg.t === 'refuse') acceptRef.current?.(false)
      else if (msg.t === 'saved') {
        setSentFiles((n) => Math.max(n, msg.i + 1))
        if (msg.i === savedRef.current.last) savedRef.current.resolve?.()
      } else if (msg.t === 'cancel') go('lost')
    }

    const onOffer = async (sdp: RTCSessionDescriptionInit) => {
      // Una sola offerta per collegamento
      if (gotOffer) return
      gotOffer = true
      if (helloTimer) clearInterval(helloTimer)
      if (expireTimer) clearTimeout(expireTimer)
      pcRef.current?.close()
      const pc = new RTCPeerConnection({ iceServers: HOPLA_ICE })
      pcRef.current = pc
      go('connecting')
      pc.onicecandidate = (e) => {
        if (e.candidate) signal({ kind: 'ice', peer, from: 'phone', candidate: e.candidate.toJSON() })
      }
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') go(phaseRef.current === 'connecting' ? 'failed' : 'lost')
      }
      pc.ondatachannel = (e) => {
        const dc = e.channel
        dc.binaryType = 'arraybuffer'
        dc.bufferedAmountLowThreshold = HOPLA_LOW_WATER
        dcRef.current = dc
        dc.onopen = () => {
          if (connectTimer) clearTimeout(connectTimer)
          go('ready')
        }
        dc.onmessage = (m) => {
          if (typeof m.data !== 'string') return
          const msg = parseCtrl(m.data)
          if (msg) onCtrl(msg)
        }
        dc.onclose = () => {
          if (!['done', 'refused', 'expired', 'busy', 'failed'].includes(phaseRef.current)) go('lost')
          else if (phaseRef.current === 'done') go('lost')
        }
      }
      connectTimer = setTimeout(() => {
        if (dcRef.current?.readyState !== 'open') go('failed')
      }, HOPLA_CONNECT_TIMEOUT)
      await pc.setRemoteDescription(sdp)
      for (const candidate of iceQueue.splice(0)) await pc.addIceCandidate(candidate).catch(() => {})
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      signal({ kind: 'answer', peer, sdp: answer })
    }

    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        const s = payload as HoplaSignal
        if (!s || s.peer !== peer) return
        if (s.kind === 'offer') onOffer(s.sdp).catch(() => go('failed'))
        else if (s.kind === 'ice' && s.from === 'pc') {
          const pc = pcRef.current
          if (!pc || !pc.remoteDescription) iceQueue.push(s.candidate)
          else pc.addIceCandidate(s.candidate).catch(() => {})
        }
        else if (s.kind === 'busy') {
          if (helloTimer) clearInterval(helloTimer)
          if (expireTimer) clearTimeout(expireTimer)
          go('busy')
        } else if (s.kind === 'bye' && s.from === 'pc') go('lost')
      })
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        const hello = () => signal({ kind: 'hello', peer, device: detectDevice(navigator.userAgent) })
        hello()
        // Ripete il saluto: il PC potrebbe essersi appena collegato
        helloTimer = setInterval(hello, 3000)
        expireTimer = setTimeout(() => {
          if (helloTimer) clearInterval(helloTimer)
          if (phaseRef.current === 'joining') go('expired')
        }, 12_000)
      })
    channelRef.current = channel

    const onLeave = () => signal({ kind: 'bye', peer, from: 'phone' })
    window.addEventListener('pagehide', onLeave)
    return () => {
      window.removeEventListener('pagehide', onLeave)
      if (helloTimer) clearInterval(helloTimer)
      if (expireTimer) clearTimeout(expireTimer)
      if (connectTimer) clearTimeout(connectTimer)
      onLeave()
      dcRef.current?.close()
      pcRef.current?.close()
      supabase.removeChannel(channel)
    }
  }, [id, attempt])

  // Con lo schermo spento o un'altra app davanti l'invio si ferma: lo diciamo
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const total = files.reduce((sum, f) => sum + f.size, 0)

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    // Copia subito: svuotare il campo qui sotto svuota anche la FileList
    const picked = Array.from(list)
    setFiles((prev) => [...prev, ...picked].slice(0, 1000))
    if (inputRef.current) inputRef.current.value = ''
  }

  const sendAll = async () => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open' || !files.length) return
    go('waiting')
    setSentBytes(0)
    setSentFiles(0)
    sendCtrl({ t: 'offer', files: files.map((f, i) => ({ i, name: f.name, size: f.size, type: f.type })) })
    const ok = await new Promise<boolean>((resolve) => {
      acceptRef.current = resolve
    })
    acceptRef.current = null
    if (!ok) {
      go('refused')
      return
    }
    go('sending')
    try {
      wakeRef.current = (await (navigator as WakeNavigator).wakeLock?.request('screen')) ?? null
    } catch {
      wakeRef.current = null
    }
    const maxSize = pcRef.current?.sctp?.maxMessageSize
    const chunk = maxSize ? Math.min(HOPLA_CHUNK, maxSize) : HOPLA_CHUNK
    const allSaved = new Promise<void>((resolve) => {
      savedRef.current = { last: files.length - 1, resolve }
    })
    let sent = 0
    try {
      for (const [i, file] of files.entries()) {
        sendCtrl({ t: 'start', i })
        for (let offset = 0; offset < file.size; offset += chunk) {
          if (dc.readyState !== 'open') throw new Error('closed')
          if (dc.bufferedAmount > HOPLA_HIGH_WATER) await waitForBuffer(dc)
          const buffer = await file.slice(offset, offset + chunk).arrayBuffer()
          dc.send(buffer)
          sent += buffer.byteLength
          setSentBytes(sent)
        }
        sendCtrl({ t: 'end', i })
      }
      await allSaved
      sendCtrl({ t: 'done' })
      go('done')
    } catch {
      go('lost')
    } finally {
      wakeRef.current?.release().catch(() => {})
      wakeRef.current = null
    }
  }

  const retry = () => {
    dcRef.current = null
    pcRef.current = null
    go('joining')
    setAttempt((n) => n + 1)
  }

  // Codice letto dalla fotocamera: se è lo stesso ci si ricollega, altrimenti si apre il nuovo
  const onScanned = (path: string, scannedId: string) => {
    setScanning(false)
    if (scannedId === id) retry()
    else window.location.assign(path)
  }

  const again = () => {
    setFiles([])
    setSentBytes(0)
    setSentFiles(0)
    go('ready')
  }

  const percent = total > 0 ? Math.min(100, Math.round((sentBytes / total) * 100)) : 0

  return (
    <div className="space-y-5" aria-live="polite">
      {(phase === 'joining' || phase === 'connecting') && (
        <section className="flex flex-col items-center gap-4 py-10 text-center" role="status">
          <LoaderCircle className="h-10 w-10 animate-spin text-[var(--gold)]" aria-hidden="true" />
          <p className="text-lg font-bold text-[var(--ink)]">{t('phoneConnecting')}</p>
        </section>
      )}

      {(phase === 'ready' || phase === 'waiting' || phase === 'sending') && (
        <>
          <p className="flex items-center justify-center gap-2 rounded-full bg-[#e6f4ea] px-4 py-2 text-sm font-bold text-[#1d6b34]" role="status">
            <Monitor className="h-4 w-4" aria-hidden="true" /> {t('phoneConnected')}
          </p>
          <input ref={inputRef} type="file" multiple accept="image/*,video/*" className="sr-only" id="hopla-files" onChange={(e) => addFiles(e.target.files)} />
          {files.length === 0 ? (
            <label htmlFor="hopla-files" className="flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-[var(--gold)]/50 bg-white p-6 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
                <ImagePlus className="h-8 w-8" aria-hidden="true" />
              </span>
              <span className="text-xl font-extrabold text-[var(--ink)]">{t('phonePick')}</span>
              <span className="text-sm text-[var(--muted)]">{t('phonePickHint')}</span>
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

          {phase === 'ready' && files.length > 0 && (
            <button type="button" onClick={sendAll} className={primary}>
              <Send className="h-5 w-5" aria-hidden="true" /> {t('phoneSend')}
            </button>
          )}
          {phase === 'waiting' && (
            <p className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--gold-pale)] p-4 text-center font-bold text-[var(--ink)]" role="status">
              <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" aria-hidden="true" /> {t('phoneWaiting')}
            </p>
          )}
          {phase === 'sending' && (
            <section className="space-y-2" role="status">
              <div className="h-3 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('phoneSending')}>
                <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-200" style={{ width: `${percent}%` }} />
              </div>
              <p className="text-center text-sm font-bold text-[var(--ink)]">
                {percent}% · {t('progress', { done: formatBytes(sentBytes, locale), total: formatBytes(total, locale) })}
              </p>
              <p className="rounded-2xl bg-[#fff4e5] p-3 text-center text-sm font-semibold text-[#7a4a00]">{hidden ? t('phoneHidden') : t('phoneSending')}</p>
            </section>
          )}
        </>
      )}

      {phase === 'done' && (
        <section className="flex flex-col items-center gap-4 py-8 text-center" role="status">
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e6f4ea] text-[#1d6b34]">
            <Check className="h-10 w-10" strokeWidth={2.6} aria-hidden="true" />
          </span>
          <p className="text-2xl font-extrabold text-[var(--ink)]">{t('phoneDone', { count: files.length })}</p>
          <button type="button" onClick={again} className={primary}>
            <Plus className="h-5 w-5" aria-hidden="true" /> {t('phoneSendMore')}
          </button>
        </section>
      )}

      {phase === 'refused' && (
        <section className="space-y-4 py-6 text-center" role="alert">
          <p className="text-xl font-extrabold text-[var(--ink)]">{t('phoneRefused')}</p>
          <button type="button" onClick={again} className={secondary}>
            {t('phoneSendMore')}
          </button>
        </section>
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
          {files.length > 0 && <p className="text-xs text-[var(--muted)]">{t('phoneKeptFiles', { count: files.length })}</p>}
        </section>
      )}
      {scanning && <HoplaScanner onClose={() => setScanning(false)} onFound={onScanned} />}
    </div>
  )
}
