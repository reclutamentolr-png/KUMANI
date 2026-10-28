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
    return make('GPU').catch(() => make('CPU'))
  })().catch((e) => {
    handsPromise = null
    throw e
  })
  return handsPromise
}

const dist = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y)

// Dita alzate: la punta è più lontana dal polso della nocca di mezzo; il
// pollice è aperto se si allontana dalla base dell'indice. Funziona anche con
// la mano girata, senza sapere se è la destra o la sinistra.
export function countFingers(p: NormalizedLandmark[]) {
  const palm = dist(p[0], p[9])
  let n = dist(p[4], p[5]) > palm * 0.6 && dist(p[4], p[17]) > dist(p[3], p[17]) ? 1 : 0
  for (const [tip, pip] of [[8, 6], [12, 10], [16, 14], [20, 18]]) if (dist(p[tip], p[0]) > dist(p[pip], p[0]) * 1.12) n++
  return n
}
