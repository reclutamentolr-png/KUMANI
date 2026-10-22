'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Captions, Download, FileText, FileVideo, LoaderCircle, Pause, Play, RotateCcw, Share2, Sparkles } from 'lucide-react'
import { voxDone } from '@/app/actions/vox'
import { pickRecorderType, safeFileName } from '@/lib/lumen'
import {
  drawCaption,
  extractAudio,
  groupAt,
  groupWords,
  joinWords,
  retimeGroup,
  toSrt,
  VOX_DEFAULT_STYLE,
  VOX_HIGHLIGHTS,
  VOX_LANGUAGES,
  VOX_MAX_SECONDS,
  type VoxLanguage,
  type VoxPreset,
  type VoxSize,
  type VoxStyle,
  type VoxWord,
} from '@/lib/vox'

type Phase = 'idle' | 'audio' | 'download' | 'listening' | 'ready' | 'exporting'
type Quality = 'base' | 'small'
type Result = { url: string; blob: Blob; ext: 'mp4' | 'webm' }

const STYLE_KEY = 'kumani:vox:style'
const QUALITY_KEY = 'kumani:vox:quality'

function readStyle(): VoxStyle {
  try {
    const raw = JSON.parse(localStorage.getItem(STYLE_KEY) ?? 'null') as Partial<VoxStyle> | null
    if (!raw) return VOX_DEFAULT_STYLE
    return {
      preset: raw.preset === 'classic' || raw.preset === 'box' ? raw.preset : 'karaoke',
      size: raw.size === 's' || raw.size === 'l' ? raw.size : 'm',
      position: Math.min(0.9, Math.max(0.1, Number(raw.position) || VOX_DEFAULT_STYLE.position)),
      highlight: raw.highlight && VOX_HIGHLIGHTS.includes(raw.highlight) ? raw.highlight : VOX_DEFAULT_STYLE.highlight,
      upper: raw.upper !== false,
    }
  } catch {
    return VOX_DEFAULT_STYLE
  }
}
const save = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // facoltativo
  }
}
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// KUMANI VOX: scegli un video, la voce diventa testo nel telefono (Whisper),
// correggi le righe, scegli lo stile e scarichi il video con i sottotitoli
// dentro, o il file .srt. Il video non lascia mai il dispositivo.
export default function VoxApp() {
  const t = useTranslations('vox')
  const locale = useLocale()
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [tooLong, setTooLong] = useState(false)
  const [language, setLanguage] = useState<VoxLanguage>(locale in VOX_LANGUAGES ? (locale as VoxLanguage) : 'it')
  const [quality, setQuality] = useState<Quality>(() => {
    try {
      return localStorage.getItem(QUALITY_KEY) === '"base"' ? 'base' : 'small'
    } catch {
      return 'small'
    }
  })
  const [phase, setPhase] = useState<Phase>('idle')
  const [downloaded, setDownloaded] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [words, setWords] = useState<VoxWord[]>([])
  const [style, setStyle] = useState<VoxStyle>(readStyle)
  const [playing, setPlaying] = useState(false)
  const [exportPct, setExportPct] = useState(0)
  const [result, setResult] = useState<Result | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const files = useRef<Record<string, { loaded: number; total: number }>>({})
  const cancelExport = useRef<(() => void) | null>(null)

  const groups = useMemo(() => groupWords(words, style.preset), [words, style.preset])
  const updateStyle = (patch: Partial<VoxStyle>) =>
    setStyle((s) => {
      const next = { ...s, ...patch }
      save(STYLE_KEY, next)
      return next
    })

  useEffect(() => () => workerRef.current?.terminate(), [])
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

  const pick = (f: File | null) => {
    if (!f) return
    setFile(f)
    setUrl(URL.createObjectURL(f))
    setWords([])
    setResult(null)
    setError(null)
    setTooLong(false)
    setPhase('idle')
  }

  const transcribe = async () => {
    if (!file) return
    setError(null)
    setPhase('audio')
    let audio: Float32Array
    try {
      audio = (await extractAudio(file)).audio
    } catch {
      setPhase('idle')
      return setError(t('errorAudio'))
    }
    if (!workerRef.current) workerRef.current = new Worker('/workers/vox-worker.js', { type: 'module' })
    const worker = workerRef.current
    files.current = {}
    setDownloaded(0)
    setPhase('download')
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data as { type: string; file?: string; loaded?: number; total?: number; words?: { text: string; start: number; end: number }[]; message?: string }
      if (m.type === 'download' && m.file) {
        files.current[m.file] = { loaded: m.loaded ?? 0, total: m.total ?? 0 }
        const all = Object.values(files.current)
        const total = all.reduce((n, x) => n + x.total, 0)
        setDownloaded(total ? Math.round((all.reduce((n, x) => n + x.loaded, 0) / total) * 100) : 0)
      } else if (m.type === 'transcribing') setPhase('listening')
      else if (m.type === 'result') {
        const w = joinWords(m.words ?? [])
        setWords(w)
        setPhase('ready')
        if (!w.length) setError(t('errorNoVoice'))
      } else if (m.type === 'error') {
        console.error('[VOX]', m.message)
        setPhase('idle')
        setError(t('errorModel'))
      }
    }
    worker.postMessage({ type: 'transcribe', audio, language: VOX_LANGUAGES[language], model: quality }, [audio.buffer])
  }

  // Anteprima: i sottotitoli disegnati sopra il video, come nel video finale
  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || phase !== 'ready') return
    let frame = 0
    const paint = () => {
      const W = video.videoWidth || 720
      const H = video.videoHeight || 1280
      if (canvas.width !== W) canvas.width = W
      if (canvas.height !== H) canvas.height = H
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.clearRect(0, 0, W, H)
        drawCaption(ctx, W, H, groupAt(groups, video.currentTime), video.currentTime, style)
      }
      frame = requestAnimationFrame(paint)
    }
    paint()
    return () => cancelAnimationFrame(frame)
  }, [groups, style, phase])

  const editGroup = (index: number, text: string) => {
    // Le righe seguono l'ordine delle parole: si sostituiscono quelle della riga
    const g = groups[index]
    const from = groups.slice(0, index).reduce((n, x) => n + x.words.length, 0)
    setWords((all) => [...all.slice(0, from), ...retimeGroup(g, text), ...all.slice(from + g.words.length)])
  }

  const seek = (s: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = s
    void v.play()
  }

  // Esportazione: il video si riproduce dall'inizio su una tela con i
  // sottotitoli e si registra (immagine e audio), in tempo reale
  const exportVideo = async () => {
    const type = pickRecorderType()
    if (!url || !type) return setError(t('errorExport'))
    setError(null)
    setResult(null)
    setPhase('exporting')
    setExportPct(0)
    const video = document.createElement('video')
    video.src = url
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    await new Promise<void>((res, rej) => {
      video.onloadedmetadata = () => res()
      video.onerror = () => rej(new Error('load'))
    }).catch(() => null)
    const W = video.videoWidth
    const H = video.videoHeight
    if (!W || !H) {
      setPhase('ready')
      return setError(t('errorExport'))
    }
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d')!
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ac = new Ctx()
    const dest = ac.createMediaStreamDestination()
    ac.createMediaElementSource(video).connect(dest)
    const stream = canvas.captureStream(30)
    dest.stream.getAudioTracks().forEach((track) => stream.addTrack(track))
    const chunks: Blob[] = []
    const rec = new MediaRecorder(stream, { mimeType: type.mimeType, videoBitsPerSecond: 6_000_000 })
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data)
    let stopped = false
    let frame = 0
    const finish = (ok: boolean) => {
      if (stopped) return
      stopped = true
      cancelAnimationFrame(frame)
      video.pause()
      rec.onstop = () => {
        void ac.close().catch(() => {})
        cancelExport.current = null
        if (!ok) return setPhase('ready')
        const blob = new Blob(chunks, { type: type.mimeType.split(';')[0] })
        setResult({ url: URL.createObjectURL(blob), blob, ext: type.ext })
        setPhase('ready')
        void voxDone()
      }
      if (rec.state !== 'inactive') rec.stop()
      else rec.onstop?.(new Event('stop'))
    }
    cancelExport.current = () => finish(false)
    const draw = () => {
      ctx.drawImage(video, 0, 0, W, H)
      drawCaption(ctx, W, H, groupAt(groups, video.currentTime), video.currentTime, style)
      setExportPct(Math.min(100, Math.round((video.currentTime / (video.duration || 1)) * 100)))
      if (!stopped) frame = requestAnimationFrame(draw)
    }
    video.onended = () => {
      draw()
      finish(true)
    }
    await ac.resume().catch(() => {})
    draw()
    rec.start(1000)
    try {
      await video.play()
    } catch {
      finish(false)
      setError(t('errorExport'))
    }
  }

  const share = async () => {
    if (!result) return
    const f = new File([result.blob], `${safeFileName(file?.name.replace(/\.[^.]+$/, '') ?? 'vox')}-vox.${result.ext}`, { type: result.blob.type })
    try {
      await navigator.share({ files: [f] })
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
  // Il file .srt ha frasi intere (come lo stile Classico), comodo negli editor video
  const srtUrl = useMemo(() => (words.length ? URL.createObjectURL(new Blob([toSrt(groupWords(words, 'classic'))], { type: 'application/x-subrip' })) : null), [words])
  useEffect(
    () => () => {
      if (srtUrl) URL.revokeObjectURL(srtUrl)
    },
    [srtUrl]
  )

  const baseName = safeFileName(file?.name.replace(/\.[^.]+$/, '') ?? 'vox')
  const busy = phase === 'audio' || phase === 'download' || phase === 'listening'
  const chip = (on: boolean) => `rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--ink)]' : 'border-gray-200 text-gray-600 hover:border-[var(--gold)]/60'}`

  return (
    <div className="space-y-4">
      {/* 1 · Video */}
      <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
        <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[var(--gold)]/50 bg-[var(--gold)]/5 px-4 text-center font-bold text-[var(--ink)] hover:bg-[var(--gold)]/10">
          <FileVideo className="h-5 w-5 text-[var(--gold)]" />
          {file ? t('changeVideo') : t('chooseVideo')}
          <input type="file" accept="video/*" className="sr-only" disabled={busy || phase === 'exporting'} onChange={(e) => pick(e.target.files?.[0] ?? null)} />
        </label>
        {!file && <p className="mt-2 text-center text-xs text-[var(--muted)]">{t('chooseHint', { minutes: VOX_MAX_SECONDS / 60 })}</p>}

        {url && (
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
            <div className="relative mx-auto w-full max-w-[15rem] overflow-hidden rounded-2xl bg-black">
              <video
                ref={videoRef}
                src={url}
                playsInline
                className="block w-full"
                onLoadedMetadata={(e) => setTooLong(e.currentTarget.duration > VOX_MAX_SECONDS + 0.5)}
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onClick={(e) => (e.currentTarget.paused ? void e.currentTarget.play() : e.currentTarget.pause())}
              />
              <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
              <button
                type="button"
                onClick={() => {
                  const v = videoRef.current
                  if (!v) return
                  if (v.paused) void v.play()
                  else v.pause()
                }}
                aria-label={playing ? t('pause') : t('play')}
                className="absolute bottom-2 left-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white"
              >
                {playing ? <Pause className="h-4 w-4" fill="currentColor" /> : <Play className="h-4 w-4" fill="currentColor" />}
              </button>
            </div>

            <div className="space-y-4">
              {tooLong && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{t('tooLong', { minutes: VOX_MAX_SECONDS / 60 })}</p>}
              <label className="block text-sm font-semibold text-[var(--ink)]">
                {t('language')}
                <select
                  value={language}
                  disabled={busy}
                  onChange={(e) => setLanguage(e.target.value as VoxLanguage)}
                  className="mt-1 block w-full rounded-xl border border-gray-200 px-3 py-2.5 text-base"
                >
                  {(Object.keys(VOX_LANGUAGES) as VoxLanguage[]).map((l) => (
                    <option key={l} value={l}>
                      {t(`lang_${l}`)}
                    </option>
                  ))}
                </select>
              </label>
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">{t('quality')}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {(['small', 'base'] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setQuality(q)
                        save(QUALITY_KEY, q)
                      }}
                      aria-pressed={quality === q}
                      className={`rounded-xl border px-3 py-2 text-left ${quality === q ? 'border-[var(--gold)] bg-[var(--gold)]/10' : 'border-gray-200'}`}
                    >
                      <span className="block text-sm font-bold text-[var(--ink)]">{t(`quality_${q}`)}</span>
                      <span className="block text-xs text-[var(--muted)]">{t(`quality_${q}_hint`)}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                disabled={busy || tooLong || phase === 'exporting'}
                onClick={transcribe}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--ink)] px-4 font-extrabold text-[var(--gold-bright)] hover:bg-[var(--ink-soft)] disabled:opacity-50"
              >
                {busy ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                {phase === 'audio' ? t('stepAudio') : phase === 'download' ? t('stepDownload', { pct: downloaded }) : phase === 'listening' ? t('stepListening') : words.length ? t('again') : t('create')}
              </button>
              {phase === 'download' && <p className="text-xs text-[var(--muted)]">{t('downloadNote')}</p>}
              {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
            </div>
          </div>
        )}
      </section>

      {phase !== 'idle' && !busy && words.length > 0 && (
        <>
          {/* 2 · Stile */}
          <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
            <h3 className="font-bold text-[var(--ink)]">{t('styleTitle')}</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['karaoke', 'classic', 'box'] as VoxPreset[]).map((p) => (
                <button key={p} type="button" onClick={() => updateStyle({ preset: p })} aria-pressed={style.preset === p} className={chip(style.preset === p)}>
                  {t(`preset_${p}`)}
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold text-[var(--ink)]">{t('size')}</p>
                <div className="mt-2 flex gap-2">
                  {(['s', 'm', 'l'] as VoxSize[]).map((s) => (
                    <button key={s} type="button" onClick={() => updateStyle({ size: s })} aria-pressed={style.size === s} className={chip(style.size === s)}>
                      {t(`size_${s}`)}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block text-sm font-semibold text-[var(--ink)]">
                {t('position')}
                <input type="range" min={10} max={90} value={Math.round(style.position * 100)} onChange={(e) => updateStyle({ position: Number(e.target.value) / 100 })} className="mt-3 block w-full accent-[var(--gold)]" />
              </label>
              {style.preset === 'karaoke' && (
                <div>
                  <p className="text-sm font-semibold text-[var(--ink)]">{t('highlight')}</p>
                  <div className="mt-2 flex gap-2">
                    {VOX_HIGHLIGHTS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateStyle({ highlight: c })}
                        aria-label={c}
                        aria-pressed={style.highlight === c}
                        className={`h-9 w-9 rounded-full border-2 ${style.highlight === c ? 'border-[var(--ink)] ring-2 ring-[var(--gold)]/50' : 'border-gray-200'}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>
              )}
              <label className="flex items-center gap-3 text-sm font-semibold text-[var(--ink)]">
                <input type="checkbox" checked={style.upper} onChange={(e) => updateStyle({ upper: e.target.checked })} className="h-5 w-5 accent-[var(--gold)]" />
                {t('upper')}
              </label>
            </div>
          </section>

          {/* 3 · Correggi il testo */}
          <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
            <h3 className="font-bold text-[var(--ink)]">{t('editTitle')}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{t('editHint')}</p>
            <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {groups.map((g, i) => (
                <li key={`${g.start}-${i}`} className="flex items-center gap-2">
                  <button type="button" onClick={() => seek(g.start)} className="w-12 shrink-0 rounded-lg bg-[var(--gold)]/10 py-2 text-xs font-bold tabular-nums text-[var(--ink)]" title={t('seek')}>
                    {mmss(g.start)}
                  </button>
                  <input
                    defaultValue={g.words.map((w) => w.text).join(' ')}
                    onBlur={(e) => {
                      const v = e.target.value
                      if (v !== g.words.map((w) => w.text).join(' ')) editGroup(i, v)
                    }}
                    aria-label={t('lineLabel', { n: i + 1 })}
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-[var(--gold)] focus:outline-none"
                  />
                </li>
              ))}
            </ol>
          </section>

          {/* 4 · Scarica */}
          <section className="rounded-2xl border border-[var(--gold)]/25 bg-white p-4 sm:p-5">
            {phase === 'exporting' ? (
              <div>
                <p className="flex items-center gap-2 font-bold text-[var(--ink)]">
                  <LoaderCircle className="h-5 w-5 animate-spin text-[var(--gold)]" /> {t('exporting', { pct: exportPct })}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full bg-[var(--gold)] transition-all" style={{ width: `${exportPct}%` }} />
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">{t('exportingHint')}</p>
                <button type="button" onClick={() => cancelExport.current?.()} className="mt-3 text-sm font-semibold text-gray-600 underline">
                  {t('cancel')}
                </button>
              </div>
            ) : result ? (
              <div className="space-y-3">
                <p className="font-bold text-[var(--ink)]">{t('readyTitle')}</p>
                <video src={result.url} controls playsInline className="mx-auto max-h-[50vh] rounded-2xl bg-black" />
                <a href={result.url} download={`${baseName}-vox.${result.ext}`} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 font-extrabold text-[var(--ink)]">
                  <Download className="h-5 w-5" /> {t('download')}
                </a>
                {canShare && (
                  <button type="button" onClick={share} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[var(--gold)]/50 px-4 font-bold">
                    <Share2 className="h-5 w-5" /> {t('share')}
                  </button>
                )}
                <button type="button" onClick={() => setResult(null)} className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-gray-600 underline">
                  <RotateCcw className="h-4 w-4" /> {t('changeAgain')}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <button type="button" onClick={exportVideo} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--gold)] px-4 font-extrabold text-[var(--ink)] hover:brightness-105">
                  <Captions className="h-5 w-5" /> {t('export')}
                </button>
                <p className="text-center text-xs text-[var(--muted)]">{t('exportHint')}</p>
              </div>
            )}
            {srtUrl && phase !== 'exporting' && (
              <a href={srtUrl} download={`${baseName}.srt`} className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--gold)] hover:text-[var(--ink)]">
                <FileText className="h-4 w-4" /> {t('downloadSrt')}
              </a>
            )}
            <p className="mt-3 text-center text-xs text-[var(--muted)]">{t('privacy')}</p>
          </section>
        </>
      )}
    </div>
  )
}
