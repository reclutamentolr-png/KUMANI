'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Check, Download, FileVideo, File as FileIcon, FolderOpen, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, Wifi, X, Zap } from 'lucide-react'
import { hoplaReceived } from '@/app/actions/hopla'
import { createClient } from '@/lib/supabase/client'
import {
  HOPLA_CONNECT_TIMEOUT,
  HOPLA_ICE,
  HOPLA_MEMORY_WARN,
  formatBytes,
  hoplaChannel,
  newHoplaId,
  parseCtrl,
  safeFileName,
  withSuffix,
  type HoplaCtrl,
  type HoplaDevice,
  type HoplaFileMeta,
  type HoplaSignal,
} from '@/lib/hopla'

type Phase = 'starting' | 'waiting' | 'connecting' | 'connected' | 'asking' | 'receiving' | 'done' | 'failed' | 'lost'

type Received = { key: number; i: number; name: string; size: number; type: string; url: string | null; saved: boolean }

type DirHandle = FileSystemDirectoryHandle
type Writer = { write: (data: ArrayBuffer) => Promise<void>; close: () => Promise<void>; abort?: () => Promise<void> }
type PickerWindow = Window & { showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<DirHandle> }

const card = 'rounded-3xl border border-[var(--gold)]/25 bg-white p-5 shadow-[0_12px_30px_rgba(23,23,23,0.06)] sm:p-6'
const primary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--ink)] px-6 text-base font-bold text-[var(--gold-bright)] transition hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] disabled:opacity-50'
const secondary =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--gold)]/40 bg-white px-5 text-base font-bold text-[var(--ink)] transition hover:bg-[var(--gold-pale)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]'

const canPickFolder = () => typeof window !== 'undefined' && typeof (window as PickerWindow).showDirectoryPicker === 'function'

