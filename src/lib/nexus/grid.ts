// KUMANI NEXUS — la griglia del giorno, costruita dalla data: uguale per tutti,
// senza salvarla da nessuna parte. Si parte da una parola e si aggiungono
// parole che ne incrociano altre, finché la griglia 7×7 è ben piena.
// Solo lato server: contiene le risposte.

import { WORDS_IT } from './words-it'
import { WORDS_EN } from './words-en'
import { NEXUS_SIZE, type NexusDir, type NexusLocale, type NexusPuzzle } from './types'

type Entry = { word: string; clue: string }
type Placed = { word: string; clue: string; row: number; col: number; dir: NexusDir }
export type NexusSolution = { puzzle: NexusPuzzle; letters: string[][]; answers: Record<string, string> }

function parse(raw: string, size: number): Entry[] {
  const seen = new Set<string>()
  const out: Entry[] = []
  for (const line of raw.split('\n')) {
    const [word, clue] = line.split('|').map((s) => s?.trim() ?? '')
    if (!word || !clue || !/^[A-Z]+$/.test(word) || word.length < 3 || word.length > size || seen.has(word)) continue
    seen.add(word)
    out.push({ word, clue })
  }
  return out
}

const BANKS: Record<NexusLocale, Entry[]> = { it: parse(WORDS_IT, NEXUS_SIZE), en: parse(WORDS_EN, NEXUS_SIZE) }

// Numeri casuali ripetibili a partire da un testo (stesso testo, stessa sequenza)
function rngFrom(seed: string) {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(list: T[], rnd: () => number): T[] {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function build(bank: Entry[], size: number, rnd: () => number): Placed[] {
  const letters: (string | null)[][] = Array.from({ length: size }, () => Array(size).fill(null))
  const used: { a: boolean; d: boolean }[][] = Array.from({ length: size }, () => Array.from({ length: size }, () => ({ a: false, d: false })))
  const placed: Placed[] = []
  const at = (r: number, c: number) => (r >= 0 && c >= 0 && r < size && c < size ? letters[r][c] : null)

  // La parola ci sta? Restituisce gli incroci (-1 = non ci sta)
  const fits = (word: string, row: number, col: number, dir: NexusDir): number => {
    const dr = dir === 'd' ? 1 : 0
    const dc = dir === 'a' ? 1 : 0
    const endR = row + dr * (word.length - 1)
    const endC = col + dc * (word.length - 1)
    if (row < 0 || col < 0 || endR >= size || endC >= size) return -1
    if (at(row - dr, col - dc) || at(endR + dr, endC + dc)) return -1
    let crossings = 0
    for (let k = 0; k < word.length; k++) {
      const r = row + dr * k
      const c = col + dc * k
      const cur = letters[r][c]
      if (cur) {
        if (cur !== word[k] || used[r][c][dir]) return -1
        crossings++
      } else if (at(r + dc, c + dr) || at(r - dc, c - dr)) {
        // casella vuota con una lettera accanto: formerebbe parole non volute
        return -1
      }
    }
    return crossings === word.length ? -1 : crossings
  }

  const place = (entry: Entry, row: number, col: number, dir: NexusDir) => {
    for (let k = 0; k < entry.word.length; k++) {
      const r = row + (dir === 'd' ? k : 0)
      const c = col + (dir === 'a' ? k : 0)
      letters[r][c] = entry.word[k]
      used[r][c][dir] = true
    }
    placed.push({ ...entry, row, col, dir })
  }

  const longOnes = bank.filter((e) => e.word.length >= 5)
  const first = longOnes[Math.floor(rnd() * longOnes.length)]
  const firstDir: NexusDir = rnd() < 0.5 ? 'a' : 'd'
  const fixed = Math.floor(rnd() * size)
  const start = Math.floor(rnd() * (size - first.word.length + 1))
  place(first, firstDir === 'a' ? fixed : start, firstDir === 'a' ? start : fixed, firstDir)

  const usedWords = new Set([first.word])
  for (let round = 0; round < 3 && placed.length < 14; round++) {
    let added = false
    for (const entry of shuffle(bank, rnd)) {
      if (placed.length >= 14) break
      if (usedWords.has(entry.word)) continue
      // Posizioni in cui una lettera della parola cade su una lettera uguale
      const options: { row: number; col: number; dir: NexusDir; crossings: number }[] = []
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          const cur = letters[r][c]
          if (!cur) continue
          for (let k = 0; k < entry.word.length; k++) {
            if (entry.word[k] !== cur) continue
            for (const dir of ['a', 'd'] as NexusDir[]) {
              const row = dir === 'd' ? r - k : r
              const col = dir === 'a' ? c - k : c
              const crossings = fits(entry.word, row, col, dir)
              if (crossings > 0) options.push({ row, col, dir, crossings })
            }
          }
        }
      }
      if (options.length === 0) continue
      // Meglio le posizioni con più incroci (griglia più compatta)
      const best = Math.max(...options.map((o) => o.crossings))
      const pool = options.filter((o) => o.crossings === best)
      const choice = pool[Math.floor(rnd() * pool.length)]
      place(entry, choice.row, choice.col, choice.dir)
      usedWords.add(entry.word)
      added = true
    }
    if (!added) break
  }
  return placed
}

