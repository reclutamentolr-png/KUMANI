export type Ear = 'left' | 'right'
export type DeviceConfirmation = 'headphones' | 'speaker'

// Standard audiometry frequencies (250Hz-8000Hz) plus a high-frequency
// extension (10-17.5kHz) near the upper edge of human hearing — quiet or
// inaudible for many adults (age-related high-frequency loss, or simply
// device/speaker rolloff), which is the intended source of difficulty.
// Not a clinical audiogram — see the in-app disclaimer.
// Frequencies above 10 kHz were dropped — they push into a range most
// adults can barely perceive even with healthy hearing (and playback
// hardware struggles to reproduce cleanly), making them more a test of
// speaker/headphone quality than of hearing.
export const ACOUSTIC_FREQUENCIES = [
  250, 500, 1000, 2000, 4000, 8000,
] as const
export type AcousticFrequency = (typeof ACOUSTIC_FREQUENCIES)[number]

export interface AcousticThreshold {
  ear: Ear
  frequency: AcousticFrequency
  // Gain (0-1) at which the tone was first detected. null = not detected
  // even at the maximum safe playback level.
  level: number | null
}

export interface AcousticTestResult {
  device: DeviceConfirmation
  thresholds: AcousticThreshold[]
}

// Friendly 0-100 sensitivity score, higher = better (same direction as the
// visual score below, so the shared history list reads consistently).
// Derived from the average gain level at which tones were detected across
// all frequencies/ears — a quieter average detection level means a higher
// score. Undetected points count at the max scanned level (1), the worst
// case, before the average is taken.
export function computeAcousticScore(thresholds: AcousticThreshold[]): number {
  if (thresholds.length === 0) return 0
  const avgLevel = thresholds.reduce((acc, t) => acc + (t.level ?? 1), 0) / thresholds.length
  return Math.round((1 - avgLevel) * 1000) / 10
}

export type Eye = 'left' | 'right'

// --- Acuità visiva (la "E" di Snellen) ---
// Livelli in logMAR, dal più grande al più piccolo: 1.0 = 1/10, 0.0 = 10/10.
// La E è alta 5 primi d'arco × 10^logMAR alla distanza scelta.
export const ACUITY_LEVELS = [1.0, 0.8, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.0] as const
// Prove per livello e quante giuste servono per superarlo
export const ACUITY_TRIES_PER_LEVEL = 3
export const ACUITY_PASS = 2

export type Direction = 'up' | 'right' | 'down' | 'left'

export interface AcuityEyeResult {
  eye: Eye
  // Livello più piccolo superato (logMAR); null = nemmeno il primo
  bestLogMar: number | null
  // Lo schermo non poteva disegnare lettere più piccole: il valore vero
  // potrebbe essere più alto
  limitedByScreen?: boolean
}

export interface AcuityTestResult {
  distanceCm: number
  pxPerMm: number
  eyes: AcuityEyeResult[]
}

// Acuità in decimi (es. 8 = 8/10); 0 se nemmeno il livello più grande
export const logMarToTenths = (logMar: number | null) => (logMar === null ? 0 : Math.round(Math.pow(10, -logMar) * 100) / 10)

// Altezza della E in millimetri alla distanza data
export const optotypeMm = (logMar: number, distanceCm: number) =>
  distanceCm * 10 * Math.tan(((5 * Math.pow(10, logMar)) / 60) * (Math.PI / 180))

// 0-100 (10/10 = 100), media dei due occhi: più alto è meglio
export function computeAcuityScore(eyes: AcuityEyeResult[]): number {
  if (eyes.length === 0) return 0
  const avg = eyes.reduce((acc, e) => acc + Math.min(10, logMarToTenths(e.bestLogMar)), 0) / eyes.length
  return Math.round(avg * 100) / 10
}

// --- Griglia di Amsler ---
export const AMSLER_SIZE = 20

export interface AmslerEyeResult {
  eye: Eye
  // Caselle segnate (riga * AMSLER_SIZE + colonna) dove le linee sembrano
  // storte, sfocate o mancanti
  marked: number[]
}

export interface AmslerTestResult {
  eyes: AmslerEyeResult[]
}
