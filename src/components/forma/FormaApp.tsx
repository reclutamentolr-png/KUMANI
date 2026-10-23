'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Download, FileVideo, LoaderCircle, Pause, Play, Scissors, Share2 } from 'lucide-react'
import { formaDone } from '@/app/actions/forma'
import { pickRecorderType, safeFileName } from '@/lib/lumen'

// Formati di uscita (larghezza × altezza in pixel)
const FORMATS = { vertical: [1080, 1920], square: [1080, 1080], portrait: [1080, 1350], landscape: [1920, 1080] } as const
type Format = keyof typeof FORMATS
type Fit = 'fill' | 'fit'
type Result = { url: string; blob: Blob; ext: 'mp4' | 'webm' }
const MAX_SECONDS = 300
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Un fotogramma del video nel formato scelto: «riempi» ritaglia (con la
// posizione scelta), «adatta» mostra tutto con lo stesso video sfocato dietro
function drawFrame(ctx: CanvasRenderingContext2D, v: HTMLVideoElement, W: number, H: number, fit: Fit, focus: number) {
  const vw = v.videoWidth
  const vh = v.videoHeight
  if (!vw || !vh) return
  if (fit === 'fill') {
    const s = Math.max(W / vw, H / vh)
    const w = vw * s
    const h = vh * s
    ctx.drawImage(v, (W - w) * focus, (H - h) / 2, w, h)
    return
  }
  const sb = Math.max(W / vw, H / vh) * 1.1
  ctx.save()
  ctx.filter = 'blur(28px) brightness(0.6)'
  ctx.drawImage(v, (W - vw * sb) / 2, (H - vh * sb) / 2, vw * sb, vh * sb)
  ctx.restore()
  const s = Math.min(W / vw, H / vh)
  ctx.drawImage(v, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s)
}

// KUMANI FORMA: taglia inizio e fine e adatta il video a 9:16, 1:1, 4:5 o
// 16:9. Tutto nel telefono: il video non passa dai server.
export default function FormaApp() {
  const t = useTranslations('forma')
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState(0)
  const [start, setStart] = useState(0)
  const [end, setEnd] = useState(0)
  const [format, setFormat] = useState<Format>('vertical')
  const [fit, setFit] = useState<Fit>('fill')
  const [focus, setFocus] = useState(0.5)
  const [mute, setMute] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [pct, setPct] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const cancel = useRef<(() => void) | null>(null)
  const [W, H] = FORMATS[format]

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url)
    },
    [url]
  )
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url)
    },
    [result]
  )

  // Anteprima nel formato scelto (in piccolo), aggiornata mentre il video va
  useEffect(() => {
    const v = videoRef.current
    const c = previewRef.current
    if (!v || !c || !url) return
    const scale = 360 / Math.max(W, H)
    c.width = Math.round(W * scale)
    c.height = Math.round(H * scale)
    const ctx = c.getContext('2d')!
    let frame = 0
    const paint = () => {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, c.width, c.height)
      drawFrame(ctx, v, c.width, c.height, fit, focus)
      if (!v.paused && v.currentTime >= end) {
        v.pause()
        v.currentTime = start
      }
      frame = requestAnimationFrame(paint)
    }
    paint()
    return () => cancelAnimationFrame(frame)
  }, [url, W, H, fit, focus, start, end])

  const pick = (f: File | undefined) => {
    if (!f) return
    setFile(f)
    setUrl(URL.createObjectURL(f))
    setResult(null)
    setError(null)
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      if (v.currentTime < start || v.currentTime >= end) v.currentTime = start
      void v.play()
    } else v.pause()
  }

  // Esportazione: il tratto scelto si riproduce su una tela del formato
  // giusto e si registra (immagine e audio), in tempo reale
  const exportVideo = async () => {
    const type = pickRecorderType()
    if (!url || !type) return setError(t('errorExport'))
    setError(null)
    setResult(null)
    setExporting(true)
    setPct(0)
    const v = document.createElement('video')
    v.src = url
    v.playsInline = true
    await new Promise<void>((res) => {
      v.onloadedmetadata = () => res()
      v.onerror = () => res()
    })
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    const stream = canvas.captureStream(30)
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new Ctx()
    if (!mute) {
      const dest = ac.createMediaStreamDestination()
      ac.createMediaElementSource(v).connect(dest)
      dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track))
    } else v.muted = true
    const chunks: Blob[] = []
    // Qualità in proporzione a quella del video caricato (e ai pixel del nuovo
    // formato): il browser comprime meno bene dell'originale, quindi un po' di
    // più, ma senza arrivare al doppio del peso
    const sourceBps = file && v.duration > 0 ? (file.size * 8) / v.duration : 4_000_000
    const pixels = v.videoWidth && v.videoHeight ? (W * H) / (v.videoWidth * v.videoHeight) : 1
    const videoBitsPerSecond = Math.round(Math.min(8_000_000, Math.max(2_500_000, sourceBps * pixels * 1.6)))
    const rec = new MediaRecorder(stream, { mimeType: type.mimeType, videoBitsPerSecond, audioBitsPerSecond: 128_000 })
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
    let stopped = false
    let frame = 0
    const finish = (ok: boolean) => {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(frame)
      v.pause()
      rec.onstop = () => {
        void ac.close().catch(() => {})
        cancel.current = null
        setExporting(false)
        if (!ok) return
        const blob = new Blob(chunks, { type: type.mimeType.split(';')[0] })
        setResult({ url: URL.createObjectURL(blob), blob, ext: type.ext })
        void formaDone()
      }
      if (rec.state !== 'inactive') rec.stop()
      else rec.onstop?.(new Event('stop'))
    }
    cancel.current = () => finish(false)
    const draw = () => {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      drawFrame(ctx, v, W, H, fit, focus)
      setPct(Math.min(100, Math.round(((v.currentTime - start) / Math.max(0.1, end - start)) * 100)))
      if (v.currentTime >= end || v.ended) return finish(true)
      if (!stopped) frame = requestAnimationFrame(draw)
    }
    v.currentTime = start
    await new Promise<void>((res) => (v.onseeked = () => res()))
    await ac.resume().catch(() => {})
    rec.start(1000)
    try {
      await v.play()
      draw()
    } catch {
      finish(false)
      setError(t('errorExport'))
    }
  }

  const share = async () => {
    if (!result) return
    try {
      await navigator.share({ files: [new File([result.blob], `${safeFileName(file?.name.replace(/\.[^.]+$/, '') ?? 'forma')}-${format}.${result.ext}`, { type: result.blob.type })] })
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

  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 text-gray-600 hover:border-[var(--gold)]/60'}`
  const tooLong = duration > MAX_SECONDS + 0.5

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--gold)]/50 bg-[var(--gold)]/5 px-4 font-bold text-[var(--ink)] hover:bg-[var(--gold)]/10">
          <FileVideo className="h-5 w-5 text-[var(--gold)]" />
          {file ? t('changeVideo') : t('chooseVideo')}
          <input type="file" accept="video/*" className="sr-only" disabled={exporting} onChange={(e) => pick(e.target.files?.[0])} />
        </label>
        {!file && <p className="mt-2 text-center text-xs text-[var(--muted)]">{t('chooseHint', { minutes: MAX_SECONDS / 60 })}</p>}
        {url && (
          <video
            ref={videoRef}
            src={url}
            playsInline
            muted={mute}
            className="hidden"
            onLoadedMetadata={(e) => {
              const d = e.currentTarget.duration
              setDuration(d)
              setStart(0)
              setEnd(Math.min(d, MAX_SECONDS))
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
        )}
      </section>

      {url && duration > 0 && (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
          <div className="relative mx-auto w-full max-w-[15rem]">
            <canvas ref={previewRef} className="block w-full rounded-2xl bg-black" aria-label={t('preview')} />
            <button type="button" onClick={togglePlay} aria-label={playing ? t('pause') : t('play')} className="absolute bottom-2 left-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white">
              {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
            </button>
          </div>

          <section className="space-y-4 rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
            {tooLong && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">{t('tooLong', { minutes: MAX_SECONDS / 60 })}</p>}
            <div>
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Scissors className="h-4 w-4 text-[var(--gold)]" /> {t('trim', { from: mmss(start), to: mmss(end), length: mmss(end - start) })}
              </p>
              <label className="mt-2 block text-xs font-semibold text-[var(--muted)]">
                {t('start')}
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={start}
                  onChange={(e) => {
                    const v = Math.min(Number(e.target.value), end - 0.5)
                    setStart(v)
                    if (videoRef.current) videoRef.current.currentTime = v
                    setResult(null)
                  }}
                  className="block w-full accent-[var(--gold)]"
                />
              </label>
              <label className="mt-1 block text-xs font-semibold text-[var(--muted)]">
                {t('end')}
                <input
                  type="range"
                  min={0}
                  max={duration}
                  step={0.1}
                  value={end}
                  onChange={(e) => {
                    const v = Math.min(Math.max(Number(e.target.value), start + 0.5), start + MAX_SECONDS)
                    setEnd(v)
                    if (videoRef.current) videoRef.current.currentTime = Math.max(start, v - 1.5)
                    setResult(null)
                  }}
                  className="block w-full accent-[var(--gold)]"
                />
              </label>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">{t('format')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(Object.keys(FORMATS) as Format[]).map((f) => (
                  <button key={f} type="button" aria-pressed={format === f} onClick={() => { setFormat(f); setResult(null) }} className={chip(format === f)}>
                    {t(`format_${f}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--ink)]">{t('fit')}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(['fill', 'fit'] as Fit[]).map((f) => (
                  <button key={f} type="button" aria-pressed={fit === f} onClick={() => { setFit(f); setResult(null) }} className={chip(fit === f)}>
                    {t(`fit_${f}`)}
                  </button>
                ))}
              </div>
              {fit === 'fill' && (
                <label className="mt-3 block text-xs font-semibold text-[var(--muted)]">
                  {t('focus')}
                  <input type="range" min={0} max={1} step={0.01} value={focus} onChange={(e) => { setFocus(Number(e.target.value)); setResult(null) }} className="block w-full accent-[var(--gold)]" />
                </label>
              )}
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold text-[var(--ink)]">
              <input type="checkbox" checked={mute} onChange={(e) => { setMute(e.target.checked); setResult(null) }} className="h-5 w-5 accent-[var(--gold)]" />
              {t('mute')}
            </label>

            {exporting ? (
              <div>
                <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
                  <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" /> {t('exporting', { pct })}
                </p>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">{t('exportingHint')}</p>
                <button type="button" onClick={() => cancel.current?.()} className="mt-2 text-sm font-semibold text-gray-600 underline">
                  {t('cancel')}
                </button>
              </div>
            ) : result ? (
              <div className="space-y-2">
                <p className="font-bold text-[var(--ink)]">{t('readyTitle')}</p>
                <a
                  href={result.url}
                  download={`${safeFileName(file?.name.replace(/\.[^.]+$/, '') ?? 'forma')}-${format}.${result.ext}`}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 font-extrabold text-[var(--ink)]"
                >
                  <Download className="h-5 w-5" /> {t('download')}
                </a>
                {canShare && (
                  <button type="button" onClick={share} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/50 px-4 font-bold">
                    <Share2 className="h-5 w-5" /> {t('share')}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <button type="button" onClick={exportVideo} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 font-extrabold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)]">
                  <Scissors className="h-5 w-5" /> {t('export')}
                </button>
                <p className="mt-1 text-center text-xs text-[var(--muted)]">{t('exportHint')}</p>
              </div>
            )}
            {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
            <p className="text-center text-xs text-[var(--muted)]">{t('privacy')}</p>
          </section>
        </div>
      )}
    </div>
  )
}
