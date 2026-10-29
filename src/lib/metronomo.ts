// METRONOMO (Audio e Strumenti): i battiti si programmano sull'orologio
// dell'audio (precisi anche se la pagina rallenta) e, se si vuole, il
// microfono ascolta i colpi di chi suona e li confronta con i battiti. Tutto
// resta nel telefono: impostazioni e prove salvate stanno nella memoria del browser.

export const MIN_BPM = 30
export const MAX_BPM = 250

// Tempi: battiti per battuta e unità (4 = semiminima, 8 = croma)
export const METERS = [
  { id: '2/4', beats: 2, unit: 4 },
  { id: '3/4', beats: 3, unit: 4 },
  { id: '4/4', beats: 4, unit: 4 },
  { id: '5/4', beats: 5, unit: 4 },
  { id: '6/8', beats: 6, unit: 8 },
  { id: '7/8', beats: 7, unit: 8 },
  { id: '9/8', beats: 9, unit: 8 },
  { id: '12/8', beats: 12, unit: 8 },
] as const
export type MeterId = (typeof METERS)[number]['id']
export const meterOf = (id: MeterId) => METERS.find((m) => m.id === id) ?? METERS[2]

// Accento di ogni battito: forte, normale, muto
export type Accent = 'strong' | 'normal' | 'mute'
export function defaultAccents(id: MeterId): Accent[] {
  const m = meterOf(id)
  // Nei tempi composti (6/8, 9/8, 12/8) i battiti si raggruppano a tre: forte il primo, accento lieve ogni gruppo
  const group = m.unit === 8 && m.beats % 3 === 0 ? 3 : m.id === '7/8' ? 0 : m.beats
  return Array.from({ length: m.beats }, (_, i) => (i === 0 ? 'strong' : group && i % group === 0 ? 'strong' : m.id === '7/8' && (i === 2 || i === 4) ? 'strong' : 'normal'))
}

// Suddivisione di ogni battito: nessuna, 2 (crome), 3 (terzine), 4 (semicrome)
export const SUBDIVISIONS = [1, 2, 3, 4] as const
export type Subdivision = (typeof SUBDIVISIONS)[number]

export type ClickSound = 'click' | 'wood' | 'bell' | 'none'
export const SOUNDS: ClickSound[] = ['click', 'wood', 'bell', 'none']

// Scarto dal battito (millisecondi): entro 50 a tempo, entro 120 quasi
export const ON_TIME_MS = 50
export const NEAR_MS = 120

export const TIMERS = [0, 5, 10, 15, 30] as const

export type Practice = { id: string; at: number; bpm: number; hits: number; onTime: number; meanOffset: number }

export const clampBpm = (v: number) => Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(v)))

// Nome classico del tempo (indicazione di andamento)
export function tempoName(bpm: number): string {
  if (bpm < 46) return 'Grave'
  if (bpm < 60) return 'Largo'
  if (bpm < 66) return 'Larghetto'
  if (bpm < 76) return 'Adagio'
  if (bpm < 108) return 'Andante'
  if (bpm < 120) return 'Moderato'
  if (bpm < 156) return 'Allegro'
  if (bpm < 176) return 'Vivace'
  if (bpm < 200) return 'Presto'
  return 'Prestissimo'
}

// Il clic: un suono breve sintetizzato (niente file da scaricare).
// level: 2 battito forte, 1 normale, 0 suddivisione (più piano)
export function playClick(ctx: AudioContext, out: AudioNode, time: number, level: 0 | 1 | 2, sound: ClickSound) {
  if (sound === 'none') return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  const base = sound === 'wood' ? 1100 : sound === 'bell' ? 1600 : 1200
  const freq = level === 2 ? base * 1.5 : level === 1 ? base : base * 0.8
  osc.type = sound === 'wood' ? 'triangle' : sound === 'bell' ? 'sine' : 'square'
  osc.frequency.setValueAtTime(freq, time)
  const length = sound === 'bell' ? (level === 0 ? 0.12 : 0.25) : 0.035
  const peak = level === 2 ? 0.6 : level === 1 ? 0.38 : 0.16
  gain.gain.setValueAtTime(0.0001, time)
  gain.gain.exponentialRampToValueAtTime(peak, time + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, time + length)
  osc.connect(gain).connect(out)
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

// Impostazioni ricordate tra una volta e l'altra
export type MetroSettings = { bpm: number; meter: MeterId; accents: Accent[]; sub: Subdivision; sound: ClickSound; volume: number; vibrate: boolean }
const SETTINGS_KEY = 'kumani:metronomo:settings'
export function loadSettings(): Partial<MetroSettings> {
  try {
    const v = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') as Partial<MetroSettings>
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}
export function saveSettings(s: MetroSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {}
}
