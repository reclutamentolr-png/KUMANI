import type { FaceLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'

// FOTOTESSERA, scatto guidato: la fotocamera controlla dal vivo che la foto
// vada bene (una persona, distanza, viso al centro, testa dritta, occhi
// aperti, bocca chiusa, luce uniforme) e poi scatta da sola. MediaPipe nel
// telefono: libreria e modello del viso in public/mediapipe, il video non
// esce dal dispositivo.

let facePromise: Promise<FaceLandmarker> | null = null
export function loadLiveFace() {
  facePromise ??= (async () => {
    const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks('/mediapipe')
    const make = (delegate: 'GPU' | 'CPU') =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/mediapipe/face_landmarker.task', delegate },
        runningMode: 'VIDEO',
        numFaces: 2,
      })
    return make('GPU').catch(() => make('CPU'))
  })().catch((e) => {
    facePromise = null
    throw e
  })
  return facePromise
}

// I controlli nell'ordine in cui si chiede di sistemarli
export const LIVE_CHECKS = ['oneFace', 'distance', 'center', 'straight', 'eyes', 'mouth', 'light'] as const
export type LiveCheck = (typeof LIVE_CHECKS)[number]
// Cosa dire per il primo controllo che non va
export type LiveHint = 'noFace' | 'many' | 'closer' | 'farther' | 'center' | 'tilt' | 'turn' | 'chin' | 'eyes' | 'mouth' | 'dark' | 'bright' | 'shadow'
// box: viso principale in pixel del video (centro e lunghezza fronte–mento)
export type LiveResult = { ok: Record<LiveCheck, boolean>; hint: LiveHint | null; box?: { cx: number; cy: number; len: number } }
// 'id' = fototessera (regole dei documenti); 'profile' = foto profilo
// (sorriso permesso, testa meno rigida, distanza da mezzo busto)
export type LiveKind = 'id' | 'profile'
const PROFILE_CHECKS: readonly LiveCheck[] = LIVE_CHECKS.filter((c) => c !== 'mouth')
export const liveChecksFor = (kind: LiveKind): readonly LiveCheck[] => (kind === 'profile' ? PROFILE_CHECKS : LIVE_CHECKS)

// Punti del viso (schema MediaPipe Face Mesh, come in vision.ts)
const P = { eyeLOut: 33, eyeLIn: 133, eyeROut: 263, eyeRIn: 362, chin: 152, forehead: 10, nose: 1, lidLTop: 159, lidLBottom: 145, lidRTop: 386, lidRBottom: 374, lipTop: 13, lipBottom: 14, cheekL: 50, cheekR: 280, faceL: 234, faceR: 454 }

type Pt = { x: number; y: number }
const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

// Luminosità media (0–255) intorno a un punto dell'immagine piccola
function luma(img: ImageData, c: Pt, r: number) {
  let sum = 0
  let n = 0
  for (let y = Math.max(0, Math.round(c.y - r)); y <= Math.min(img.height - 1, Math.round(c.y + r)); y++)
    for (let x = Math.max(0, Math.round(c.x - r)); x <= Math.min(img.width - 1, Math.round(c.x + r)); x++) {
      const i = (y * img.width + x) * 4
      sum += 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2]
      n++
    }
  return n ? sum / n : 128
}