// Hoplà sul PC: mostra il codice QR, collega il telefono e riceve i file
// direttamente, salvandoli in una cartella (Chrome/Edge) o in memoria.
export default function HoplaReceiver() {
  const t = useTranslations('hopla')
  const locale = useLocale()
  const [nonce, setNonce] = useState(0)
  const [phase, setPhase] = useState<Phase>('starting')
  const [qr, setQr] = useState<string | null>(null)
  const [device, setDevice] = useState<HoplaDevice>('other')
  const [incoming, setIncoming] = useState<HoplaFileMeta[]>([])
  const [received, setReceived] = useState<Received[]>([])
  const [progress, setProgress] = useState({ bytes: 0, total: 0, speed: 0, file: 0 })
  const [folderName, setFolderName] = useState<string | null>(null)
  const [folderSupported, setFolderSupported] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const dcRef = useRef<RTCDataChannel | null>(null)
  const peerRef = useRef<string | null>(null)
  // Indirizzi di rete arrivati prima della risposta del telefono: in attesa
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirRef = useRef<DirHandle | null>(null)
  const queueRef = useRef<Promise<void>>(Promise.resolve())
  const incomingRef = useRef<HoplaFileMeta[]>([])
  const currentRef = useRef<{ meta: HoplaFileMeta; name: string; writer: Writer | null; chunks: ArrayBuffer[]; handle: FileSystemFileHandle | null } | null>(null)
  const bytesRef = useRef(0)
  const startRef = useRef(0)
  const urlsRef = useRef<string[]>([])
  const seqRef = useRef(0)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFolderSupported(canPickFolder())
  }, [])

  const send = useCallback((payload: HoplaSignal) => {
    channelRef.current?.send({ type: 'broadcast', event: 'signal', payload })
  }, [])

  const sendCtrl = (msg: HoplaCtrl) => {
    const dc = dcRef.current
    if (dc?.readyState === 'open') dc.send(JSON.stringify(msg))
  }

  const closePeer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    dcRef.current?.close()
    pcRef.current?.close()
    dcRef.current = null
    pcRef.current = null
    peerRef.current = null
    iceQueueRef.current = []
    const current = currentRef.current
    currentRef.current = null
    current?.writer?.abort?.().catch(() => {})
  }, [])

  // Un file arrivato a metà va scartato
  const dropCurrent = async () => {
    const current = currentRef.current
    currentRef.current = null
    if (!current) return
    await current.writer?.abort?.().catch(() => {})
    if (current.handle && dirRef.current) await dirRef.current.removeEntry(current.name).catch(() => {})
  }

  const uniqueName = async (base: string) => {
    const dir = dirRef.current
    if (!dir) return base
    for (let n = 0; n < 500; n++) {
      const name = n === 0 ? base : withSuffix(base, n)
      try {
        await dir.getFileHandle(name)
      } catch {
        return name
      }
    }
    return withSuffix(base, Date.now())
  }

  const handleMessage = async (data: string | ArrayBuffer) => {
    if (typeof data !== 'string') {
      const current = currentRef.current
      if (!current) return
      if (current.writer) await current.writer.write(data)
      else current.chunks.push(data)
      bytesRef.current += data.byteLength
      return
    }
    const msg = parseCtrl(data)
    if (!msg) return
    if (msg.t === 'offer') {
      const files = (Array.isArray(msg.files) ? msg.files : [])
        .slice(0, 1000)
        .map((f, i) => ({ i, name: safeFileName(f.name, i), size: Math.max(0, Number(f.size) || 0), type: String(f.type ?? '').slice(0, 100) }))
      if (!files.length) return
      incomingRef.current = files
      setIncoming(files)
      setPhase('asking')
    } else if (msg.t === 'start') {
      const meta = incomingRef.current[msg.i]
      if (!meta) return
      await dropCurrent()
      const dir = dirRef.current
      if (dir) {
        const name = await uniqueName(meta.name)
        const handle = await dir.getFileHandle(name, { create: true })
        const writer = (await handle.createWritable()) as unknown as Writer
        currentRef.current = { meta, name, writer, chunks: [], handle }
      } else {
        currentRef.current = { meta, name: meta.name, writer: null, chunks: [], handle: null }
      }
      setProgress((p) => ({ ...p, file: msg.i }))
    } else if (msg.t === 'end') {
      const current = currentRef.current
      if (!current || current.meta.i !== msg.i) return
      currentRef.current = null
      let url: string | null = null
      if (current.writer) {
        await current.writer.close()
        // Anteprima solo per le immagini non enormi
        if (current.meta.type.startsWith('image/') && current.meta.size < 25 * 1024 * 1024 && current.handle) {
          url = URL.createObjectURL(await current.handle.getFile())
        }
      } else {
        url = URL.createObjectURL(new Blob(current.chunks, { type: current.meta.type || 'application/octet-stream' }))
      }
      if (url) urlsRef.current.push(url)
      setReceived((list) => [...list, { key: ++seqRef.current, i: current.meta.i, name: current.name, size: current.meta.size, type: current.meta.type, url, saved: !!current.writer }])
      sendCtrl({ t: 'saved', i: msg.i })
    } else if (msg.t === 'done') {
      setPhase('done')
      hoplaReceived().catch(() => {})
    } else if (msg.t === 'cancel') {
      await dropCurrent()
      setPhase('connected')
    }
  }

  // Tutti i messaggi in fila: le scritture su disco sono asincrone
  const enqueue = (data: string | ArrayBuffer) => {
    queueRef.current = queueRef.current.then(() => handleMessage(data)).catch((error) => {
      console.error('[hopla] ricezione:', error)
      sendCtrl({ t: 'cancel' })
      setPhase('lost')
    })
  }

  const setupChannel = (dc: RTCDataChannel) => {
    dc.binaryType = 'arraybuffer'
    dc.onopen = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setPhase('connected')
    }
    dc.onmessage = (e) => enqueue(e.data as string | ArrayBuffer)
    dc.onclose = () => {
      if (dcRef.current !== dc) return
      // Il telefono si è scollegato: si libera il posto per ricollegarsi allo stesso codice
      closePeer()
      setPhase('lost')
    }
  }

  const connect = async (peer: string) => {
    closePeer()
    peerRef.current = peer
    const pc = new RTCPeerConnection({ iceServers: HOPLA_ICE })
    pcRef.current = pc
    const dc = pc.createDataChannel('hopla', { ordered: true })
    dcRef.current = dc
    setupChannel(dc)
    pc.onicecandidate = (e) => {
      if (e.candidate) send({ kind: 'ice', peer, from: 'pc', candidate: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState !== 'failed' || pcRef.current !== pc) return
      closePeer()
      setPhase((p) => (p === 'connecting' ? 'failed' : 'lost'))
    }
    timerRef.current = setTimeout(() => {
      if (dc.readyState !== 'open' && pcRef.current === pc) {
        closePeer()
        setPhase('failed')
      }
    }, HOPLA_CONNECT_TIMEOUT)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ kind: 'offer', peer, sdp: offer })
  }

  const onSignal = async (s: HoplaSignal) => {
    if (!s || typeof s !== 'object') return
    if (s.kind === 'hello') {
      // Saluto ripetuto dallo stesso telefono mentre ci si sta già collegando
      if (s.peer === peerRef.current && pcRef.current) return
      const busy = peerRef.current && peerRef.current !== s.peer && dcRef.current?.readyState === 'open'
      if (busy) {
        send({ kind: 'busy', peer: s.peer })
        return
      }
      setDevice(s.device)
      setPhase('connecting')
      await connect(s.peer)
    } else if (s.peer !== peerRef.current) {
      return
    } else if (s.kind === 'answer') {
      const pc = pcRef.current
      if (!pc || pc.remoteDescription) return
      await pc.setRemoteDescription(s.sdp)
      for (const candidate of iceQueueRef.current.splice(0)) await pc.addIceCandidate(candidate).catch(() => {})
    } else if (s.kind === 'ice' && s.from === 'phone') {
      const pc = pcRef.current
      if (!pc) return
      if (!pc.remoteDescription) iceQueueRef.current.push(s.candidate)
      else await pc.addIceCandidate(s.candidate).catch(() => {})
    } else if (s.kind === 'bye' && s.from === 'phone') {
      closePeer()
      setPhase('waiting')
    }
  }
  const onSignalRef = useRef(onSignal)
  useEffect(() => {
    onSignalRef.current = onSignal
  })

  // Codice nuovo a ogni apertura (o con «Nuovo codice»)
  useEffect(() => {
    const id = newHoplaId()
    const prefix = locale === 'it' ? '' : `/${locale}`
    const link = `${window.location.origin}${prefix}/hopla/${id}`
    let cancelled = false
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(link, { width: 560, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#171717', light: '#ffffff' } }))
      .then((url) => {
        if (!cancelled) setQr(url)
      })
    const supabase = createClient()
    const channel = supabase.channel(hoplaChannel(id), { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        onSignalRef.current(payload as HoplaSignal).catch((error) => {
          console.error('[hopla] segnale:', error)
          setPhase('failed')
        })
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setPhase((p) => (p === 'starting' ? 'waiting' : p))
      })
    channelRef.current = channel
    return () => {
      cancelled = true
      if (peerRef.current) channel.send({ type: 'broadcast', event: 'signal', payload: { kind: 'bye', peer: peerRef.current, from: 'pc' } })
      closePeer()
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [nonce, locale, closePeer])

  // Le anteprime si liberano quando si esce dalla pagina
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), [])

  // Avanzamento 4 volte al secondo
  useEffect(() => {
    if (phase !== 'receiving') return
    const timer = setInterval(() => {
      const seconds = (performance.now() - startRef.current) / 1000
      setProgress((p) => ({ ...p, bytes: bytesRef.current, speed: seconds > 0.5 ? bytesRef.current / seconds : 0 }))
    }, 250)
    return () => clearInterval(timer)
  }, [phase])

  const totalIncoming = incoming.reduce((sum, f) => sum + f.size, 0)

  const accept = async (withFolder: boolean) => {
    if (withFolder) {
      try {
        const dir = await (window as PickerWindow).showDirectoryPicker!({ mode: 'readwrite', id: 'hopla' })
        dirRef.current = dir
        setFolderName(dir.name)
      } catch {
        return // scelta annullata: si resta sulla domanda
      }
    } else {
      dirRef.current = null
      setFolderName(null)
    }
    bytesRef.current = 0
    startRef.current = performance.now()
    setProgress({ bytes: 0, total: totalIncoming, speed: 0, file: 0 })
    setPhase('receiving')
    sendCtrl({ t: 'accept' })
  }

  const refuse = () => {
    sendCtrl({ t: 'refuse' })
    setIncoming([])
    setPhase('connected')
  }

  const downloadAll = async () => {
    for (const item of received) {
      if (!item.url || item.saved) continue
      const a = document.createElement('a')
      a.href = item.url
      a.download = item.name
      a.click()
      await new Promise((r) => setTimeout(r, 400))
    }
  }

  const restart = () => {
    setPhase('starting')
    setQr(null)
    setIncoming([])
    setNonce((n) => n + 1)
  }

  const deviceName = t(`devices.${device}`)
  const percent = progress.total > 0 ? Math.min(100, Math.round((progress.bytes / progress.total) * 100)) : 0
  const showQr = phase === 'starting' || phase === 'waiting' || phase === 'connecting' || phase === 'failed' || phase === 'lost'

  return (
    <div className="space-y-5">
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
              {(['step1', 'step2', 'step3'] as const).map((step, index) => (
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

      {phase === 'connected' && (
        <section className={`${card} flex items-center gap-4`} role="status">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#e6f4ea] text-[#1d6b34]">
            <Smartphone className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-lg font-extrabold text-[var(--ink)]">{t('connected', { device: deviceName })}</p>
            <p className="text-sm text-[var(--muted)]">{received.length ? t('sendMore') : t('phoneChoosing')}</p>
          </div>
        </section>
      )}

      {phase === 'asking' && (
        <section className={`${card} space-y-4`} aria-labelledby="hopla-ask">
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--ink)] text-[var(--gold-bright)]">
              <Zap className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 id="hopla-ask" className="text-xl font-extrabold text-[var(--ink)]">
                {t('askTitle', { device: deviceName, count: incoming.length })}
              </h2>
              <p className="text-sm text-[var(--muted)]">{t('askSize', { size: formatBytes(totalIncoming, locale) })}</p>
            </div>
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-2xl bg-[var(--background)] p-3 text-sm text-[var(--ink)]">
            {incoming.slice(0, 50).map((f) => (
              <li key={f.i} className="flex justify-between gap-3">
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 tabular-nums text-[var(--muted)]">{formatBytes(f.size, locale)}</span>
              </li>
            ))}
            {incoming.length > 50 && <li className="text-[var(--muted)]">{t('andMore', { count: incoming.length - 50 })}</li>}
          </ul>
          {!folderSupported && totalIncoming > HOPLA_MEMORY_WARN && <p className="rounded-2xl bg-[#fff4e5] p-3 text-sm text-[#7a4a00]">{t('memoryWarn')}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {folderSupported ? (
              <>
                <button type="button" onClick={() => accept(true)} className={primary}>
                  <FolderOpen className="h-5 w-5" aria-hidden="true" /> {t('acceptFolder')}
                </button>
                <button type="button" onClick={() => accept(false)} className={secondary}>
                  <Download className="h-5 w-5" aria-hidden="true" /> {t('acceptNoFolder')}
                </button>
              </>
            ) : (
              <button type="button" onClick={() => accept(false)} className={primary}>
                <Check className="h-5 w-5" aria-hidden="true" /> {t('accept')}
              </button>
            )}
            <button type="button" onClick={refuse} className={`${secondary} text-[#a12a2a]`}>
              <X className="h-5 w-5" aria-hidden="true" /> {t('refuse')}
            </button>
          </div>
        </section>
      )}

      {phase === 'receiving' && (
        <section className={`${card} space-y-3`} aria-labelledby="hopla-progress">
          <h2 id="hopla-progress" className="flex items-center gap-2 text-xl font-extrabold text-[var(--ink)]">
            <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" aria-hidden="true" /> {t('receiving')}
          </h2>
          <div className="h-3 overflow-hidden rounded-full bg-[var(--background)]" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label={t('receiving')}>
            <div className="h-full rounded-full bg-[var(--gold)] transition-[width] duration-200" style={{ width: `${percent}%` }} />
          </div>
          <p className="flex flex-wrap justify-between gap-2 text-sm tabular-nums text-[var(--muted)]">
            <span>{t('progress', { done: formatBytes(progress.bytes, locale), total: formatBytes(progress.total, locale) })}</span>
            <span>
              {t('fileOf', { n: Math.min(received.length + 1, incoming.length), count: incoming.length })}
              {progress.speed > 0 ? ` · ${t('speed', { speed: formatBytes(progress.speed, locale) })}` : ''}
            </span>
          </p>
          {folderName && <p className="text-sm text-[var(--muted)]">{t('savingIn', { folder: folderName })}</p>}
        </section>
      )}


      {received.length > 0 && (
        <section className={`${card} space-y-4`} aria-labelledby="hopla-received">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="hopla-received" className="text-xl font-extrabold text-[var(--ink)]">
                {phase === 'done' ? t('doneTitle', { count: received.length }) : t('receivedTitle', { count: received.length })}
              </h2>
              {folderName && received.some((r) => r.saved) && <p className="text-sm text-[var(--muted)]">{t('savedIn', { folder: folderName })}</p>}
            </div>
            {received.some((r) => !r.saved) && (
              <button type="button" onClick={downloadAll} className={primary}>
                <Download className="h-5 w-5" aria-hidden="true" /> {t('downloadAll')}
              </button>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {received.map((item) => (
              <li key={item.key} className="overflow-hidden rounded-2xl border border-[var(--gold)]/20 bg-[var(--background)]">
                <div className="flex aspect-square items-center justify-center bg-white">
                  {item.url && item.type.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : item.type.startsWith('video/') ? (
                    <FileVideo className="h-10 w-10 text-[var(--gold)]" aria-hidden="true" />
                  ) : (
                    <FileIcon className="h-10 w-10 text-[var(--gold)]" aria-hidden="true" />
                  )}
                </div>
                <div className="space-y-1 p-2.5">
                  <p className="truncate text-sm font-semibold text-[var(--ink)]" title={item.name}>
                    {item.name}
                  </p>
                  <p className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                    <span className="tabular-nums">{formatBytes(item.size, locale)}</span>
                    {item.saved ? (
                      <span className="inline-flex items-center gap-1 font-bold text-[#1d6b34]">
                        <Check className="h-3.5 w-3.5" aria-hidden="true" /> {t('saved')}
                      </span>
                    ) : item.url ? (
                      <a href={item.url} download={item.name} className="inline-flex min-h-8 items-center gap-1 font-bold text-[#7a5a14] hover:underline">
                        <Download className="h-3.5 w-3.5" aria-hidden="true" /> {t('download')}
                      </a>
                    ) : null}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {phase === 'done' && <p className="text-sm text-[var(--muted)]">{t('sendMore')}</p>}
        </section>
      )}

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
    </div>
  )
}
