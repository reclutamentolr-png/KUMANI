// Dati statici condivisi tra NeurobalancePlayer (pagina Neurobalance) e
// NeurobalanceAudioProvider (motore audio globale, sopravvive alla
// navigazione) — i nomi/descrizioni mostrati a schermo restano nelle
// traduzioni (t('presets.<id>.name')), qui servono solo i parametri audio.
export type Preset = {
  id: string
  carrier: number
  beat: number
  duration: number
}

export type SpecialSound = {
  id: string
  frequency: number
}

export const presets: Preset[] = [
  { id: 'deep-rest', carrier: 180, beat: 2, duration: 20 },
  { id: 'focus-flow', carrier: 220, beat: 10, duration: 15 },
  { id: 'reset', carrier: 160, beat: 6, duration: 10 },
]

export const specialSounds: SpecialSound[] = [
  { id: 'guarigione', frequency: 285 },
  { id: 'ripristina-benessere', frequency: 417 },
  { id: 'liberare-tensione', frequency: 432 },
  { id: 'riparazione-dna', frequency: 528 },
  { id: 'innalzare-vibrazioni', frequency: 963 },
]

// Audio registrati (public/audio): ognuno in due formati, Opus (.webm,
// più leggero) e AAC (.m4a) per i browser che non leggono l'Opus. La durata
// è quella reale del file, in secondi.
export type Track = {
  id: string
  src: string
  duration: number
  frequency?: number
}

export const tracks: Track[] = [
  { id: 'tibetan-bowls', src: '/audio/campane-tibetane-432hz', duration: 2499, frequency: 432 },
  { id: 'meditation-relax', src: '/audio/meditazione-relax', duration: 618 },
]

export const MIN_LISTEN_SECONDS_FOR_POINT = 10 * 60
