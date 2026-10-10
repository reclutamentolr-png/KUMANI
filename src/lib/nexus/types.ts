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
// Sfida da 2 a 4 giocatori (fase 2)
// ---------------------------------------------------------------------------
export const NEXUS_DUEL_SIZE = 9
export const NEXUS_MAX_PLAYERS = 4
// Secondi per turno: 60 in due, 45 in tre o quattro (l'attesa resta breve)
export const nexusTurnSeconds = (players: number) => (players > 2 ? 45 : 60)
// Turni di fila senza parole trovate, per giocatore, dopo i quali la partita finisce
export const NEXUS_STALL_PER_PLAYER = 4

export type NexusDuelPlayer = { seat: number; name: string; score: number; me: boolean; left: boolean }
export type NexusDuelClaim = { slotId: string; seat: number; points: number; crossings: number }

export type NexusDuelState = {
  code: string
  // canale in tempo reale della sfida (solo segnali, nessun dato)
  channel: string
  locale: NexusLocale
  status: 'waiting' | 'live' | 'finished'
  // il mio posto (null = non partecipo: posso unirmi se la sfida aspetta)
  mySeat: number | null
  isHost: boolean
  canJoin: boolean
  players: NexusDuelPlayer[]
  turnSeat: number | null
  turnEndsAt: string | null
  serverNow: string
  stalledOut: boolean
  puzzle: { size: number; open: boolean[][]; numbers: number[][]; slots: NexusSlot[] }
  // caselle ×2 ("riga,colonna")
  special: string[]
  claims: NexusDuelClaim[]
  // lettere delle parole già prese (a fine partita tutta la soluzione)
  letters: string[][]
  lastMove: { seat: number; slotId: string | null; correct: boolean; points: number; word: string | null } | null
  // posti dei vincitori (più di uno = pari merito)
  winners: number[]
}
