// FOTOTESSERA: viso e sagoma trovati nel telefono con MediaPipe (Google,
// licenza Apache-2.0). Libreria e modelli si scaricano al primo uso dal CDN
// e poi restano nella cache del browser; la foto non lascia il dispositivo.
import type { FacePoints, Point } from './geometry'

const LIB = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35'
const FACE_MODEL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const SEG_MODEL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite'

type Landmark = { x: number; y: number }
type MpMask = { width: number; height: number; getAsFloat32Array: () => Float32Array }
type Vision = {
  FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> }
  FaceLandmarker: { createFromOptions: (files: unknown, o: object) => Promise<{ detect: (img: TexImageSource) => { faceLandmarks: Landmark[][] } }> }
  ImageSegmenter: { createFromOptions: (files: unknown, o: object) => Promise<{ segment: (img: TexImageSource) => { confidenceMasks?: MpMask[]; close: () => void } }> }
}

type Tools = {
  face: Awaited<ReturnType<Vision['FaceLandmarker']['createFromOptions']>>
  seg: Awaited<ReturnType<Vision['ImageSegmenter']['createFromOptions']>>
}
let tools: Promise<Tools> | null = null

export function loadVision(): Promise<Tools> {
  if (!tools) {
    tools = (async () => {
      const vision = (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ `${LIB}/vision_bundle.mjs`)) as Vision
      const files = await vision.FilesetResolver.forVisionTasks(`${LIB}/wasm`)
      const [face, seg] = await Promise.all([
        vision.FaceLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'CPU' }, runningMode: 'IMAGE', numFaces: 3 }),
        vision.ImageSegmenter.createFromOptions(files, { baseOptions: { modelAssetPath: SEG_MODEL, delegate: 'CPU' }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false }),
      ])
      return { face, seg }
    })()
    tools.catch(() => {
      tools = null
    })
  }
  return tools
}

// Sagoma della persona: probabilità 0–1 per ogni punto (mw×mh)
export type PersonMask = { data: Float32Array; w: number; h: number }

export type Warning = 'blur' | 'dark' | 'bright' | 'shadow' | 'turned' | 'eyes' | 'mouth'

export type Analysis =
  | { ok: false; reason: 'noFace' | 'manyFaces' }
  | { ok: true; face: FacePoints; mask: PersonMask | null; tilt: number; warnings: Warning[] }

// Punti del modello del viso (478 punti, schema MediaPipe Face Mesh)
const P = { eyeLOut: 33, eyeLIn: 133, eyeROut: 263, eyeRIn: 362, chin: 152, forehead: 10, nose: 1, lidLTop: 159, lidLBottom: 145, lidRTop: 386, lidRBottom: 374, lipTop: 13, lipBottom: 14, cheekL: 50, cheekR: 280, faceL: 234, faceR: 454 }

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export const maskAt = (m: PersonMask, x: number, y: number, imgW: number, imgH: number) => {
  const mx = Math.min(m.w - 1, Math.max(0, Math.floor((x / imgW) * m.w)))
  const my = Math.min(m.h - 1, Math.max(0, Math.floor((y / imgH) * m.h)))
  return m.data[my * m.w + mx]
}

// Luminosità media di un piccolo cerchio
function luma(img: ImageData, c: Point, r: number) {
  let sum = 0
  let n = 0
  for (let y = Math.max(0, Math.round(c.y - r)); y <= Math.min(img.height - 1, Math.round(c.y + r)); y += 2)
    for (let x = Math.max(0, Math.round(c.x - r)); x <= Math.min(img.width - 1, Math.round(c.x + r)); x += 2) {
      const i = (y * img.width + x) * 4
      sum += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
      n++
    }
  return n ? sum / n : 128
}