const cache = new Map<string, NexusSolution>()

export function nexusSolution(day: string, locale: NexusLocale): NexusSolution {
  const key = `${locale}:${day}`
  const hit = cache.get(key)
  if (hit) return hit

  const size = NEXUS_SIZE
  const bank = BANKS[locale]
  const rnd = rngFrom(`nexus:${key}`)
  // Diversi tentativi: si tiene la griglia più piena
  let best: Placed[] = []
  let bestScore = -1
  for (let attempt = 0; attempt < 24; attempt++) {
    const placed = build(bank, size, rnd)
    const filled = new Set(placed.flatMap((p) => Array.from({ length: p.word.length }, (_, k) => `${p.row + (p.dir === 'd' ? k : 0)},${p.col + (p.dir === 'a' ? k : 0)}`))).size
    const score = filled + placed.length * 2
    if (score > bestScore) {
      best = placed
      bestScore = score
    }
    if (placed.length >= 11 && filled >= 30) break
  }

  const letters: string[][] = Array.from({ length: size }, () => Array(size).fill(''))
  for (const p of best) {
    for (let k = 0; k < p.word.length; k++) letters[p.row + (p.dir === 'd' ? k : 0)][p.col + (p.dir === 'a' ? k : 0)] = p.word[k]
  }
  // Numeri: in ordine di lettura, uno per ogni casella da cui parte una parola
  const numbers: number[][] = Array.from({ length: size }, () => Array(size).fill(0))
  const starts = [...new Set(best.map((p) => `${p.row},${p.col}`))].map((s) => s.split(',').map(Number)).sort((x, y) => x[0] - y[0] || x[1] - y[1])
  starts.forEach(([r, c], i) => (numbers[r][c] = i + 1))

  const slots = best
    .map((p) => ({ id: `${numbers[p.row][p.col]}${p.dir}`, num: numbers[p.row][p.col], dir: p.dir, row: p.row, col: p.col, len: p.word.length, clue: p.clue }))
    .sort((x, y) => (x.dir === y.dir ? x.num - y.num : x.dir === 'a' ? -1 : 1))
  const answers = Object.fromEntries(best.map((p) => [`${numbers[p.row][p.col]}${p.dir}`, p.word]))

  const solution: NexusSolution = {
    puzzle: { day, locale, size, open: letters.map((row) => row.map((ch) => ch !== '')), numbers, slots },
    letters,
    answers,
  }
  if (cache.size > 50) cache.clear()
  cache.set(key, solution)
  return solution
}
