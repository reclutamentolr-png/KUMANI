'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  AudioLines,
  Download,
  FastForward,
  FlipHorizontal2,
  Palette,
  Pause,
  Play,
  Rabbit,
  Rewind,
  RotateCcw,
  RotateCw,
  Share2,
  SlidersHorizontal,
  Square,
  Timer,
  Turtle,
  Video,
  VideoOff,
  X,
} from 'lucide-react'
import { lumenDone } from '@/app/actions/lumen'
import { formatDuration, pickRecorderType, safeFileName, speedToPxPerSecond } from '@/lib/lumen'

type Format = 'vertical' | 'horizontal'
type Font = 'sans' | 'serif' | 'mono' | 'rounded'
type Settings = {
  speed: number
  fontSize: number
  countdown: number
  camera: boolean
  format: Format
  voice: boolean
  mirror: boolean
  rotate: boolean
  font: Font
  color: string
  line: number
}
type Result = { url: string; blob: Blob; ext: 'mp4' | 'webm' }
type Panel = 'palette' | 'settings' | null

const SETTINGS_KEY = 'kumani:lumen:settings:v2'
const DEFAULTS: Settings = { speed: 20, fontSize: 40, countdown: 3, camera: true, format: 'vertical', voice: false, mirror: false, rotate: false, font: 'sans', color: '#ffffff', line: 0.5 }
const FONT_MIN = 20
const FONT_MAX = 90
const FONTS: Record<Font, string> = {
  sans: 'inherit',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, Menlo, Consolas, monospace',
  rounded: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif',
}
const COLORS = ['#ffffff', '#ffe45c', '#e7c56a', '#7cfc9a', '#7fdbff', '#ff9ec7']
const LINE_HEIGHT = 1.35
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function readSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Partial<Settings> | null
    if (!raw) return DEFAULTS
    return {
      speed: clamp(Number(raw.speed) || DEFAULTS.speed, 1, 50),
      fontSize: clamp(Number(raw.fontSize) || DEFAULTS.fontSize, FONT_MIN, FONT_MAX),
      countdown: clamp(Number.isFinite(Number(raw.countdown)) ? Number(raw.countdown) : DEFAULTS.countdown, 0, 10),
      camera: raw.camera !== false,
      format: raw.format === 'horizontal' ? 'horizontal' : 'vertical',
      voice: raw.voice === true,
      mirror: raw.mirror === true,
      rotate: raw.rotate === true,
      font: raw.font && raw.font in FONTS ? raw.font : DEFAULTS.font,
      color: typeof raw.color === 'string' && COLORS.includes(raw.color) ? raw.color : DEFAULTS.color,
      line: clamp(Number(raw.line) || DEFAULTS.line, 0.15, 0.75),
    }
  } catch {
    return DEFAULTS
  }
}

