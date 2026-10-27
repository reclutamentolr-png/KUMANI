'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ImageSegmenter } from '@mediapipe/tasks-vision'

// Sfondo della videocamera nel webinar: sfocato, un tema disegnato qui o
// un'immagine scelta dalla persona. La persona si separa dallo sfondo sul
// dispositivo (MediaPipe, modello «selfie segmenter»): niente server e niente
// costi. Libreria e modello stanno in public/mediapipe e si scaricano solo
// la prima volta che si sceglie uno sfondo.

export const THEMES = ['gold', 'night', 'studio', 'nature', 'office'] as const
export type ThemeId = (typeof THEMES)[number]

export type BackgroundChoice =
  | { kind: 'none' }
  | { kind: 'blur'; level: 'light' | 'strong' }
  | { kind: 'theme'; id: ThemeId }
  | { kind: 'image' }

export const NO_BACKGROUND: BackgroundChoice = { kind: 'none' }

const CHOICE_KEY = 'kumani.webinar.background'
const IMAGE_KEY = 'kumani.webinar.backgroundImage'

export function readChoice(): BackgroundChoice {
  try {
    const c = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? 'null') as BackgroundChoice | null
    if (c?.kind === 'blur' && (c.level === 'light' || c.level === 'strong')) return c
    if (c?.kind === 'theme' && THEMES.includes(c.id)) return c
    if (c?.kind === 'image' && readImage()) return c
  } catch {
    // Memoria del browser non disponibile: nessuno sfondo
  }
  return NO_BACKGROUND
}

export function saveChoice(c: BackgroundChoice) {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify(c))
  } catch {}
}

// Ultima immagine scelta, anche quando il browser non la può ricordare
let memoryImage: string | null = null

export function readImage(): string | null {
  try {
    return localStorage.getItem(IMAGE_KEY) ?? memoryImage
  } catch {
    return memoryImage
  }
}

// Immagine scelta dalla persona: ridotta a 1280×720 (JPEG) e ricordata nel browser
export async function saveImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    drawCover(canvas.getContext('2d')!, img, 1280, 720)
    const data = canvas.toDataURL('image/jpeg', 0.85)
    memoryImage = data
    try {
      localStorage.setItem(IMAGE_KEY, data)
    } catch {
      // Troppo grande per la memoria del browser: vale solo per questa volta
    }
    return data
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const sameChoice = (a: BackgroundChoice, b: BackgroundChoice) => JSON.stringify(a) === JSON.stringify(b)

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function drawCover(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number }, w: number, h: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh)
}

// ── Temi disegnati (nessuna immagine da scaricare) ────────────────────
const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) => {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r)
  g.addColorStop(0, color)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

export function drawTheme(ctx: CanvasRenderingContext2D, id: ThemeId, w: number, h: number) {
  const u = w / 100
  const linear = (stops: [number, string][], x1 = 0, y1 = 0, x2 = 0, y2 = h) => {
    const g = ctx.createLinearGradient(x1, y1, x2, y2)
    for (const [at, c] of stops) g.addColorStop(at, c)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  if (id === 'gold') {
    linear([[0, '#1d1a15'], [1, '#0f0e0c']])
    circle(ctx, w * 0.8, h * 0.15, 60 * u, 'rgba(199,154,59,0.28)')
    circle(ctx, w * 0.1, h * 0.95, 45 * u, 'rgba(231,197,106,0.16)')
    ctx.strokeStyle = 'rgba(231,197,106,0.35)'
    ctx.lineWidth = 0.5 * u
    for (const r of [34, 46]) {
      ctx.beginPath()
      ctx.arc(w * 0.92, h * 0.1, r * u, 0, Math.PI * 2)
      ctx.stroke()
    }
  } else if (id === 'night') {
    linear([[0, '#0b1730'], [1, '#04070f']])
    const dots: [number, number, number, string][] = [[12, 20, 7, 'rgba(120,170,255,0.35)'], [30, 70, 10, 'rgba(90,120,255,0.25)'], [70, 25, 9, 'rgba(160,120,255,0.3)'], [88, 65, 12, 'rgba(80,190,255,0.25)'], [52, 88, 6, 'rgba(255,210,140,0.3)'], [60, 45, 5, 'rgba(255,255,255,0.18)']]
    for (const [x, y, r, c] of dots) circle(ctx, x * u, (y / 100) * h, r * u, c)
  } else if (id === 'studio') {
    linear([[0, '#5a4636'], [0.62, '#7b6250'], [0.63, '#3d2f25'], [1, '#2a2019']])
    circle(ctx, w * 0.22, h * 0.25, 22 * u, 'rgba(255,214,150,0.55)')
    circle(ctx, w * 0.78, h * 0.3, 16 * u, 'rgba(255,200,130,0.35)')
    ctx.fillStyle = 'rgba(30,22,16,0.55)'
    for (const x of [8, 38, 68]) ctx.fillRect(x * u, h * 0.5, 24 * u, 1.2 * u)
  } else if (id === 'nature') {
    linear([[0, '#2f5a3a'], [1, '#13281a']])
    const dots: [number, number, number, string][] = [[15, 25, 14, 'rgba(190,230,140,0.35)'], [40, 15, 10, 'rgba(240,250,180,0.3)'], [75, 30, 16, 'rgba(150,210,120,0.3)'], [90, 80, 12, 'rgba(110,180,100,0.3)'], [25, 80, 11, 'rgba(200,240,160,0.22)'], [58, 60, 8, 'rgba(255,255,220,0.2)']]
    for (const [x, y, r, c] of dots) circle(ctx, x * u, (y / 100) * h, r * u, c)
  } else {
    linear([[0, '#e9e6e1'], [1, '#c9c4bc']], 0, 0, w, 0)
    const win = ctx.createLinearGradient(w * 0.62, 0, w * 0.95, 0)
    win.addColorStop(0, 'rgba(255,255,255,0.75)')
    win.addColorStop(1, 'rgba(225,238,250,0.9)')
    ctx.fillStyle = win
    ctx.fillRect(w * 0.62, h * 0.08, w * 0.3, h * 0.58)
    ctx.strokeStyle = 'rgba(120,112,100,0.6)'
    ctx.lineWidth = 0.8 * u
    ctx.strokeRect(w * 0.62, h * 0.08, w * 0.3, h * 0.58)
    ctx.beginPath()
    ctx.moveTo(w * 0.77, h * 0.08)
    ctx.lineTo(w * 0.77, h * 0.66)
    ctx.stroke()
    ctx.fillStyle = '#8a7a66'
    ctx.fillRect(0, h * 0.8, w, h * 0.2)
    ctx.fillStyle = '#4d7a4a'
    circle(ctx, w * 0.12, h * 0.55, 9 * u, 'rgba(70,120,70,0.85)')
  }
}

// ── Separazione della persona dallo sfondo ────────────────────────────
let segmenterPromise: Promise<ImageSegmenter> | null = null

function loadSegmenter() {
  segmenterPromise ??= (async () => {
    const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks('/mediapipe')
    const make = (delegate: 'GPU' | 'CPU') =>
      ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/mediapipe/selfie_segmenter_landscape.tflite', delegate },
        runningMode: 'VIDEO',
        outputCategoryMask: false,
        outputConfidenceMasks: true,
      })
    return make('GPU').catch(() => make('CPU'))
  })().catch((e) => {
    segmenterPromise = null
    throw e
  })
  return segmenterPromise
}

