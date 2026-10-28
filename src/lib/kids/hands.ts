import type { HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision'

// Mani viste dalla fotocamera (MediaPipe): 21 puntini per mano, tutto sul
// telefono, il video non esce mai. Libreria e modello stanno in
// public/mediapipe (come lo sfondo del webinar) e si scaricano solo quando il
// gioco accende la fotocamera.

// Coppie di puntini da unire (polso, pollice, indice, medio, anulare, mignolo, palmo)
export const BONES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
]
export const FINGERTIPS = [4, 8, 12, 16, 20]

// iPhone, iPad (anche quello che si presenta come Mac)
export const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

let handsPromise: Promise<HandLandmarker> | null = null
export function loadHands() {
  handsPromise ??= (async () => {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
    const fileset = await FilesetResolver.forVisionTasks('/mediapipe')
    const make = (delegate: 'GPU' | 'CPU') =>
      HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/mediapipe/hand_landmarker.task', delegate },
        runningMode: 'VIDEO',
        numHands: 2,
      })
    // iPhone e iPad: con la scheda grafica Safari a volte si blocca, meglio il processore
    return isIos() ? make('CPU') : make('GPU').catch(() => make('CPU'))
  })().catch((e) => {
    handsPromise = null
    throw e
  })
  return handsPromise
}

const dist = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y)

// Angolo (in gradi) nel punto b tra a e c: 180 = dito dritto
function angle(a: NormalizedLandmark, b: NormalizedLandmark, c: NormalizedLandmark) {
  const v1 = [a.x - b.x, a.y - b.y, a.z - b.z]
  const v2 = [c.x - b.x, c.y - b.y, c.z - b.z]
  const dot = v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]
  const len = Math.hypot(...v1) * Math.hypot(...v2)
  return len ? (Math.acos(Math.max(-1, Math.min(1, dot / len))) * 180) / Math.PI : 0
}

// Dita alzate. Un dito è alzato se è dritto (articolazione di mezzo aperta)
// e la punta è più lontana dal polso della nocca. Il pollice è alzato se è
// dritto e la punta sta lontana dal palmo: piegato sopra le altre dita o
// appoggiato al medio non conta (prima un indice da solo diventava «2»).
// Funziona anche con la mano girata, senza sapere se è la destra o la sinistra.
export function countFingers(p: NormalizedLandmark[]) {
  const palm = dist(p[0], p[9])
  const thumbStraight = angle(p[2], p[3], p[4]) > 150 && angle(p[1], p[2], p[3]) > 140
  const thumbAway = dist(p[4], p[9]) > palm * 0.85 && dist(p[4], p[5]) > palm * 0.55
  let n = thumbStraight && thumbAway ? 1 : 0
  for (const [mcp, pip, tip] of [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]]) {
    if (angle(p[mcp], p[pip], p[tip]) > 150 && dist(p[tip], p[0]) > dist(p[pip], p[0]) * 1.1) n++
  }
  return n
}
