'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Camera, CameraOff, Download, Minus, Pause, Play, Plus, RotateCcw, Share2, Square, X } from 'lucide-react'
import { lumenDone } from '@/app/actions/lumen'
import { pickRecorderType, safeFileName, speedToPxPerSecond } from '@/lib/lumen'

type Format = 'vertical' | 'horizontal'
type Settings = { speed: number; fontSize: number; camera: boolean; format: Format }
type Result = { url: string; blob: Blob; ext: 'mp4' | 'webm' }

const SETTINGS_KEY = 'kumani:lumen:settings'
const DEFAULTS: Settings = { speed: 4, fontSize: 36, camera: true, format: 'vertical' }
const FONT_MIN = 20
const FONT_MAX = 80

function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<Settings> | null
    if (!raw) return DEFAULTS
    return {
      speed: Math.min(10, Math.max(1, Number(raw.speed) || DEFAULTS.speed)),
      fontSize: Math.min(FONT_MAX, Math.max(FONT_MIN, Number(raw.fontSize) || DEFAULTS.fontSize)),
      camera: raw.camera !== false,
      format: raw.format === 'horizontal' ? 'horizontal' : 'vertical',
    }
  } catch {
    return DEFAULTS
  }
}

// Teleprompter a tutto schermo: la fotocamera frontale (a specchio, come
// uno specchio vero) fa da sfondo e il testo scorre nella parte alta, vicino
// all'obiettivo, così si legge guardando in camera. Si registra con
// MediaRecorder: nel video c'è solo la fotocamera, non il testo, e il file
// resta nel telefono.
export default function LumenPrompter({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  const t = useTranslations('lumen')
  const [settings, setSettings] = useState<Settings>(readSettings)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [finished, setFinished] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const offset = useRef(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const drag = useRef<{ y: number; start: number; moved: boolean } | null>(null)
  const awarded = useRef(false)

  const update = (patch: Partial<Settings>) =>
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      } catch {
        // facoltativo
      }
      return next
    })

  const paint = () => {
    if (textRef.current) textRef.current.style.transform = `translate3d(0, ${-offset.current}px, 0)`
  }
  const maxOffset = () => Math.max(0, (textRef.current?.scrollHeight ?? 0) - (viewportRef.current?.clientHeight ?? 0) * 0.3)

  const award = () => {
    if (awarded.current) return
    awarded.current = true
    void lumenDone()
  }

  // Fotocamera frontale (con microfono, per registrare la voce)
  useEffect(() => {
    if (!settings.camera) return
    let cancelled = false
    let own: MediaStream | null = null
    const ratio = settings.format === 'vertical' ? 9 / 16 : 16 / 9
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: 'user', aspectRatio: { ideal: ratio }, width: { ideal: settings.format === 'vertical' ? 1080 : 1920 }, height: { ideal: settings.format === 'vertical' ? 1920 : 1080 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((track) => track.stop())
        own = s
        setCameraError(false)
        setStream(s)
      })
      .catch(() => !cancelled && setCameraError(true))
    if (!navigator.mediaDevices) queueMicrotask(() => setCameraError(true))
    return () => {
      cancelled = true
      own?.getTracks().forEach((track) => track.stop())
      setStream(null)
    }
  }, [settings.camera, settings.format])

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream
  }, [stream])

  // Lo schermo non si spegne mentre LUMEN è aperto; la pagina sotto non scorre
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> } }
    nav.wakeLock
      ?.request('screen')
      .then((l) => (lock = l))
      .catch(() => {})
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      void lock?.release().catch(() => {})
      document.body.style.overflow = overflow
    }
  }, [])

  // Scorrimento
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      offset.current = Math.min(maxOffset(), offset.current + speedToPxPerSecond(settings.speed, settings.fontSize) * dt)
      paint()
      if (offset.current >= maxOffset()) {
        setPlaying(false)
        setFinished(true)
        award()
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [playing, settings.speed, settings.fontSize])

  // Tempo di registrazione
  useEffect(() => {
    if (!recording) return
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250)
    return () => window.clearInterval(timer)
  }, [recording])

  const startRecording = useCallback(() => {
    const type = pickRecorderType()
    if (!stream || !type) return
    chunks.current = []
    const rec = new MediaRecorder(stream, { mimeType: type.mimeType })
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.current.push(e.data)
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: type.mimeType.split(';')[0] })
      if (blob.size > 0) setResult({ url: URL.createObjectURL(blob), blob, ext: type.ext })
      award()
    }
    rec.start(1000)
    recorder.current = rec
    setElapsed(0)
    setRecording(true)
  }, [stream])

  const stopRecording = () => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
    recorder.current = null
    setRecording(false)
    setPlaying(false)
  }

  // Conto alla rovescia 3-2-1, poi parte il testo (e la registrazione)
  const begin = (record: boolean) => {
    if (countdown !== null) return
    if (finished) {
      offset.current = 0
      paint()
      setFinished(false)
    }
    setCountdown(3)
    let n = 3
    const timer = window.setInterval(() => {
      n -= 1
      if (n > 0) return setCountdown(n)
      window.clearInterval(timer)
      setCountdown(null)
      if (record) startRecording()
      setPlaying(true)
    }, 1000)
  }

  const restart = () => {
    offset.current = 0
    paint()
    setFinished(false)
  }

  const close = () => {
    stopRecording()
    onClose()
  }

  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url)
    },
    [result]
  )

  // Tastiera dal computer: spazio pausa/riprendi, frecce velocità, Esc chiude
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (result) return
      if (e.key === ' ') {
        e.preventDefault()
        if (playing) setPlaying(false)
        else begin(false)
      } else if (e.key === 'ArrowUp') update({ speed: Math.min(10, settings.speed + 1) })
      else if (e.key === 'ArrowDown') update({ speed: Math.max(1, settings.speed - 1) })
      else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // A testo fermo si può scorrere a mano (dito, mouse, rotellina)
  const nudge = (delta: number) => {
    offset.current = Math.min(maxOffset(), Math.max(0, offset.current + delta))
    paint()
  }

  const share = async () => {
    if (!result) return
    const file = new File([result.blob], `${safeFileName(title)}.${result.ext}`, { type: result.blob.type })
    try {
      await navigator.share({ files: [file], title: title || 'KUMANI LUMEN' })
    } catch {
      // annullato
    }
  }
  const canShare = (() => {
    if (!result || typeof navigator === 'undefined' || !navigator.canShare) return false
    try {
      return navigator.canShare({ files: [new File([result.blob], `video.${result.ext}`, { type: result.blob.type })] })
    } catch {
      return false
    }
  })()

  const canRecord = !!stream && !!pickRecorderType()
  const mm = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  const round = 'flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 disabled:opacity-40'

  return (
    <div className="fixed inset-0 z-[90] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="KUMANI LUMEN">
      {/* Fotocamera a tutto schermo, a specchio */}
      {settings.camera && stream && (
        <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />
      )}

      {/* Barra in alto */}
      <div className="relative z-10 flex items-center justify-between gap-2 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <button type="button" onClick={close} aria-label={t('close')} className={round}>
          <X className="h-5 w-5" />
        </button>
        {recording ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-red-600 px-3 py-1.5 text-sm font-bold">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" /> REC {mm}
          </span>
        ) : (
          <div className="flex items-center gap-1 rounded-full bg-white/15 p-1 text-xs font-semibold backdrop-blur">
            {(['vertical', 'horizontal'] as const).map((f) => (
              <button
                key={f}
                type="button"
                disabled={playing}
                onClick={() => update({ format: f })}
                className={`rounded-full px-3 py-1.5 ${settings.format === f ? 'bg-white text-black' : 'text-white'}`}
              >
                {f === 'vertical' ? '9:16' : '16:9'}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          disabled={recording}
          onClick={() => update({ camera: !settings.camera })}
          aria-label={settings.camera ? t('cameraOff') : t('cameraOn')}
          title={settings.camera ? t('cameraOff') : t('cameraOn')}
          className={round}
        >
          {settings.camera ? <CameraOff className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
        </button>
      </div>

      {/* Testo che scorre, vicino alla fotocamera */}
      <div
        ref={viewportRef}
        className="relative z-10 mx-auto h-[46%] w-full max-w-3xl cursor-pointer touch-none select-none overflow-hidden px-5 [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_80%,transparent)] sm:px-8"
        onWheel={(e) => !playing && nudge(e.deltaY)}
        onPointerDown={(e) => (drag.current = { y: e.clientY, start: offset.current, moved: false })}
        onPointerMove={(e) => {
          if (!drag.current || playing) return
          const d = drag.current.y - e.clientY
          if (Math.abs(d) > 6) drag.current.moved = true
          offset.current = Math.min(maxOffset(), Math.max(0, drag.current.start + d))
          paint()
        }}
        onPointerUp={() => {
          const moved = drag.current?.moved
          drag.current = null
          if (moved || countdown !== null) return
          if (playing) setPlaying(false)
          else begin(false)
        }}
      >
        <div className="pointer-events-none absolute inset-x-0 top-[30%] z-10 flex items-center" aria-hidden>
          <span className="h-0 w-0 border-y-[9px] border-l-[12px] border-y-transparent border-l-[var(--gold-bright)]" />
        </div>
        <div
          ref={textRef}
          className="whitespace-pre-wrap pb-[60vh] pt-[30%] font-bold will-change-transform [text-shadow:0_2px_8px_rgba(0,0,0,0.85)]"
          style={{ fontSize: settings.fontSize, lineHeight: 1.35 }}
        >
          {text}
        </div>
      </div>

      {cameraError && settings.camera && (
        <p className="relative z-10 mx-auto mt-2 max-w-md rounded-xl bg-white/15 px-4 py-2 text-center text-sm backdrop-blur">{t('cameraError')}</p>
      )}
      {finished && !recording && (
        <p className="relative z-10 mx-auto mt-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold backdrop-blur">{t('finished')}</p>
      )}

      {/* Conto alla rovescia */}
      {countdown !== null && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
          <span className="text-8xl font-extrabold text-[var(--gold-bright)] [text-shadow:0_4px_20px_rgba(0,0,0,0.6)]">{countdown}</span>
        </div>
      )}

      {/* Comandi */}
      <div className="relative z-10 mt-auto px-3 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-1 sm:gap-2">
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-0.5 sm:gap-1">
              <button type="button" onClick={() => update({ speed: Math.max(1, settings.speed - 1) })} aria-label={t('slower')} className={round}>
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-5 text-center text-sm font-bold tabular-nums">{settings.speed}</span>
              <button type="button" onClick={() => update({ speed: Math.min(10, settings.speed + 1) })} aria-label={t('faster')} className={round}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <span className="text-[11px] font-semibold text-white/80">{t('speed')}</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button type="button" onClick={restart} disabled={playing || recording} aria-label={t('restart')} className={round}>
              <RotateCcw className="h-5 w-5" />
            </button>
            {recording ? (
              <button type="button" onClick={stopRecording} aria-label={t('stop')} className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-red-600">
                <Square className="h-6 w-6" fill="currentColor" />
              </button>
            ) : canRecord ? (
              <button type="button" onClick={() => begin(true)} disabled={countdown !== null} aria-label={t('record')} title={t('record')} className="flex h-14 w-14 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-transparent">
                <span className="h-9 w-9 rounded-full bg-red-600 sm:h-11 sm:w-11" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (playing ? setPlaying(false) : begin(false))}
              disabled={countdown !== null}
              aria-label={playing ? t('pause') : t('play')}
              className={canRecord || recording ? round : 'flex h-16 w-16 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--ink)]'}
            >
              {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
            </button>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-0.5 sm:gap-1">
              <button type="button" onClick={() => update({ fontSize: Math.max(FONT_MIN, settings.fontSize - 4) })} aria-label={t('smaller')} className={round}>
                <span className="text-xs font-bold">A</span>
              </button>
              <button type="button" onClick={() => update({ fontSize: Math.min(FONT_MAX, settings.fontSize + 4) })} aria-label={t('bigger')} className={round}>
                <span className="text-lg font-bold">A</span>
              </button>
            </div>
            <span className="text-[11px] font-semibold text-white/80">{t('textSize')}</span>
          </div>
        </div>
      </div>

      {/* Video registrato: guarda, scarica, condividi o rifai */}
      {result && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/90 p-5">
          <button type="button" onClick={close} aria-label={t('close')} className={`absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] ${round}`}>
            <X className="h-5 w-5" />
          </button>
          <p className="text-lg font-extrabold">{t('resultTitle')}</p>
          <video src={result.url} controls playsInline className="max-h-[55vh] max-w-full rounded-2xl bg-black" />
          <div className="flex w-full max-w-sm flex-col gap-2">
            <a
              href={result.url}
              download={`${safeFileName(title)}.${result.ext}`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 font-extrabold text-[var(--ink)]"
            >
              <Download className="h-5 w-5" /> {t('download')}
            </a>
            {canShare && (
              <button type="button" onClick={share} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/40 px-4 font-bold">
                <Share2 className="h-5 w-5" /> {t('share')}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setResult(null)
                restart()
              }}
              className="min-h-11 rounded-xl px-4 text-sm font-semibold text-white/80 underline"
            >
              {t('retake')}
            </button>
          </div>
          <p className="max-w-sm text-center text-xs text-white/60">{t('privacy')}</p>
        </div>
      )}
    </div>
  )
}