// Battito per disegnare i fotogrammi: un timer in un worker non rallenta
// quando la finestra passa in secondo piano (es. chi presenta condivide lo
// schermo e guarda un'altra finestra)
function ticker(fps: number, onTick: () => void) {
  try {
    const src = `setInterval(() => postMessage(0), ${Math.round(1000 / fps)})`
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
    const worker = new Worker(url)
    URL.revokeObjectURL(url)
    worker.onmessage = onTick
    return () => worker.terminate()
  } catch {
    const timer = setInterval(onTick, 1000 / fps)
    return () => clearInterval(timer)
  }
}

export type BackgroundProcessor = {
  // Videocamera con lo sfondo cambiato: è questa che si trasmette
  track: MediaStreamTrack
  setChoice: (c: BackgroundChoice) => Promise<void>
  stop: () => void
}

// Prende la videocamera e restituisce la stessa immagine con lo sfondo
// scelto. Cambiare sfondo dopo non cambia la traccia (niente da ritrasmettere).
export async function createBackgroundProcessor(source: MediaStreamTrack, choice: BackgroundChoice, fps: number): Promise<BackgroundProcessor> {
  const segmenter = await loadSegmenter()
  const settings = source.getSettings()
  const scale = Math.min(1, 1280 / (settings.width || 640))
  const W = Math.round((settings.width || 640) * scale)
  const H = Math.round((settings.height || 480) * scale)

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = new MediaStream([source])
  await video.play().catch(() => {})

  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const ctx = out.getContext('2d')!
  const maskCanvas = document.createElement('canvas')
  const maskCtx = maskCanvas.getContext('2d')!
  let maskData: ImageData | null = null
  // Sfocatura: l'immagine rimpicciolita e poi ingrandita (funziona anche su iPhone)
  const small = document.createElement('canvas')
  const smallCtx = small.getContext('2d')!
  const tiny = document.createElement('canvas')
  const tinyCtx = tiny.getContext('2d')!
  // Sfondo fisso (tema o immagine), già alla misura dell'uscita
  const backdrop = document.createElement('canvas')
  backdrop.width = W
  backdrop.height = H
  const backdropCtx = backdrop.getContext('2d')!

  let current: BackgroundChoice = NO_BACKGROUND
  const setChoice = async (c: BackgroundChoice) => {
    if (c.kind === 'theme') drawTheme(backdropCtx, c.id, W, H)
    if (c.kind === 'image') {
      const data = readImage()
      if (!data) c = NO_BACKGROUND
      else drawCover(backdropCtx, await loadImage(data), W, H)
    }
    if (c.kind === 'blur') {
      const div = c.level === 'strong' ? 24 : 10
      small.width = Math.max(8, Math.round(W / 4))
      small.height = Math.max(8, Math.round(H / 4))
      tiny.width = Math.max(4, Math.round(W / div))
      tiny.height = Math.max(4, Math.round(H / div))
    }
    current = c
  }
  await setChoice(choice)

  let busy = false
  let failures = 0
  let last = 0
  const draw = () => {
    if (busy || video.readyState < 2 || source.readyState !== 'live') return
    busy = true
    try {
      if (current.kind === 'none' || failures > 20) {
        ctx.globalCompositeOperation = 'source-over'
        ctx.drawImage(video, 0, 0, W, H)
        return
      }
      // I tempi devono sempre crescere
      const now = Math.max(performance.now(), last + 1)
      last = now
      const result = segmenter.segmentForVideo(video, now)
      const mask = result.confidenceMasks?.[0]
      if (!mask) {
        result.close()
        failures++
        return
      }
      const values = mask.getAsFloat32Array()
      if (maskCanvas.width !== mask.width || maskCanvas.height !== mask.height || !maskData) {
        maskCanvas.width = mask.width
        maskCanvas.height = mask.height
        maskData = maskCtx.createImageData(mask.width, mask.height)
      }
      const px = maskData.data
      for (let i = 0; i < values.length; i++) {
        // Bordo più netto: sotto 0,25 sfondo, sopra 0,75 persona
        const a = (values[i] - 0.25) * 2
        px[i * 4 + 3] = a <= 0 ? 0 : a >= 1 ? 255 : a * 255
      }
      result.close()
      maskCtx.putImageData(maskData, 0, 0)

      ctx.globalCompositeOperation = 'copy'
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(maskCanvas, 0, 0, W, H)
      ctx.globalCompositeOperation = 'source-in'
      ctx.drawImage(video, 0, 0, W, H)
      ctx.globalCompositeOperation = 'destination-over'
      if (current.kind === 'blur') {
        smallCtx.drawImage(video, 0, 0, small.width, small.height)
        tinyCtx.drawImage(small, 0, 0, tiny.width, tiny.height)
        ctx.drawImage(tiny, 0, 0, W, H)
      } else {
        ctx.drawImage(backdrop, 0, 0)
      }
      ctx.globalCompositeOperation = 'source-over'
      failures = 0
    } catch {
      failures++
    } finally {
      busy = false
    }
  }
  draw()
  const stopTicker = ticker(fps, draw)
  const track = out.captureStream(fps).getVideoTracks()[0]

  return {
    track,
    setChoice,
    stop: () => {
      stopTicker()
      track.stop()
      video.pause()
      video.srcObject = null
    },
  }
}

