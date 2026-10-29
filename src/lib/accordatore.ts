// ACCORDATORE (Audio e Strumenti): la nota suonata si riconosce nel telefono
// con il metodo McLeod (autocorrelazione normalizzata, lo stesso tipo usato
// dagli accordatori professionali), con precisione al centesimo. Strumenti e
// accordature pronte, La di riferimento regolabile, suono di riferimento.

export const A4_DEFAULT = 440
export const A4_MIN = 415
export const A4_MAX = 466

// Nomi delle note: lettere (C D E…) o solfeggio (Do Re Mi…)
export type Naming = 'letters' | 'solfege'
const LETTERS = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']
const SOLFEGE = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si']

export const noteName = (midi: number, naming: Naming, octave = true) => {
  const n = ((midi % 12) + 12) % 12
  const o = Math.floor(midi / 12) - 1
  return `${(naming === 'solfege' ? SOLFEGE : LETTERS)[n]}${octave ? o : ''}`
}
export const midiToFreq = (midi: number, a4: number) => a4 * 2 ** ((midi - 69) / 12)
export const centsBetween = (freq: number, target: number) => 1200 * Math.log2(freq / target)

// Frequenza → nota più vicina e scarto in centesimi
export function nearestNote(freq: number, a4: number) {
  const midi = Math.round(69 + 12 * Math.log2(freq / a4))
  return { midi, cents: centsBetween(freq, midiToFreq(midi, a4)) }
}

// Strumenti e accordature (note MIDI delle corde, dalla più grave)
export type Tuning = { id: string; strings: number[] }
export type Instrument = { id: string; tunings: Tuning[] }
export const INSTRUMENTS: Instrument[] = [
  {
    id: 'guitar',
    tunings: [
      { id: 'standard', strings: [40, 45, 50, 55, 59, 64] },
      { id: 'halfDown', strings: [39, 44, 49, 54, 58, 63] },
      { id: 'dropD', strings: [38, 45, 50, 55, 59, 64] },
      { id: 'dropC', strings: [36, 43, 48, 53, 57, 62] },
      { id: 'dadgad', strings: [38, 45, 50, 55, 57, 62] },
      { id: 'openG', strings: [38, 43, 50, 55, 59, 62] },
      { id: 'openD', strings: [38, 45, 50, 54, 57, 62] },
      { id: 'openE', strings: [40, 47, 52, 56, 59, 64] },
      { id: 'seven', strings: [35, 40, 45, 50, 55, 59, 64] },
    ],
  },
  {
    id: 'bass',
    tunings: [
      { id: 'four', strings: [28, 33, 38, 43] },
      { id: 'five', strings: [23, 28, 33, 38, 43] },
      { id: 'dropD', strings: [26, 33, 38, 43] },
    ],
  },
  {
    id: 'ukulele',
    tunings: [
      { id: 'standard', strings: [67, 60, 64, 69] },
      { id: 'lowG', strings: [55, 60, 64, 69] },
      { id: 'baritone', strings: [50, 55, 59, 64] },
      { id: 'dTuning', strings: [69, 62, 66, 71] },
    ],
  },
  { id: 'violin', tunings: [{ id: 'standard', strings: [55, 62, 69, 76] }] },
  { id: 'viola', tunings: [{ id: 'standard', strings: [48, 55, 62, 69] }] },
  { id: 'cello', tunings: [{ id: 'standard', strings: [36, 43, 50, 57] }] },
  { id: 'chromatic', tunings: [{ id: 'free', strings: [] }] },
]
export const instrumentOf = (id: string) => INSTRUMENTS.find((i) => i.id === id) ?? INSTRUMENTS[0]

// Fascia di frequenze da cercare: un po' sotto la corda più grave, un po' sopra la più acuta
export function searchRange(strings: number[], a4: number): [number, number] {
  if (!strings.length) return [27, 4200]
  return [midiToFreq(Math.min(...strings), a4) * 0.6, midiToFreq(Math.max(...strings), a4) * 2.2]
}

/**
 * Altezza del suono con il metodo McLeod (NSDF): per ogni ritardo si misura
 * quanto il suono somiglia a sé stesso spostato; il primo picco abbastanza
 * alto dà il periodo, raffinato con un'interpolazione parabolica.
 * Ritorna la frequenza e la «chiarezza» (0–1), o null se il suono non è una nota.
 */
export function detectPitch(buf: Float32Array, sampleRate: number, minFreq: number, maxFreq: number): { freq: number; clarity: number } | null {
  const n = buf.length
  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq))
  const maxLag = Math.min(n - 2, Math.ceil(sampleRate / minFreq))
  if (maxLag <= minLag) return null
  const nsdf = new Float32Array(maxLag + 2)
  for (let tau = minLag - 1; tau <= maxLag + 1; tau++) {
    let acf = 0
    let m = 0
    for (let i = 0; i < n - tau; i++) {
      const a = buf[i]
      const b = buf[i + tau]
      acf += a * b
      m += a * a + b * b
    }
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0
  }
  // Picchi positivi tra un passaggio per lo zero e l'altro
  const peaks: number[] = []
  let pos = false
  let best = -1
  for (let tau = minLag; tau <= maxLag; tau++) {
    if (nsdf[tau] > 0 && nsdf[tau - 1] <= 0) {
      pos = true
      best = tau
    } else if (pos && nsdf[tau] > nsdf[best]) best = tau
    if (pos && nsdf[tau] <= 0 && nsdf[tau - 1] > 0) {
      peaks.push(best)
      pos = false
    }
  }
  if (pos && best > 0) peaks.push(best)
  if (!peaks.length) return null
  const top = Math.max(...peaks.map((p) => nsdf[p]))
  if (top < 0.5) return null
  // Il primo picco vicino al massimo: evita di scambiare la nota con la sua ottava sotto
  const chosen = peaks.find((p) => nsdf[p] >= 0.9 * top) ?? peaks[0]
  const a = nsdf[chosen - 1]
  const b = nsdf[chosen]
  const c = nsdf[chosen + 1]
  const denom = a - 2 * b + c
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0
  const period = chosen + Math.max(-1, Math.min(1, shift))
  const freq = sampleRate / period
  if (freq < minFreq || freq > maxFreq) return null
  return { freq, clarity: b }
}

// Valore stabile: mediana degli ultimi valori (un errore isolato non fa saltare l'ago)
export function median(values: number[]) {
  const s = [...values].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

// Suono di riferimento: una nota con armoniche dolci, che si ferma da sola
export function playReference(ctx: AudioContext, freq: number, seconds = 2.5) {
  const out = ctx.createGain()
  out.gain.setValueAtTime(0.0001, ctx.currentTime)
  out.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.03)
  out.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds)
  out.connect(ctx.destination)
  const parts: [number, number][] = [
    [1, 1],
    [2, 0.35],
    [3, 0.15],
  ]
  for (const [h, level] of parts) {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = freq * h
    g.gain.value = level
    osc.connect(g).connect(out)
    osc.start()
    osc.stop(ctx.currentTime + seconds + 0.05)
  }
}

export type TunerSettings = { instrument: string; tuning: string; a4: number; naming: Naming; tolerance: number; strobe: boolean; sensitivity: number }
const KEY = 'kumani:accordatore:settings'
export function loadTunerSettings(): Partial<TunerSettings> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<TunerSettings>
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}
export function saveTunerSettings(s: TunerSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {}
}
