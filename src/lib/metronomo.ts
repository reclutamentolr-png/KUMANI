// METRONOMO (Audio e Strumenti): i battiti si programmano sull'orologio
// dell'audio (precisi anche se la pagina rallenta) e, se si vuole, il
// microfono ascolta i colpi di chi suona e li confronta con i battiti. Tutto
// resta nel telefono: le prove salvate stanno nella memoria del browser.

export const MIN_BPM = 40
export const MAX_BPM = 220
export const METERS = [2, 3, 4, 6] as const
export type Meter = (typeof METERS)[number]
export type ClickSound = 'click' | 'wood' | 'bell'

// Scarto dal battito (millisecondi): entro 50 a tempo, entro 120 quasi
export const ON_TIME_MS = 50
export const NEAR_MS = 120

export type Practice = { id: string; at: number; bpm: number; hits: number; onTime: number; meanOffset: number }

export const clampBpm = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)))

// Il clic: un suono breve sintetizzato (niente file da scaricare)
export function playClick(ctx: AudioContext, time: number, accent: boolean, sound: ClickSound) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const freq = sound === 'wood' ? (accent ? 1500 : 1100) : sound === 'bell' ? (accent ? 2100 : 1600) : accent ? 1800 : 1200
  osc.type = sound === 'wood' ? 'triangle' : sound === 'bell' ? 'sine' : 'square'
  osc.frequency.setValueAtTime(freq, time)
  const length = sound === 'bell' ? 0.25 : 0.04
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, time + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(time)
  osc.stop(time + length + 0.02)
}

// Battiti al minuto dai tocchi del dito (media degli ultimi intervalli)
export function bpmFromTaps(taps: number[]): number | null {
  if (taps.length < 3) return null
  const gaps = taps.slice(1).map((t, i) => t - taps[i]).slice(-6)
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length
  return avg > 0 ? clampBpm(60000 / avg) : null
}

// Riepilogo di una prova: quanti colpi a tempo e se si tende ad anticipare o ritardare
export function practiceStats(offsets: number[]) {
  const hits = offsets.length
  const onTime = offsets.filter((o) => Math.abs(o) <= ON_TIME_MS).length
  const meanOffset = hits ? Math.round(offsets.reduce((a, b) => a + b, 0) / hits) : 0
  return { hits, onTime, percent: hits ? Math.round((onTime / hits) * 100) : 0, meanOffset }
}

const KEY = 'kumani:metronomo:practices'
export function loadPractices(): Practice[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Practice[]
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}
export function savePractice(p: Practice): Practice[] {
  const list = [p, ...loadPractices()].slice(0, 30)
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {}
  return list
}