export async function analyze(canvas: HTMLCanvasElement): Promise<Analysis> {
  const { face, seg } = await loadVision()
  const W = canvas.width
  const H = canvas.height
  const found = face.detect(canvas).faceLandmarks ?? []
  if (!found.length) return { ok: false, reason: 'noFace' }
  // Più visi: conta solo se un secondo viso è grande (non uno sullo sfondo)
  const sizes = found.map((f) => Math.abs(f[P.faceR].x - f[P.faceL].x))
  const main = sizes.indexOf(Math.max(...sizes))
  if (sizes.some((s, i) => i !== main && s > sizes[main] * 0.5)) return { ok: false, reason: 'manyFaces' }
  const lm = found[main].map((p) => ({ x: p.x * W, y: p.y * H }))

  // Occhi da sinistra a destra nella foto
  const [eyeA, eyeB] = [mid(lm[P.eyeLOut], lm[P.eyeLIn]), mid(lm[P.eyeROut], lm[P.eyeRIn])].sort((a, b) => a.x - b.x)
  const chin = lm[P.chin]
  const forehead = lm[P.forehead]
  const angle = Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x)

  // Sagoma della persona
  let mask: PersonMask | null = null
  try {
    const out = seg.segment(canvas)
    const masks = out.confidenceMasks ?? []
    const m = masks[masks.length > 1 ? 1 : 0]
    if (m) {
      const data = new Float32Array(m.getAsFloat32Array())
      mask = { data, w: m.width, h: m.height }
      // Se il viso risulta «sfondo» il modello ha invertito le parti
      if (maskAt(mask, lm[P.nose].x, lm[P.nose].y, W, H) < 0.5) for (let i = 0; i < data.length; i++) data[i] = 1 - data[i]
    }
    out.close()
  } catch {
    mask = null
  }

  // Sommità del capo: si sale dalla fronte, perpendicolare agli occhi, finché c'è la persona
  const faceLen = dist(chin, forehead)
  const up = { x: Math.sin(angle), y: -Math.cos(angle) }
  const side = { x: Math.cos(angle), y: Math.sin(angle) }
  const eyeGap = dist(eyeA, eyeB)
  let reach = faceLen * 0.25
  if (mask) {
    let best = 0
    for (const k of [-0.35, 0, 0.35]) {
      const start = { x: forehead.x + side.x * eyeGap * k, y: forehead.y + side.y * eyeGap * k }
      let s = 0
      for (let d = 0; d < faceLen * 0.9; d += 2) {
        const x = start.x + up.x * d
        const y = start.y + up.y * d
        if (x < 0 || y < 0 || x >= W || y >= H) break
        if (maskAt(mask, x, y, W, H) < 0.5) break
        s = d
      }
      best = Math.max(best, s)
    }
    // Sagoma poco credibile (troppo corta o tagliata dal bordo): stima media
    if (best > faceLen * 0.08) reach = best
  }
  const crown = { x: forehead.x + up.x * reach, y: forehead.y + up.y * reach }

  // Controlli indicativi
  const warnings: Warning[] = []
  const img = canvas.getContext('2d')!.getImageData(0, 0, W, H)
  if (dist(chin, crown) < 280) warnings.push('blur')
  const r = eyeGap * 0.18
  const lumL = luma(img, lm[P.cheekL], r)
  const lumR = luma(img, lm[P.cheekR], r)
  const lumFace = (lumL + lumR) / 2
  if (lumFace < 70) warnings.push('dark')
  else if (lumFace > 225) warnings.push('bright')
  if (Math.abs(lumL - lumR) / Math.max(lumL, lumR, 1) > 0.28) warnings.push('shadow')
  const noseOff = Math.abs((lm[P.nose].x - (eyeA.x + eyeB.x) / 2) * Math.cos(angle) + (lm[P.nose].y - (eyeA.y + eyeB.y) / 2) * Math.sin(angle)) / eyeGap
  if (noseOff > 0.14) warnings.push('turned')
  const openL = dist(lm[P.lidLTop], lm[P.lidLBottom]) / dist(lm[P.eyeLOut], lm[P.eyeLIn])
  const openR = dist(lm[P.lidRTop], lm[P.lidRBottom]) / dist(lm[P.eyeROut], lm[P.eyeRIn])
  if (Math.min(openL, openR) < 0.12) warnings.push('eyes')
  if (dist(lm[P.lipTop], lm[P.lipBottom]) / eyeGap > 0.12) warnings.push('mouth')

  return { ok: true, face: { eyeL: eyeA, eyeR: eyeB, chin, forehead, nose: lm[P.nose], crown }, mask, tilt: (angle * 180) / Math.PI, warnings }
}