// Si sceglie uno sfondo solo dove la separazione può funzionare
export function backgroundsSupported() {
  return typeof window !== 'undefined' && typeof WebAssembly === 'object' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
}

// Sfondo della propria videocamera: ricorda la scelta, prepara la traccia da
// trasmettere e la rifà quando cambia la videocamera.
// wrap(camera) → la traccia da mandare (con lo sfondo, se scelto)
// choose(scelta) → la nuova traccia da mandare, o undefined se non cambia
export function useCameraBackground(fps: number) {
  const [choice, setChoiceState] = useState<BackgroundChoice>(NO_BACKGROUND)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const choiceRef = useRef<BackgroundChoice>(NO_BACKGROUND)
  const procRef = useRef<BackgroundProcessor | null>(null)
  const sourceRef = useRef<MediaStreamTrack | null>(null)

  useEffect(() => {
    const saved = readChoice()
    choiceRef.current = saved
    // Scelta salvata nel browser: si legge solo dopo il primo disegno
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChoiceState(saved)
    return () => procRef.current?.stop()
  }, [])

  const setChoice = (c: BackgroundChoice) => {
    choiceRef.current = c
    setChoiceState(c)
    saveChoice(c)
  }

  const release = useCallback(() => {
    procRef.current?.stop()
    procRef.current = null
    sourceRef.current = null
  }, [])

  const wrap = useCallback(async (source: MediaStreamTrack | null): Promise<MediaStreamTrack | null> => {
    procRef.current?.stop()
    procRef.current = null
    sourceRef.current = source
    if (!source || choiceRef.current.kind === 'none' || !backgroundsSupported()) return source
    setBusy(true)
    try {
      const p = await createBackgroundProcessor(source, choiceRef.current, fps)
      if (sourceRef.current !== source || source.readyState !== 'live') {
        p.stop()
        return source
      }
      procRef.current = p
      return p.track
    } catch {
      setFailed(true)
      choiceRef.current = NO_BACKGROUND
      setChoiceState(NO_BACKGROUND)
      return source
    } finally {
      setBusy(false)
    }
  }, [fps])

  const choose = useCallback(
    async (c: BackgroundChoice): Promise<MediaStreamTrack | null | undefined> => {
      setFailed(false)
      setChoice(c)
      const source = sourceRef.current
      if (!source || source.readyState !== 'live') return undefined
      if (c.kind !== 'none' && procRef.current) {
        await procRef.current.setChoice(c)
        return undefined
      }
      return wrap(source)
    },
    [wrap]
  )

  return { choice, busy, failed, wrap, choose, release, active: choice.kind !== 'none' }
}