// faces: punti normalizzati (0–1) di ogni viso; W×H: misure del video;
// small: fotogramma rimpicciolito per la luce (stesse proporzioni del video)
export function checkLive(faces: NormalizedLandmark[][], W: number, H: number, small: ImageData | null, kind: LiveKind = 'id'): LiveResult {
  const profile = kind === 'profile'
  const ok = Object.fromEntries(LIVE_CHECKS.map((c) => [c, false])) as Record<LiveCheck, boolean>
  if (!faces.length) return { ok, hint: 'noFace' }
  // Un secondo viso conta solo se è grande (non qualcuno lontano dietro)
  const sizes = faces.map((f) => Math.abs(f[P.faceR].x - f[P.faceL].x))
  const main = sizes.indexOf(Math.max(...sizes))
  if (sizes.some((s, i) => i !== main && s > sizes[main] * 0.5)) return { ok, hint: 'many' }
  ok.oneFace = true

  const lm = faces[main].map((p) => ({ x: p.x * W, y: p.y * H }))
  const [eyeA, eyeB] = [mid(lm[P.eyeLOut], lm[P.eyeLIn]), mid(lm[P.eyeROut], lm[P.eyeRIn])].sort((a, b) => a.x - b.x)
  const eyes = mid(eyeA, eyeB)
  const eyeGap = dist(eyeA, eyeB)
  const chin = lm[P.chin]
  const forehead = lm[P.forehead]
  const nose = lm[P.nose]
  const faceLen = dist(chin, forehead)
  const hints: LiveHint[] = []

  // Distanza: il viso (fronte–mento) occupa circa un terzo dell'altezza,
  // così c'è spazio per la testa e le spalle e la foto ha abbastanza dettaglio
  // Con la webcam del computer (video largo) l'ovale è più grande: il viso può occupare di più
  const share = faceLen / H
  const wide = W > H
  const [near, far] = profile ? (wide ? [0.22, 0.5] : [0.18, 0.42]) : wide ? [0.28, 0.52] : [0.24, 0.44]
  if (share < near) hints.push('closer')
  else if (share > far) hints.push('farther')
  else ok.distance = true

  // Al centro, con spazio sopra la testa (la sommità sta circa mezzo viso sopra la fronte)
  const centered = Math.abs(nose.x / W - 0.5) < 0.09 && eyes.y / H > 0.28 && eyes.y / H < 0.56 && forehead.y - faceLen * 0.45 > H * 0.02 && chin.y < H * 0.92
  if (centered) ok.center = true
  else hints.push('center')

  // Testa dritta: occhi in piano, non girata, mento né alto né basso
  const tilt = (Math.atan2(eyeB.y - eyeA.y, eyeB.x - eyeA.x) * 180) / Math.PI
  const angle = (tilt * Math.PI) / 180
  const turn = Math.abs((nose.x - eyes.x) * Math.cos(angle) + (nose.y - eyes.y) * Math.sin(angle)) / eyeGap
  const pitch = (nose.y - eyes.y) / Math.max(1, chin.y - eyes.y)
  if (Math.abs(tilt) > (profile ? 8 : 4)) hints.push('tilt')
  else if (turn > (profile ? 0.15 : 0.09)) hints.push('turn')
  else if (pitch < (profile ? 0.2 : 0.26) || pitch > (profile ? 0.66 : 0.58)) hints.push('chin')
  else ok.straight = true

  // Sorridendo gli occhi si stringono: nel profilo basta che siano aperti
  const openL = dist(lm[P.lidLTop], lm[P.lidLBottom]) / dist(lm[P.eyeLOut], lm[P.eyeLIn])
  const openR = dist(lm[P.lidRTop], lm[P.lidRBottom]) / dist(lm[P.eyeROut], lm[P.eyeRIn])
  if (Math.min(openL, openR) < (profile ? 0.11 : 0.16)) hints.push('eyes')
  else ok.eyes = true

  // Bocca chiusa solo per la fototessera (nel profilo il sorriso va benissimo)
  if (!profile && dist(lm[P.lipTop], lm[P.lipBottom]) / eyeGap > 0.08) hints.push('mouth')
  else ok.mouth = true

  // Luce: guance né scure né bruciate, e simili tra loro (niente ombra da un lato)
  if (small) {
    const k = small.width / W
    const r = Math.max(2, eyeGap * 0.18 * k)
    const lumL = luma(small, { x: lm[P.cheekL].x * k, y: lm[P.cheekL].y * k }, r)
    const lumR = luma(small, { x: lm[P.cheekR].x * k, y: lm[P.cheekR].y * k }, r)
    const avg = (lumL + lumR) / 2
    if (avg < 80) hints.push('dark')
    else if (avg > 225) hints.push('bright')
    else if (Math.abs(lumL - lumR) / Math.max(lumL, lumR, 1) > 0.25) hints.push('shadow')
    else ok.light = true
  } else ok.light = true

  return { ok, hint: hints[0] ?? null, box: { cx: (eyes.x + chin.x) / 2, cy: (forehead.y + chin.y) / 2, len: faceLen } }
}