// Teleprompter a tutto schermo: la fotocamera frontale (a specchio) fa da
// sfondo e il testo scorre; la riga da leggere è quella sulla linea dorata,
// che si sposta trascinandola. Modalità AI: il testo avanza solo mentre si
// parla (volume del microfono, tutto nel telefono). Si registra con
// MediaRecorder: nel video c'è solo la fotocamera, non il testo, e il file
// resta nel telefono.
export default function LumenPrompter({ title, text, onClose }: { title: string; text: string; onClose: () => void }) {
  const t = useTranslations('lumen')
  const [settings, setSettings] = useState<Settings>(readSettings)
  const [panel, setPanel] = useState<Panel>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState(false)
  const [micError, setMicError] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [finished, setFinished] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [height, setHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)

  const videoRef = useRef<HTMLVideoElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const offset = useRef(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const drag = useRef<{ y: number; start: number; moved: boolean } | null>(null)
  const lineDrag = useRef(false)
  const awarded = useRef(false)
  const audioCtx = useRef<AudioContext | null>(null)
  const voiceActive = useRef(false)
  const countdownTimer = useRef<number | null>(null)

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

  // Posizione della linea di lettura (in pixel dall'alto del testo)
  const lineY = Math.round(height * settings.line)
  const lineStep = settings.fontSize * LINE_HEIGHT
  const maxOffset = Math.max(0, contentHeight - lineStep)

  const paint = () => {
    if (textRef.current) textRef.current.style.transform = `translate3d(0, ${-offset.current}px, 0)`
  }

  // Misure dello schermo e del testo (cambiano con rotazione e grandezza del carattere)
  useLayoutEffect(() => {
    const inner = () => textRef.current?.querySelector<HTMLElement>('[data-lumen-text]')
    const measure = () => {
      setHeight(viewportRef.current?.clientHeight ?? 0)
      const el = inner()
      // Altezza del solo testo, senza lo spazio vuoto in fondo
      setContentHeight(el ? el.scrollHeight - parseFloat(getComputedStyle(el).paddingBottom || '0') : 0)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (viewportRef.current) ro.observe(viewportRef.current)
    const el = inner()
    if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [settings.fontSize, settings.font])

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
    const vertical = settings.format === 'vertical'
    if (!navigator.mediaDevices) {
      queueMicrotask(() => setCameraError(true))
      return
    }
    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: 'user', aspectRatio: { ideal: vertical ? 9 / 16 : 16 / 9 }, width: { ideal: vertical ? 1080 : 1920 }, height: { ideal: vertical ? 1920 : 1080 } },
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((track) => track.stop())
        own = s
        setCameraError(false)
        setStream(s)
      })
      .catch(() => !cancelled && setCameraError(true))
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
    const ctx = audioCtx
    return () => {
      void lock?.release().catch(() => {})
      document.body.style.overflow = overflow
      void ctx.current?.close().catch(() => {})
    }
  }, [])

  // L'audio va acceso da un tocco (regola dei browser, soprattutto iPhone)
  const ensureAudio = () => {
    if (!audioCtx.current) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (Ctx) audioCtx.current = new Ctx()
    }
    void audioCtx.current?.resume().catch(() => {})
  }

  // Modalità AI: si ascolta il volume del microfono. Sopra il rumore di fondo
  // = stai parlando, e il testo avanza; dopo una breve pausa si ferma.
  useEffect(() => {
    if (!settings.voice) return
    let cancelled = false
    let mic: MediaStream | null = null
    let timer = 0
    let source: MediaStreamAudioSourceNode | null = null
    const start = async () => {
      const ctx = audioCtx.current
      if (!ctx) return
      let input = stream && stream.getAudioTracks().length ? stream : null
      if (!input) {
        try {
          mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
        } catch {
          if (!cancelled) setMicError(true)
          return
        }
        if (cancelled) return mic.getTracks().forEach((track) => track.stop())
        input = mic
      }
      setMicError(false)
      source = ctx.createMediaStreamSource(input)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 1024
      source.connect(analyser)
      const data = new Float32Array(analyser.fftSize)
      let floor = 0.01
      let lastVoice = 0
      timer = window.setInterval(() => {
        analyser.getFloatTimeDomainData(data)
        let sum = 0
        for (const v of data) sum += v * v
        const rms = Math.sqrt(sum / data.length)
        const now = performance.now()
        const loud = rms > Math.max(0.02, floor * 3)
        if (loud) lastVoice = now
        else floor = floor * 0.98 + rms * 0.02
        const active = now - lastVoice < 700
        if (active !== voiceActive.current) {
          voiceActive.current = active
          setSpeaking(active)
        }
      }, 50)
    }
    void start()
    return () => {
      cancelled = true
      window.clearInterval(timer)
      source?.disconnect()
      mic?.getTracks().forEach((track) => track.stop())
      voiceActive.current = false
      setSpeaking(false)
    }
  }, [settings.voice, stream])

  // Scorrimento (in modalità AI solo mentre si parla)
  useEffect(() => {
    if (!playing) return
    let frame = 0
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      if (!settings.voice || voiceActive.current) {
        offset.current = Math.min(maxOffset, offset.current + speedToPxPerSecond(settings.speed, settings.fontSize) * dt)
        paint()
      }
      if (offset.current >= maxOffset) {
        setPlaying(false)
        setFinished(true)
        award()
        return
      }
      frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
     
  }, [playing, settings.speed, settings.fontSize, settings.voice, maxOffset])

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

  // Conto alla rovescia, poi parte il testo (e la registrazione)
  const begin = (record: boolean) => {
    if (countdown !== null) return
    ensureAudio()
    setPanel(null)
    if (finished) {
      offset.current = 0
      paint()
      setFinished(false)
    }
    const go = () => {
      setCountdown(null)
      if (record) startRecording()
      setPlaying(true)
    }
    if (settings.countdown <= 0) return go()
    let n = settings.countdown
    setCountdown(n)
    countdownTimer.current = window.setInterval(() => {
      n -= 1
      if (n > 0) return setCountdown(n)
      if (countdownTimer.current) window.clearInterval(countdownTimer.current)
      countdownTimer.current = null
      go()
    }, 1000)
  }

  const togglePlay = () => (playing ? setPlaying(false) : begin(false))

  const restart = () => {
    offset.current = 0
    paint()
    setFinished(false)
  }

  const jump = (lines: number) => {
    offset.current = clamp(offset.current + lines * lineStep, 0, maxOffset)
    paint()
    if (offset.current < maxOffset) setFinished(false)
  }

  const close = () => {
    if (countdownTimer.current) window.clearInterval(countdownTimer.current)
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
        togglePlay()
      } else if (e.key === 'ArrowUp') update({ speed: Math.min(50, settings.speed + 2) })
      else if (e.key === 'ArrowDown') update({ speed: Math.max(1, settings.speed - 2) })
      else if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

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
  const estimate = formatDuration(Math.round(maxOffset / speedToPxPerSecond(settings.speed, settings.fontSize)))
  const round = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur hover:bg-white/25 disabled:opacity-40'
  const tool = (on: boolean) => `flex h-11 w-11 shrink-0 items-center justify-center rounded-xl disabled:opacity-40 ${on ? 'bg-[var(--gold)] text-[var(--ink)]' : 'text-white hover:bg-white/10'}`
  const transform = [settings.rotate ? 'rotate(180deg)' : '', settings.mirror ? 'scaleX(-1)' : ''].filter(Boolean).join(' ') || undefined

  const slider = (label: string, value: number, min: number, max: number, onChange: (v: number) => void, left: React.ReactNode, right: React.ReactNode) => (
    <label className="block">
      <span className="text-sm font-semibold">
        {label} <span className="tabular-nums text-white/70">{value}</span>
      </span>
      <span className="mt-1 flex items-center gap-3">
        {left}
        <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="h-2 flex-1 accent-[var(--gold)]" />
        {right}
      </span>
    </label>
  )

  return (
    <div className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label="KUMANI LUMEN">
      {settings.camera && stream && <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full -scale-x-100 object-cover" />}

      {/* Testo che scorre, con la linea di lettura */}
      <div
        ref={viewportRef}
        data-lumen-viewport
        className="absolute inset-0 cursor-pointer touch-none select-none"
        onWheel={(e) => !playing && jump(e.deltaY / lineStep)}
        onPointerDown={(e) => (drag.current = { y: e.clientY, start: offset.current, moved: false })}
        onPointerMove={(e) => {
          if (!drag.current || playing || lineDrag.current) return
          const d = (drag.current.y - e.clientY) * (settings.rotate ? -1 : 1)
          if (Math.abs(d) > 6) drag.current.moved = true
          offset.current = clamp(drag.current.start + d, 0, maxOffset)
          paint()
        }}
        onPointerUp={() => {
          const moved = drag.current?.moved
          drag.current = null
          if (moved || countdown !== null) return
          if (panel) return setPanel(null)
          togglePlay()
        }}
      >
        <div className="absolute inset-0" style={{ transform }}>
          <div className="absolute inset-0 overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_10%,black_76%,transparent_90%)]">
            <div ref={textRef} className="will-change-transform" style={{ paddingTop: Math.max(0, lineY - lineStep * 0.75) }}>
              <div
                data-lumen-text
                className={`mx-auto max-w-3xl whitespace-pre-wrap pb-[100vh] pl-6 pr-14 sm:pl-10 sm:pr-16 [text-shadow:0_2px_8px_rgba(0,0,0,0.85)] ${settings.font === 'serif' ? 'font-normal' : 'font-bold'}`}
                style={{ fontSize: settings.fontSize, lineHeight: LINE_HEIGHT, color: settings.color, fontFamily: FONTS[settings.font] }}
              >
                {text}
              </div>
            </div>
          </div>
          {/* Linea di lettura */}
          <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: lineY }}>
            <span className="h-0 w-0 -translate-y-px border-y-[10px] border-l-[14px] border-y-transparent border-l-[var(--gold-bright)]" />
            <span className="h-0.5 flex-1 bg-[var(--gold-bright)]/70" />
          </div>
        </div>
        {/* Maniglia per spostare la linea in alto o in basso */}
        <button
          type="button"
          aria-label={t('lineHandle')}
          title={t('lineHint')}
          className="absolute right-2 z-20 flex h-10 w-10 -translate-y-1/2 touch-none items-center justify-center rounded-full border-2 border-[var(--gold-bright)] bg-black/50 backdrop-blur"
          style={{ top: settings.rotate ? height - lineY : lineY }}
          onPointerDown={(e) => {
            e.stopPropagation()
            lineDrag.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!lineDrag.current || !height) return
            e.stopPropagation()
            const ratio = clamp(e.clientY / height, settings.rotate ? 0.25 : 0.15, settings.rotate ? 0.85 : 0.75)
            update({ line: settings.rotate ? 1 - ratio : ratio })
          }}
          onPointerUp={(e) => {
            e.stopPropagation()
            lineDrag.current = false
          }}
        >
          <span className="flex flex-col gap-1">
            <span className="h-0.5 w-4 bg-[var(--gold-bright)]" />
            <span className="h-0.5 w-4 bg-[var(--gold-bright)]" />
          </span>
        </button>
      </div>

      {/* Barra in alto */}
      <div className="relative z-20 flex items-center justify-between gap-2 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.75rem)]">
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
              <button key={f} type="button" disabled={playing} onClick={() => update({ format: f })} className={`rounded-full px-3 py-1.5 ${settings.format === f ? 'bg-white text-black' : 'text-white'}`}>
                {f === 'vertical' ? '9:16' : '16:9'}
              </button>
            ))}
          </div>
        )}
        {settings.voice ? (
          <span className={`inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-xs font-bold backdrop-blur ${speaking ? 'bg-[var(--gold)] text-[var(--ink)]' : 'bg-white/15 text-white'}`}>
            <AudioLines className="h-4 w-4" /> {speaking ? t('aiSpeaking') : t('aiWaiting')}
          </span>
        ) : (
          <span className="w-11" />
        )}
      </div>

      {(cameraError && settings.camera) || micError ? (
        <p className="relative z-20 mx-auto mt-1 max-w-md rounded-xl bg-black/60 px-4 py-2 text-center text-sm backdrop-blur">{micError ? t('micError') : t('cameraError')}</p>
      ) : null}
      {finished && !recording && <p className="relative z-20 mx-auto mt-1 rounded-full bg-black/60 px-4 py-1.5 text-sm font-semibold backdrop-blur">{t('finished')}</p>}

      {countdown !== null && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30">
          <span className="text-8xl font-extrabold text-[var(--gold-bright)] [text-shadow:0_4px_20px_rgba(0,0,0,0.6)]">{countdown}</span>
        </div>
      )}

      {/* Comandi in basso */}
      <div className="relative z-20 mt-auto px-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {panel && (
          <div data-lumen-panel className="mx-auto mb-2 max-h-[55vh] max-w-xl space-y-4 overflow-y-auto rounded-2xl bg-[#161616]/95 p-4 backdrop-blur">
            {panel === 'settings' ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-3 text-sm font-semibold">
                    <input
                      type="checkbox"
                      checked={settings.voice}
                      onChange={(e) => {
                        ensureAudio()
                        update({ voice: e.target.checked })
                      }}
                      className="h-5 w-5 accent-[var(--gold)]"
                    />
                    <span>
                      {t('aiMode')}
                      <span className="block text-xs font-normal text-white/60">{t('aiHint')}</span>
                    </span>
                  </label>
                  <span className="shrink-0 rounded-xl bg-[var(--gold)]/20 px-3 py-2 text-lg font-extrabold tabular-nums text-[var(--gold-bright)]" title={t('estimate')}>
                    ~{estimate}
                  </span>
                </div>
                {slider(t('textSize'), settings.fontSize, FONT_MIN, FONT_MAX, (v) => update({ fontSize: v }), <span className="w-6 text-center text-sm font-bold">A</span>, <span className="w-6 text-center text-2xl font-bold">A</span>)}
                {slider(t('speed'), settings.speed, 1, 50, (v) => update({ speed: v }), <Turtle className="h-6 w-6 shrink-0" />, <Rabbit className="h-6 w-6 shrink-0" />)}
                {slider(t('countdownLabel'), settings.countdown, 0, 10, (v) => update({ countdown: v }), <Timer className="h-6 w-6 shrink-0" />, <span className="w-6" />)}
                <div className="flex items-center justify-between">
                  <button type="button" onClick={restart} disabled={playing || recording} aria-label={t('restart')} className={round}>
                    <RotateCcw className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => jump(-3)} aria-label={t('rewind')} className={round}>
                    <Rewind className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={togglePlay} disabled={countdown !== null} aria-label={playing ? t('pause') : t('play')} className={round}>
                    {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
                  </button>
                  <button type="button" onClick={() => jump(3)} aria-label={t('forward')} className={round}>
                    <FastForward className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={() => update({ rotate: !settings.rotate })} aria-label={t('rotate')} aria-pressed={settings.rotate} title={t('rotate')} className={settings.rotate ? tool(true) : round}>
                    <RotateCw className="h-5 w-5" />
                  </button>
                </div>
              </>
            ) : (
              <>
                <div>
                  <p className="mb-2 text-sm font-semibold">{t('fontLabel')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(FONTS) as Font[]).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => update({ font: f })}
                        className={`rounded-xl border px-3 py-2 text-left text-base ${settings.font === f ? 'border-[var(--gold)] bg-[var(--gold)]/15' : 'border-white/15'}`}
                        style={{ fontFamily: FONTS[f] }}
                      >
                        {t(`font_${f}`)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold">{t('colorLabel')}</p>
                  <div className="flex flex-wrap gap-3">
                    {COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => update({ color: c })}
                        aria-label={c}
                        aria-pressed={settings.color === c}
                        className={`h-10 w-10 rounded-full border-2 ${settings.color === c ? 'border-[var(--gold)] ring-2 ring-[var(--gold)]/50' : 'border-white/20'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Strumenti */}
        <div className="mx-auto mb-3 flex max-w-xl items-center justify-between rounded-2xl bg-[#161616]/90 px-2 py-1.5 backdrop-blur">
          <button type="button" disabled={recording} onClick={() => update({ camera: !settings.camera })} aria-label={settings.camera ? t('cameraOff') : t('cameraOn')} title={settings.camera ? t('cameraOff') : t('cameraOn')} className={tool(false)}>
            {settings.camera ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
          </button>
          <button
            type="button"
            onClick={() => {
              ensureAudio()
              update({ voice: !settings.voice })
            }}
            aria-label={t('aiMode')}
            aria-pressed={settings.voice}
            title={t('aiHint')}
            className={tool(settings.voice)}
          >
            <AudioLines className="h-6 w-6" />
          </button>
          <button type="button" onClick={() => update({ mirror: !settings.mirror })} aria-label={t('mirror')} aria-pressed={settings.mirror} title={t('mirror')} className={tool(settings.mirror)}>
            <FlipHorizontal2 className="h-6 w-6" />
          </button>
          <button type="button" onClick={() => setPanel(panel === 'palette' ? null : 'palette')} aria-label={t('palette')} aria-expanded={panel === 'palette'} className={tool(panel === 'palette')}>
            <Palette className="h-6 w-6" />
          </button>
          <button type="button" onClick={() => setPanel(panel === 'settings' ? null : 'settings')} aria-label={t('settings')} aria-expanded={panel === 'settings'} className={tool(panel === 'settings')}>
            <SlidersHorizontal className="h-6 w-6" />
          </button>
        </div>

        {/* Comandi principali */}
        <div className="mx-auto flex max-w-xl items-center justify-center gap-4">
          <button type="button" onClick={() => jump(-3)} aria-label={t('rewind')} className={round}>
            <Rewind className="h-5 w-5" />
          </button>
          {recording ? (
            <button type="button" onClick={stopRecording} aria-label={t('stop')} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white bg-red-600">
              <Square className="h-6 w-6" fill="currentColor" />
            </button>
          ) : canRecord ? (
            <button type="button" onClick={() => begin(true)} disabled={countdown !== null} aria-label={t('record')} title={t('record')} className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 border-white">
              <span className="h-11 w-11 rounded-full bg-red-600" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={togglePlay}
            disabled={countdown !== null}
            aria-label={playing ? t('pause') : t('play')}
            className={canRecord || recording ? round : 'flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[var(--gold)] text-[var(--ink)]'}
          >
            {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          </button>
          <button type="button" onClick={() => jump(3)} aria-label={t('forward')} className={round}>
            <FastForward className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Video registrato: guarda, scarica, condividi o rifai */}
      {result && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-black/90 p-5">
          <button type="button" onClick={close} aria-label={t('close')} className={`absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] ${round}`}>
            <X className="h-5 w-5" />
          </button>
          <p className="text-lg font-extrabold">{t('resultTitle')}</p>
          <video src={result.url} controls playsInline className="max-h-[55vh] max-w-full rounded-2xl bg-black" />
          <div className="flex w-full max-w-sm flex-col gap-2">
            <a href={result.url} download={`${safeFileName(title)}.${result.ext}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 font-extrabold text-[var(--ink)]">
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
