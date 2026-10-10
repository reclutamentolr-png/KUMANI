// KUMANI NEXUS — tipi e costanti condivisi con il browser (niente risposte qui).

export const NEXUS_SIZE = 7
// Lingue delle griglie: per ora italiano e inglese (le altre più avanti)
export const NEXUS_LOCALES = ['it', 'en'] as const
export type NexusLocale = (typeof NEXUS_LOCALES)[number]

export const nexusLocaleFor = (locale: string): NexusLocale => (locale === 'it' ? 'it' : 'en')

export type NexusDir = 'a' | 'd'

// Una parola della griglia, senza la risposta
export type NexusSlot = { id: string; num: number; dir: NexusDir; row: number; col: number; len: number; clue: string }

export type NexusPuzzle = {
  day: string
  locale: NexusLocale
  size: number
  // true = casella da riempire, false = casella nera
  open: boolean[][]
  // numero all'inizio delle parole (0 = nessuno)
  numbers: number[][]
  slots: NexusSlot[]
}

export type NexusResult = { seconds: number; hints: number }

export type NexusStatus = {
  puzzle: NexusPuzzle
  // Già completata oggi (in questa lingua)
  result: NexusResult | null
  streak: number
}