// Media su un quadrato di lato 2r+1 (somme cumulative, tempo lineare)
function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    let acc = 0
    const row = y * w
    for (let x = -r; x <= r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / (2 * r + 1)
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1)
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return out
}

// Sagoma ritoccata sui bordi veri della foto («guided filter»): la sagoma del
// modello è a bassa risoluzione, qui segue capelli, orecchie e spalle
function refineMask(source: HTMLCanvasElement, mask: PersonMask): HTMLCanvasElement {
  const k = Math.min(1, 900 / Math.max(source.width, source.height))
  const w = Math.round(source.width * k)
  const h = Math.round(source.height * k)
  const small = document.createElement('canvas')
  small.width = w
  small.height = h
  const sctx = small.getContext('2d')!
  sctx.drawImage(source, 0, 0, w, h)
  const px = sctx.getImageData(0, 0, w, h).data
  const I = new Float32Array(w * h)
  const p = new Float32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      I[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255
      // Sagoma ingrandita con interpolazione bilineare
      const fx = Math.min(mask.w - 1.001, Math.max(0, ((x + 0.5) / w) * mask.w - 0.5))
      const fy = Math.min(mask.h - 1.001, Math.max(0, ((y + 0.5) / h) * mask.h - 0.5))
      const x0 = Math.floor(fx)
      const y0 = Math.floor(fy)
      const ax = fx - x0
      const ay = fy - y0
      const m = mask.data
      const r0 = m[y0 * mask.w + x0] * (1 - ax) + m[y0 * mask.w + x0 + 1] * ax
      const r1 = m[(y0 + 1) * mask.w + x0] * (1 - ax) + m[(y0 + 1) * mask.w + x0 + 1] * ax
      p[i] = r0 * (1 - ay) + r1 * ay
    }
  const r = Math.max(4, Math.round(Math.max(w, h) / 90))
  const eps = 0.0015
  const II = new Float32Array(w * h)
  const Ip = new Float32Array(w * h)
  for (let i = 0; i < I.length; i++) {
    II[i] = I[i] * I[i]
    Ip[i] = I[i] * p[i]
  }
  const mI = boxBlur(I, w, h, r)
  const mp = boxBlur(p, w, h, r)
  const mII = boxBlur(II, w, h, r)
  const mIp = boxBlur(Ip, w, h, r)
  const a = new Float32Array(w * h)
  const b = new Float32Array(w * h)
  for (let i = 0; i < I.length; i++) {
    const varI = mII[i] - mI[i] * mI[i]
    a[i] = (mIp[i] - mI[i] * mp[i]) / (varI + eps)
    b[i] = mp[i] - a[i] * mI[i]
  }
  const ma = boxBlur(a, w, h, r)
  const mb = boxBlur(b, w, h, r)
  const img = sctx.createImageData(w, h)
  for (let i = 0; i < I.length; i++) {
    const q = Math.min(1, Math.max(0, (ma[i] * I[i] + mb[i] - 0.2) / 0.6))
    img.data[i * 4 + 3] = Math.round(q * q * (3 - 2 * q) * 255)
  }
  sctx.clearRect(0, 0, w, h)
  sctx.putImageData(img, 0, 0)
  return small
}

// Persona ritagliata (sfondo trasparente) con il bordo morbido
export function cutout(source: HTMLCanvasElement, mask: PersonMask): HTMLCanvasElement {
  const alpha = refineMask(source, mask)
  const out = document.createElement('canvas')
  out.width = source.width
  out.height = source.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(source, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(alpha, 0, 0, source.width, source.height)
  ctx.globalCompositeOperation = 'source-over'
  return out
}
