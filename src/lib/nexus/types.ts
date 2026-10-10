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

// Caselle di una parola
export const slotCells = (slot: NexusSlot): { r: number; c: number }[] =>
  Array.from({ length: slot.len }, (_, k) => ({ r: slot.row + (slot.dir === 'd' ? k : 0), c: slot.col + (slot.dir === 'a' ? k : 0) }))

// ---------------------------------------------------------------------------
// Duello (fase 2)
// ---------------------------------------------------------------------------
export const NEXUS_DUEL_SIZE = 9
export const NEXUS_TURN_SECONDS = 60
// Turni di fila senza parole trovate dopo i quali la partita finisce
export const NEXUS_STALL_LIMIT = 8

export type NexusDuelClaim = { slotId: string; mine: boolean; points: number; crossings: number }

export type NexusDuelState = {
  code: string
  // canale in tempo reale della sfida (solo segnali, nessun dato)
  channel: string
  locale: NexusLocale
  status: 'waiting' | 'live' | 'finished'
  // null = non partecipi (puoi unirti se la sfida aspetta un avversario)
  me: 'host' | 'guest' | null
  canJoin: boolean
  host: { name: string; score: number }
  guest: { name: string; score: number } | null
  myTurn: boolean
  turnEndsAt: string | null
  serverNow: string
  stall: number
  puzzle: { size: number; open: boolean[][]; numbers: number[][]; slots: NexusSlot[] }
  // caselle ×2 ("riga,colonna")
  special: string[]
  claims: NexusDuelClaim[]
  // lettere delle parole già prese (le altre caselle vuote)
  letters: string[][]
  lastMove: { mine: boolean; slotId: string | null; correct: boolean; points: number; word: string | null } | null
  result: 'won' | 'lost' | 'draw' | null
}
